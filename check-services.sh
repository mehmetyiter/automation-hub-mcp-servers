#!/bin/bash

# Automation Hub - Check Services Status Script
echo "🔍 Checking Automation Hub Services Status..."
echo ""

# Function to check service status
check_service() {
    local service_name=$1
    local port=$2
    local url=$3
    
    echo -n "📊 $service_name (port $port): "
    
    # Check if port is listening
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port)
        echo -n "🟢 RUNNING (PID: $pid) "
        
        # Try to make HTTP request if URL provided
        if [ -n "$url" ]; then
            if curl -s --max-time 3 "$url" >/dev/null 2>&1; then
                echo "✅ RESPONDING"
            else
                echo "⚠️  NOT RESPONDING"
            fi
        else
            echo ""
        fi
    else
        echo "🔴 NOT RUNNING"
    fi
}

# Function to show process details
show_process_details() {
    local port=$1
    local service_name=$2
    
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "   Process details: $(ps -p $pid -o pid,ppid,cmd --no-headers 2>/dev/null || echo 'Process not found')"
    fi
}

# Check each service
check_service "Auth MCP Server" "3005" "http://localhost:3005/health"
show_process_details "3005" "auth-mcp"

check_service "n8n MCP Server" "3006" "http://localhost:3006/health"
show_process_details "3006" "n8n-mcp"

check_service "API Gateway" "8080" "http://localhost:8080/health"
show_process_details "8080" "api-gateway"

check_service "Web Interface" "5173" "http://localhost:5173"
show_process_details "5173" "web-interface"

echo ""
echo "📁 PID Files:"
ls -la *.pid 2>/dev/null || echo "   No PID files found"

echo ""
echo "📄 Recent Log Files:"
ls -la *.log 2>/dev/null | tail -5 || echo "   No log files found"

echo ""
echo "🌐 Quick Health Check:"
echo "   API Gateway health: $(curl -s --max-time 2 http://localhost:8080/health 2>/dev/null || echo 'Not responding')"
echo "   n8n MCP health: $(curl -s --max-time 2 http://localhost:3006/health 2>/dev/null || echo 'Not responding')"
echo "   Auth MCP health: $(curl -s --max-time 2 http://localhost:3005/health 2>/dev/null || echo 'Not responding')"

echo ""
echo "💡 Available commands:"
echo "   ./start-all-services.sh  - Start all services"
echo "   ./stop-all-services.sh   - Stop all services"
echo "   ./check-services.sh      - Check service status (this script)"