# helldivers2-mcp

A stateless [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes live **Helldivers 2** galactic war data to LLMs.

Data is sourced from the community API at [api.helldivers2.dev](https://api.helldivers2.dev).

---

## Tools

| Tool | Description |
|------|-------------|
| `get_war_status` | Aggregated war statistics and a list of active planets with player counts, events, and attacking vectors |
| `get_assignments` | Active Major Orders — tasks, rewards, progress, and deadlines |
| `get_all_planets` | Full planet list with IDs, names, and sectors |
| `get_planet_details` | Detailed per-planet info: biome, hazards, factions, active events, and statistics (up to 5 planets per call) |
| `get_dispatches` | In-game dispatch feed (High Command broadcasts) |
| `get_steam_news` | Recent Steam news articles for Helldivers 2 |
| `get_space_station_details` | Democracy Space Station status, orbital cannon health, and active tactical actions |

---

## Quickstart

### Prerequisites

- Node.js 22+ or Docker
- A contact email for the `X-Super-Contact` header (required by the upstream API)

### Local dev

```bash
cp .env.example .env   # set X_SUPER_CONTACT=your@email.com
npm install
npm dev               # hot-reload via tsx watch on :3000
```

### Production build

```bash
npm build   # tsc → dist/
npm start
```

### Docker

```bash
docker build -t helldivers2-mcp .
docker run -p 3000:3000 -e X_SUPER_CONTACT=your@email.com helldivers2-mcp
```

---

## Configuration

All configuration is via environment variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `X_SUPER_CONTACT` | *(required)* | Forwarded as `X-Super-Contact` to the upstream API per their usage guidelines |
| `PORT` | `3000` | HTTP port to listen on |
| `BIND_HOST` | `127.0.0.1` | Interface to bind (`0.0.0.0` for Docker/containers) |
| `MCP_ALLOWED_ORIGINS` | *(unset)* | Comma-separated list of allowed browser `Origin` headers. Unset means browser-originated requests are blocked; server-to-server calls (no `Origin` header) are always allowed |
| `MCP_RATE_LIMIT_PER_MIN` | `60` | Sustained request rate limit (requests per minute) |
| `MCP_RATE_LIMIT_BURST` | `= MCP_RATE_LIMIT_PER_MIN` | Burst capacity for the token-bucket rate limiter |

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/mcp` | MCP Streamable HTTP transport endpoint |
| `GET` | `/health` | Liveness check — returns `{ "ok": true }` |

The server uses the **stateless** Streamable HTTP transport. Each `POST /mcp` request creates a fresh `McpServer` + transport pair, handles the request, then tears them down. There is no session state.

---

## Connecting to Claude Desktop

### Hosted server (easiest)

A public instance is available at `https://mcp.avengersofsuperearth.com/mcp`. No setup required — just add it to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "helldivers2": {
      "url": "https://mcp.avengersofsuperearth.com/mcp"
    }
  }
}
```

### Self-hosted (local binary)

```json
{
  "mcpServers": {
    "helldivers2": {
      "command": "node",
      "args": ["/path/to/helldivers2-mcp/dist/index.js"],
      "env": {
        "X_SUPER_CONTACT": "your@email.com"
      }
    }
  }
}
```

### Self-hosted (HTTP server)

```json
{
  "mcpServers": {
    "helldivers2": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

---

## Development

```bash
npm test              # Jest (ESM mode)
npm test:watch
npm test:coverage
npm lint              # ESLint
```

Run a single test file:

```bash
npm test src/__tests__/tools.war.test.ts
```

### Adding a tool

1. Create `src/tools/your-tool.ts` and export a `Tool` object with `.definition` and `.handler`.
2. Import it and add it to the `TOOLS` array in [src/index.ts](src/index.ts).
3. Return `textResponse(...)` on success or `errorResponse(...)` on failure — never throw from a handler.
4. All upstream calls must go through `hd2Fetch` (in-memory 2-minute cache + rate-limit-aware queue).

---

## License

[MIT](LICENSE)
