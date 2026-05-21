import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';

import { Tool } from './tool-types.js';
import { createTokenBucket, type TokenBucket } from './rate-limit.js';
import {
  setReferenceData,
  type ReferenceData,
  type PlanetRef,
  type NamedDescribed,
  type PlanetRegionRef,
  type PlanetEffectRef,
  type ItemNameRef,
} from './reference-data.js';
import { WorkerTransport } from './worker-transport.js';
import { getWarStatus } from './tools/war.js';
import { getAllPlanets, getPlanetDetails } from './tools/planets.js';
import { getDispatches, getSteamNews } from './tools/news.js';
import { getAssignments } from './tools/assignments.js';
import { getSpaceStationDetails } from './tools/dss.js';

import planetsJson from '../static/planets/planets.json' with { type: 'json' };
import biomesJson from '../static/planets/biomes.json' with { type: 'json' };
import environmentalsJson from '../static/planets/environmentals.json' with { type: 'json' };
import planetRegionsJson from '../static/planets/planetRegion.json' with { type: 'json' };
import factionsJson from '../static/factions.json' with { type: 'json' };
import planetEffectsJson from '../static/effects/planetEffects.json' with { type: 'json' };
import itemNamesJson from '../static/items/item_names.json' with { type: 'json' };

setReferenceData({
  planets: planetsJson as Record<string, PlanetRef>,
  biomes: biomesJson as Record<string, NamedDescribed>,
  environmentals: environmentalsJson as Record<string, NamedDescribed>,
  planetRegions: planetRegionsJson as Record<string, PlanetRegionRef>,
  factions: factionsJson as Record<string, string>,
  planetEffects: planetEffectsJson as Record<string, PlanetEffectRef>,
  itemNames: itemNamesJson as Record<string, ItemNameRef>,
} satisfies ReferenceData);

interface Env {
  X_SUPER_CONTACT?: string;
  MCP_ALLOWED_ORIGINS?: string;
  MCP_RATE_LIMIT_PER_MIN?: string;
  MCP_RATE_LIMIT_BURST?: string;
}

const TOOLS: Tool[] = [
  getWarStatus,
  getAssignments,
  getAllPlanets,
  getPlanetDetails,
  getDispatches,
  getSteamNews,
  getSpaceStationDetails,
];

function createMcpServer(): McpServer {
  const mcp = new McpServer(
    { name: 'helldivers2', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  mcp.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => t.definition),
  }));

  mcp.server.setRequestHandler(
    CallToolRequestSchema,
    async (req: { params: { name: string; arguments?: Record<string, unknown> } }): Promise<CallToolResult> => {
      const tool = TOOLS.find((t) => t.definition.name === req.params.name);
      if (!tool) {
        throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${req.params.name}`);
      }
      try {
        const args = (req.params.arguments ?? {}) as Record<string, unknown>;
        return (await tool.handler(args)) as CallToolResult;
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Tool error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  return mcp;
}

// Module-scoped — Workers isolates reuse this across requests; it doubles as
// a poor-man's DDoS shield since module state persists per isolate.
let limiter: TokenBucket | null = null;
let allowedOrigins: Set<string> | null = null;
let envApplied = false;

function configureFromEnv(env: Env): void {
  if (envApplied) return;
  envApplied = true;

  // process.env is exposed via nodejs_compat; mirror Worker bindings into it so
  // the existing hd2 client (which reads process.env.X_SUPER_CONTACT) keeps working.
  if (env.X_SUPER_CONTACT && !process.env.X_SUPER_CONTACT) {
    process.env.X_SUPER_CONTACT = env.X_SUPER_CONTACT;
  }

  const rateLimitPerMin = Math.max(1, parseInt(env.MCP_RATE_LIMIT_PER_MIN ?? '60', 10));
  const burst = Math.max(
    rateLimitPerMin,
    parseInt(env.MCP_RATE_LIMIT_BURST ?? String(rateLimitPerMin), 10),
  );
  limiter = createTokenBucket({ capacity: burst, refillPerSec: rateLimitPerMin / 60 });

  const raw = env.MCP_ALLOWED_ORIGINS ?? '';
  allowedOrigins = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function jsonResponse(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...extraHeaders,
    },
  });
}

function rpcError(status: number, code: number, message: string, extraHeaders?: Record<string, string>): Response {
  return jsonResponse(
    status,
    { jsonrpc: '2.0', error: { code, message }, id: null },
    extraHeaders,
  );
}

// JSON-RPC requests carry an `id`; notifications and responses do not (or carry
// a result/error rather than a method). Only requests warrant a reply body.
function expectsResponse(body: JSONRPCMessage): boolean {
  const msgs = Array.isArray(body) ? body : [body];
  return msgs.some(
    (m) => typeof m === 'object' && m !== null && 'id' in m && 'method' in m,
  );
}

function clientKey(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

async function handleMcp(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins!.size > 0 && !allowedOrigins!.has(origin)) {
    return rpcError(403, -32000, `Forbidden origin: ${origin}`);
  }

  if (request.method !== 'POST') {
    return rpcError(405, -32000, 'Method not allowed. Use POST in stateless mode.', { allow: 'POST' });
  }

  const limit = limiter!.take(clientKey(request));
  if (!limit.allowed) {
    return rpcError(429, -32000, 'Rate limit exceeded', { 'retry-after': String(limit.retryAfter) });
  }

  let body: JSONRPCMessage;
  try {
    body = (await request.json()) as JSONRPCMessage;
  } catch {
    return rpcError(400, -32700, 'Parse error: invalid JSON');
  }

  const server = createMcpServer();
  const transport = new WorkerTransport();
  try {
    await server.connect(transport);
    // A JSON-RPC request carries an `id` and expects a reply; a notification
    // (e.g. notifications/initialized) or response has none and gets no reply,
    // so we hand it off and return 202 Accepted per the Streamable HTTP spec.
    if (!expectsResponse(body)) {
      transport.notify(body);
      return new Response(null, { status: 202 });
    }
    const response = await transport.dispatch(body);
    return jsonResponse(200, response);
  } catch (err) {
    console.error('[helldivers2-mcp] /mcp handler error:', err);
    return rpcError(500, -32603, 'Internal server error');
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    configureFromEnv(env);

    const url = new URL(request.url);
    if (url.pathname === '/mcp') {
      return handleMcp(request);
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse(200, { ok: true });
    }
    return new Response('Not Found', { status: 404 });
  },
};
