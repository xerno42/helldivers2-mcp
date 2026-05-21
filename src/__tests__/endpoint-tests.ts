// Usage: tsx endpoint-tests.ts
// Optionally: SERVER=http://localhost:3000 tsx endpoint-tests.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const SERVER = process.env.SERVER ?? 'http://localhost:3000';
const DELAY_MS = 10_000;

const G = '\x1b[32m';
const B = '\x1b[34m';
const R = '\x1b[31m';
const X = '\x1b[0m';

async function step(label: string, fn: () => Promise<unknown>): Promise<void> {
  console.log(`${G}${label}${X}`);
  try {
    console.log(JSON.stringify(await fn(), null, 2));
  } catch (err) {
    console.error(`${R}Error: ${(err as Error).message}${X}`);
  }
  console.log();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log(`${B}=== Helldivers 2 MCP Server - endpoint tests ===${X}\n`);

await step('1. Health Check', async () => {
  const res = await fetch(`${SERVER}/health`);
  return res.json();
});

const client = new Client({ name: 'endpoint-test', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL(`${SERVER}/mcp`));
await client.connect(transport);

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });

await step('2. List Available Tools', () => client.listTools());

await delay(DELAY_MS);
await step('3. Get War Status', () => call('get_war_status'));

await delay(DELAY_MS);
await step('4. Get All Planets', () => call('get_all_planets'));

await delay(DELAY_MS);
await step('5. Get Planet Details — single (index 0)', () =>
  call('get_planet_details', { planetindices: [0] }),
);

await delay(DELAY_MS);
await step('6. Get Planet Details — multiple (indices 0, 1, 5)', () =>
  call('get_planet_details', { planetindices: [0, 1, 5] }),
);

await delay(DELAY_MS);
await step('7. Get Assignments', () => call('get_assignments'));

await delay(DELAY_MS);
await step('8. Get Dispatches — default limit', () => call('get_dispatches'));

await delay(DELAY_MS);
await step('9. Get Dispatches — limit 5', () => call('get_dispatches', { limit: 5 }));

await delay(DELAY_MS);
await step('10. Get Steam News — default limit', () => call('get_steam_news'));

await delay(DELAY_MS);
await step('11. Get Steam News — limit 3', () => call('get_steam_news', { limit: 3 }));

await delay(DELAY_MS);
await step('12. Get Space Station Details', () => call('get_space_station_details'));

await client.close();
console.log(`${B}=== Tests Complete ===${X}`);
