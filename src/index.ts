import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { Tool } from './tool-types.js';
import { createRateLimiter } from './rate-limit.js';
import { getReferenceData } from './reference-data.js';
import { getWarStatus } from './tools/war.js';
import { getAllPlanets, getPlanetDetails } from './tools/planets.js';
import { getDispatches, getSteamNews } from './tools/news.js';
import { getAssignments } from './tools/assignments.js';
import { getSpaceStationDetails } from './tools/dss.js';

dotenv.config();

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

async function handleMcpPost(req: Request, res: Response): Promise<void> {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[helldivers2-mcp] /mcp handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
      });
    }
  }
}

function methodNotAllowed(_req: Request, res: Response): void {
  res.set('Allow', 'POST');
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Use POST in stateless mode.' },
  });
}

function parseAllowedOrigins(): Set<string> {
  const raw = process.env.MCP_ALLOWED_ORIGINS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function originGuard(allowed: Set<string>) {
  return (req: Request, res: Response, next: () => void): void => {
    const origin = req.headers.origin;
    // No Origin header: server-to-server / non-browser caller - allow.
    if (!origin) {
      next();
      return;
    }
    if (allowed.has(origin)) {
      next();
      return;
    }
    res.status(403).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: `Forbidden origin: ${origin}` },
    });
  };
}

async function main(): Promise<void> {
  if (!process.env.X_SUPER_CONTACT) {
    console.warn(
      '[helldivers2-mcp] X_SUPER_CONTACT env var not set — requests to api.helldivers2.dev will be missing the X-Super-Contact header.',
    );
  }

  // Warm reference-data cache (logs warnings on missing files but does not throw).
  getReferenceData();

  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const allowedOrigins = parseAllowedOrigins();
  const guard = originGuard(allowedOrigins);

  const rateLimitPerMin = Math.max(1, parseInt(process.env.MCP_RATE_LIMIT_PER_MIN ?? '60', 10));
  const burst = Math.max(
    rateLimitPerMin,
    parseInt(process.env.MCP_RATE_LIMIT_BURST ?? String(rateLimitPerMin), 10),
  );
  const limiter = createRateLimiter({ capacity: burst, refillPerSec: rateLimitPerMin / 60 });

  app.post('/mcp', guard, limiter, handleMcpPost);
  app.get('/mcp', guard, methodNotAllowed);
  app.delete('/mcp', guard, methodNotAllowed);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.BIND_HOST ?? '127.0.0.1';
  app.listen(port, host, () => {
    console.log(`[helldivers2-mcp] Listening on http://${host}:${port}/mcp`);
    if (allowedOrigins.size === 0) {
      console.log(
        '[helldivers2-mcp] No browser origins allowed (MCP_ALLOWED_ORIGINS unset). Server-to-server callers (no Origin header) are permitted.',
      );
    } else {
      console.log(
        `[helldivers2-mcp] Allowed browser origins: ${Array.from(allowedOrigins).join(', ')}`,
      );
    }
  });
}

main().catch((err) => {
  console.error('[helldivers2-mcp] Startup failed:', err);
  process.exit(1);
});
