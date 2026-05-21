#!/bin/bash

# Helldivers 2 MCP Server - curl Test Requests
# Usage: bash curl-tests.sh
# Make sure the server is running on http://localhost:3000

SERVER="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Helldivers 2 MCP Server - curl Tests ===${NC}\n"

# Health Check
echo -e "${GREEN}1. Health Check${NC}"
echo "GET /health"
curl -s -X GET "$SERVER/health" | jq . || echo "Server may not be responding"
echo ""
echo ""

# List Tools
echo -e "${GREEN}2. List Available Tools${NC}"
echo "POST /mcp - ListTools"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

# Get War Status
echo -e "${GREEN}3. Get War Status (No parameters)${NC}"
echo "POST /mcp - CallTool: get_war_status"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_war_status",
      "arguments": {}
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get All Planets
echo -e "${GREEN}4. Get All Planets (No parameters)${NC}"
echo "POST /mcp - CallTool: get_all_planets"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_all_planets",
      "arguments": {}
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Planet Details - Single Planet
echo -e "${GREEN}5. Get Planet Details - Single Planet (index 0)${NC}"
echo "POST /mcp - CallTool: get_planet_details"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_planet_details",
      "arguments": {
        "planetindices": [0]
      }
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Planet Details - Multiple Planets
echo -e "${GREEN}6. Get Planet Details - Multiple Planets (indices 0, 1, 5)${NC}"
echo "POST /mcp - CallTool: get_planet_details"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "get_planet_details",
      "arguments": {
        "planetindices": [0, 1, 5]
      }
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Assignments
echo -e "${GREEN}7. Get Assignments (No parameters)${NC}"
echo "POST /mcp - CallTool: get_assignments"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "get_assignments",
      "arguments": {}
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Dispatches - Default Limit
echo -e "${GREEN}8. Get Dispatches - Default Limit (20)${NC}"
echo "POST /mcp - CallTool: get_dispatches"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "tools/call",
    "params": {
      "name": "get_dispatches",
      "arguments": {}
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Dispatches - Custom Limit
echo -e "${GREEN}9. Get Dispatches - Custom Limit (5)${NC}"
echo "POST /mcp - CallTool: get_dispatches"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 8,
    "method": "tools/call",
    "params": {
      "name": "get_dispatches",
      "arguments": {
        "limit": 5
      }
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Steam News - Default Limit
echo -e "${GREEN}10. Get Steam News - Default Limit (10)${NC}"
echo "POST /mcp - CallTool: get_steam_news"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 9,
    "method": "tools/call",
    "params": {
      "name": "get_steam_news",
      "arguments": {}
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Steam News - Custom Limit
echo -e "${GREEN}11. Get Steam News - Custom Limit (3)${NC}"
echo "POST /mcp - CallTool: get_steam_news"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 10,
    "method": "tools/call",
    "params": {
      "name": "get_steam_news",
      "arguments": {
        "limit": 3
      }
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

sleep 10

# Get Space Station Details
echo -e "${GREEN}12. Get Space Station Details (No parameters)${NC}"
echo "POST /mcp - CallTool: get_space_station_details"
curl -s -X POST "$SERVER/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 11,
    "method": "tools/call",
    "params": {
      "name": "get_space_station_details",
      "arguments": {}
    }
  }' | sed -n 's/^data: //p' | jq .
echo ""
echo ""

echo -e "${BLUE}=== Tests Complete ===${NC}"
