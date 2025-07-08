#!/bin/bash

echo "Starting all MCP services..."

# Kill any existing processes
echo "Stopping existing services..."
pkill -f "dist/http-server.js"
pkill -f "api-gateway/index.js"
pkill -f "n8n-mcp.*http-server"

sleep 2

# Start Auth MCP HTTP Server
echo "Starting Auth MCP HTTP Server..."
cd /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/auth-mcp
nohup node start-http.js > auth-server.log 2>&1 &
echo "Auth server started with PID: $!"

# Start n8n MCP HTTP Server
echo "Starting n8n MCP HTTP Server..."
cd /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp
nohup npx tsx src/http-server.ts > n8n-http-server.log 2>&1 &
echo "n8n HTTP server started with PID: $!"

# Start API Gateway
echo "Starting API Gateway..."
cd /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/api-gateway
nohup npm start > gateway.log 2>&1 &
echo "API Gateway started with PID: $!"

sleep 3

# Check if services are running
echo -e "\nChecking services..."
if lsof -i :3005 > /dev/null; then
    echo "✓ Auth server is running on port 3005"
else
    echo "✗ Auth server failed to start"
fi

if lsof -i :3006 > /dev/null; then
    echo "✓ n8n HTTP server is running on port 3006"
else
    echo "✗ n8n HTTP server failed to start"
fi

if lsof -i :8080 > /dev/null; then
    echo "✓ API Gateway is running on port 8080"
else
    echo "✗ API Gateway failed to start"
fi

echo -e "\nAll services started. You can now access the application at http://localhost:5173"
echo "To stop all services, run: pkill -f 'http-server|api-gateway'"