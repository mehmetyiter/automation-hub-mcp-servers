#!/bin/bash

# Automation Hub - Stop All Services Script
echo "🛑 Stopping Automation Hub Services..."

# Base directory
BASE_DIR="/home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers"
cd "$BASE_DIR"

# Function to stop service by PID file
stop_service() {
    local service_name=$1
    local pid_file="${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        echo "Stopping $service_name (PID: $pid)..."
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            sleep 2
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "Force killing $service_name..."
                kill -9 "$pid"
            fi
            
            rm -f "$pid_file"
            echo "✅ $service_name stopped"
        else
            echo "⚠️  $service_name process not found (PID: $pid)"
            rm -f "$pid_file"
        fi
    else
        echo "⚠️  No PID file found for $service_name"
    fi
}

# Function to stop service by port
stop_by_port() {
    local service_name=$1
    local port=$2
    
    echo "Checking for $service_name on port $port..."
    local pid=$(lsof -ti:$port)
    
    if [ -n "$pid" ]; then
        echo "Killing $service_name process on port $port (PID: $pid)..."
        kill "$pid" 2>/dev/null
        sleep 1
        
        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
        fi
        echo "✅ $service_name on port $port stopped"
    else
        echo "⚠️  No process found on port $port for $service_name"
    fi
}

# Stop services by PID files first
stop_service "auth-mcp"
stop_service "n8n-mcp" 
stop_service "api-gateway"
stop_service "web-interface"

echo ""
echo "🔍 Checking for remaining processes on ports..."

# Stop any remaining processes on known ports
stop_by_port "auth-mcp" "3005"
stop_by_port "n8n-mcp" "3006"
stop_by_port "api-gateway" "8080"
stop_by_port "web-interface" "5173"

# Clean up any remaining log files
echo ""
echo "🧹 Cleaning up..."
rm -f *.pid

echo ""
echo "🎉 All services stopped successfully!"
echo ""
echo "💡 To start all services again, run: ./start-all-services.sh"