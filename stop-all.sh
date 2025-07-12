#!/bin/bash
echo "Stopping all services..."
pkill -f "node.*auth-mcp"
pkill -f "node.*n8n-mcp"
pkill -f "node.*api-gateway"
pkill -f "vite"
echo "All services stopped."
