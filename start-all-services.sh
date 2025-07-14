#!/bin/bash

# Automation Hub - Start All Services Script
echo "🚀 Starting Automation Hub Services..."

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use"
        return 1
    fi
    return 0
}

# Function to start service in background
start_service() {
    local service_name=$1
    local port=$2
    local command=$3
    local directory=$4
    
    echo "Starting $service_name on port $port..."
    
    if ! check_port $port; then
        echo "⚠️  $service_name may already be running on port $port"
        return 1
    fi
    
    cd "$directory"
    nohup $command > "../${service_name}.log" 2>&1 &
    local pid=$!
    echo "$pid" > "../${service_name}.pid"
    echo "✅ $service_name started (PID: $pid)"
    sleep 2
}

# Base directory
BASE_DIR="/home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers"
cd "$BASE_DIR"

echo "📁 Base directory: $BASE_DIR"

# Start Auth MCP Server (port 3005)
start_service "auth-mcp" "3005" "npm run start:http" "$BASE_DIR/auth-mcp"

# Start n8n MCP Server (port 3006) 
start_service "n8n-mcp" "3006" "npm run start:http" "$BASE_DIR/n8n-mcp"

# Start API Gateway (port 8080)
start_service "api-gateway" "8080" "npm start" "$BASE_DIR/api-gateway"

# Start Web Interface (port 5173)
start_service "web-interface" "5173" "npm run dev" "$BASE_DIR/web-interface"

echo ""
echo "🎉 All services started successfully!"
echo ""
echo "📊 Service Status:"
echo "  - Auth MCP Server:  http://localhost:3005"
echo "  - n8n MCP Server:   http://localhost:3006" 
echo "  - API Gateway:      http://localhost:8080"
echo "  - Web Interface:    http://localhost:5173"
echo ""
echo "💡 To stop all services, run: ./stop-all-services.sh"
echo "💡 To check status, run: ./check-services.sh"