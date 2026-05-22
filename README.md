# helldivers2-mcp

A stateless [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes live **Helldivers 2** galactic war data to LLMs.

Data is sourced from the community API at [api.helldivers2.dev](https://api.helldivers2.dev).

---

## Tools

| Tool | Description |
|------|-------------|
| `get_war_status` | Galaxy-wide war statistics (kills by faction, missions won/lost, accuracy, deaths, impact multiplier) and active planets with owner, player count, active events, attack vectors, and region health |
| `get_assignments` | Active Major Orders with title, briefing, decoded task list (faction, difficulty, target planet), current progress numbers, reward type and amount, and time until expiry |
| `get_all_planets` | Full planet list with IDs, names, and sectors |
| `get_planet_details` | Detailed per-planet info: biome, hazards, initial/current owner, health, waypoints, active events, full combat statistics, attacking planets, and regions (up to 5 planets per call) |
| `get_dispatches` | In-game dispatch feed — High Command broadcasts with published date (relative time) and message text; optional `limit` parameter (default 20, max 50) |
| `get_steam_news` | Steam news for Helldivers 2 with title, URL, publish date (relative time), and full article content; optional `limit` parameter (default 10, max 30) |
| `get_space_station_details` | DSS details: current host planet (full planet info), time until next election, and active tactical actions with name, description, status, planet effects, and resource costs |

---

## Quickstart

### Prerequisites

- Node.js 22+ or Docker
- A contact email for the `X-Super-Contact` header (required by the upstream API)

### Local dev

```bash
cp .env.example .env   # set X_SUPER_CONTACT=your@email.com
npm install
npm run dev               # hot-reload via tsx watch on :3000
```

### Production build

```bash
npm run build   # tsc → dist/
npm run start
```

### Docker

Image is available on [Docker Hub](https://hub.docker.com/r/xerno42/helldivers2-mcp).

```bash
docker pull xerno42/helldivers2-mcp # pull from Docker Hub
# or
docker build -t helldivers2-mcp . # build locally

#then run with:
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

## Usage in Code

Call the MCP server directly over HTTP using the Streamable HTTP transport. Each request is a JSON-RPC `tools/call` message sent to `POST /mcp`.

### JavaScript / TypeScript

Using the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk):

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-app", version: "1.0.0" });

const transport = new StreamableHTTPClientTransport(
  new URL("https://mcp.avengersofsuperearth.com/mcp")
);

await client.connect(transport);

// List available tools
const { tools } = await client.listTools();
console.log(tools.map((t) => t.name));

// Get current war status
const warStatus = await client.callTool({
  name: "get_war_status",
  arguments: {},
});
console.log(warStatus.content[0].text);

// Get details for specific planets by index (up to 5)
const planets = await client.callTool({
  name: "get_planet_details",
  arguments: { planetindices: [57, 153] },
});
console.log(planets.content[0].text);

await client.close();
```

Without the SDK — raw JSON-RPC over `fetch`:

```typescript
async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await fetch("https://mcp.avengersofsuperearth.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const text = await res.text();
  // The response is an SSE frame ("event: message\ndata: {json}\n\n");
  // concatenate its data line(s) to recover the JSON-RPC payload.
  const json = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  const data = JSON.parse(json);
  return data.result.content[0].text;
}

const status = await callTool("get_war_status");
const assignments = await callTool("get_assignments");
const dispatches = await callTool("get_dispatches", { limit: 5 });
const planets = await callTool("get_planet_details", { planetindices: [57, 153] });
```

### Python

Using the official [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk):

```python
import asyncio
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client("https://mcp.avengersofsuperearth.com/mcp") as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # List available tools
            tools = await session.list_tools()
            print([t.name for t in tools.tools])

            # Get current war status
            result = await session.call_tool("get_war_status", {})
            print(result.content[0].text)

            # Get details for specific planets by index (up to 5)
            result = await session.call_tool(
                "get_planet_details",
                {"planetindices": [57, 153]},
            )
            print(result.content[0].text)

asyncio.run(main())
```

Without the SDK — raw JSON-RPC over `httpx`:

```python
import httpx

MCP_URL = "https://mcp.avengersofsuperearth.com/mcp"

def call_tool(name: str, arguments: dict = {}) -> str:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    response = httpx.post(MCP_URL, json=payload, headers=headers)
    response.raise_for_status()
    import json
    # The response is an SSE frame ("event: message\ndata: {json}\n\n");
    # concatenate its data line(s) to recover the JSON-RPC payload.
    text = "".join(
        line[5:].strip()
        for line in response.text.splitlines()
        if line.startswith("data:")
    )
    return json.loads(text)["result"]["content"][0]["text"]

status = call_tool("get_war_status")
assignments = call_tool("get_assignments")
planets = call_tool("get_planet_details", {"planetindices": [57, 153]})
```

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
npm run test              # Jest (ESM mode)
npm run test:watch
npm run test:coverage
npm run lint              # ESLint
```

Run a single test file:

```bash
npm run test src/__tests__/tools.war.test.ts
```

### Adding a tool

1. Create `src/tools/your-tool.ts` and export a `Tool` object with `.definition` and `.handler`.
2. Import it and add it to the `TOOLS` array in [src/index.ts](src/index.ts).
3. Return `textResponse(...)` on success or `errorResponse(...)` on failure — never throw from a handler.
4. All upstream calls must go through `hd2Fetch` (in-memory 2-minute cache + rate-limit-aware queue).

---

## License

[MIT](LICENSE)
