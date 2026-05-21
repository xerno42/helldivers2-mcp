# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A standalone MCP server that exposes live Helldivers 2 galactic war data to LLMs. It uses the stateless Streamable HTTP transport: each `POST /mcp` request spins up a fresh `McpServer` + transport pair, handles the request, and tears them down. There is no session state.

The upstream data source is the community API at `https://api.helldivers2.dev`. A `GET /health` endpoint is also served for liveness checks.

## Development Commands

```bash
pnpm dev              # tsx watch — hot reload
pnpm build            # tsc → dist/
pnpm start            # node dist/index.js (after build)
pnpm lint             # eslint src
pnpm test             # Jest (ESM mode via --experimental-vm-modules)
pnpm test:watch
pnpm test:coverage
```

Run a single test file:
```bash
pnpm test src/__tests__/tools.war.test.ts
```

## Architecture

```
src/
  index.ts           — Express app, MCP server factory, request routing, origin guard, incoming rate limiter
  client.ts          — hd2Fetch(): in-memory cache + rate-limit queue over api.helldivers2.dev
  rate-limit.ts      — createRateLimiter(): token-bucket middleware for incoming /mcp requests (per-IP)
  reference-data.ts  — reads json/ files at startup, exposes lookup helpers
  format-planet.ts   — loadWarSnapshot() (fetches 3 endpoints in parallel), formatPlanetDetails(), formatActivePlanetSummary()
  tool-types.ts      — Tool / ToolDefinition / ToolResult / ToolHandler interfaces
  utils.ts           — textResponse(), errorResponse(), stripMarkup helpers, toRelativeTime()
  enums.ts           — game enum maps (Races, AssignmentTypes, difficulty levels, etc.)
  api-types.ts       — raw API response types (RawWarStatus, RawPlanetInfo, etc.)
  tools/
    war.ts           — get_war_status
    planets.ts       — get_all_planets, get_planet_details
    assignments.ts   — get_assignments
    news.ts          — get_dispatches, get_steam_news
    dss.ts           — get_space_station_details
json/                — static reference data files (planets, biomes, factions, effects, items…)
```

### Adding a Tool

1. Create `src/tools/your-tool.ts` exporting a `Tool` object with `.definition` and `.handler`.
2. Import and add it to the `TOOLS` array in `src/index.ts`.
3. Return `textResponse(...)` on success or `errorResponse(...)` on failure — never throw from a handler.

### `hd2Fetch<T>(endpoint)`

Wraps all upstream calls. Checks an in-memory cache (2-minute TTL) first; on cache miss, enqueues the request and processes it through a rate-limit-aware queue that respects `X-Ratelimit-Remaining` / `Retry-After` headers. All tool handlers must go through `hd2Fetch` — never call `fetch` directly.

### Reference Data

`getReferenceData()` reads the `json/` directory once at startup and caches the result in memory. Use the named lookup helpers (`lookupPlanetName`, `lookupFaction`, `lookupBiome`, etc.) rather than accessing the raw cache object.

### `loadWarSnapshot(hd2Fetch)`

Parallel-fetches `/api/v1/war/status`, `/api/v1/war/info`, and `/api/v1/stats/war/season/all/summary` into a `WarSnapshot`. `get_war_status`, `get_planet_details`, and `get_space_station_details` all call this.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `X_SUPER_CONTACT` | *(required)* | Forwarded as `X-Super-Contact` to upstream API per their usage guidelines |
| `PORT` | `3000` | HTTP port to listen on |
| `BIND_HOST` | `127.0.0.1` | Interface to bind — use `0.0.0.0` in Docker/containers |
| `MCP_ALLOWED_ORIGINS` | *(unset)* | Comma-separated browser `Origin` values to allow. **Unset = all browser-originated requests are blocked**; server-to-server calls (no `Origin` header) are always allowed |
| `MCP_RATE_LIMIT_PER_MIN` | `60` | Sustained incoming request rate per IP (requests/minute) |
| `MCP_RATE_LIMIT_BURST` | `= MCP_RATE_LIMIT_PER_MIN` | Burst capacity for the token-bucket rate limiter |

## TypeScript & Module Setup

- `"type": "module"` — use `import/export`, never `require`.
- All imports of local `.ts` files must use the `.js` extension (resolved by `moduleNameMapper` in Jest and by `tsx` at runtime).
- ESM Jest is enabled via `node --experimental-vm-modules`; the `ts-jest` preset handles transpilation.

## Writing Tests

Tests use `jest.unstable_mockModule` (ESM-compatible). Modules must be mocked **before** the module under test is imported, using a top-level `await import(...)` after the mock setup:

```typescript
jest.unstable_mockModule('../client.js', () => ({ hd2Fetch: jest.fn() }));
jest.unstable_mockModule('../format-planet.js', () => ({
  loadWarSnapshot: mockLoadWarSnapshot,
  formatActivePlanetSummary: mockFormatActivePlanetSummary,
}));

// import AFTER mocks are registered
const { getWarStatus } = await import('../tools/war.js');
```
