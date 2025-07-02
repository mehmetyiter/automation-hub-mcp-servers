#!/bin/bash

echo "Testing Web Interface Setup"
echo "=========================="

# Check if n8n MCP server is running
echo -n "Checking n8n MCP server... "
if curl -s http://localhost:3100/health > /dev/null 2>&1; then
    echo "✓ Running"
else
    echo "✗ Not running"
    echo "  Start with: cd ../n8n-mcp && npm run start:http"
fi

# Check if web interface is running
echo -n "Checking web interface... "
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✓ Running on port 3001"
elif curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Running on port 3000"
else
    echo "✗ Not running"
fi

echo ""
echo "Web interface should be accessible at:"
echo "  http://localhost:3001/"
echo ""
echo "If you see import errors, restart the dev server:"
echo "  npm run dev"