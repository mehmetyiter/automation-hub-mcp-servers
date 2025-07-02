#!/bin/bash

echo "Starting Automation Hub Web Interface"
echo "===================================="

# Check if n8n MCP server is running
echo "Checking n8n MCP server..."
if curl -s http://localhost:3100/health > /dev/null; then
    echo "✓ n8n MCP server is running"
else
    echo "✗ n8n MCP server is not running"
    echo "Please start the n8n MCP server first:"
    echo "  cd n8n-mcp && npm run start:http"
fi

# Navigate to web interface directory
cd web-interface

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the development server
echo ""
echo "Starting web interface..."
npm run dev