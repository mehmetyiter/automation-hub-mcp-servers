#!/bin/bash

echo "Starting Automation Hub MCP Servers"
echo "=================================="

# Check if docker is accessible
if ! docker ps > /dev/null 2>&1; then
    echo "Error: Docker is not accessible. Please run:"
    echo "  ./setup-docker-permissions.sh"
    echo "for instructions on fixing Docker permissions."
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start services
echo "Starting Docker containers..."
docker compose up -d

# Wait a moment
sleep 5

# Check status
echo ""
echo "Checking service status..."
docker compose ps

echo ""
echo "Services should be available at:"
echo "- n8n: http://localhost:5678"
echo "- n8n MCP API: http://localhost:3100"
echo "- Database MCP API: http://localhost:3101"
echo "- Auth MCP API: http://localhost:3102"
echo "- Make MCP API: http://localhost:3103"
echo "- Zapier MCP API: http://localhost:3104"
echo "- Vapi MCP API: http://localhost:3105"
echo ""
echo "To check logs: docker compose logs -f [service_name]"
echo "To stop: docker compose down"