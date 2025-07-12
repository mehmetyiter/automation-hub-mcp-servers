#!/bin/bash

echo "🚀 Starting Production Environment..."
echo ""

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use. Killing process..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null
        sleep 1
    fi
}

# Check and free ports
echo "🔍 Checking ports..."
check_port 3005  # Auth service
check_port 3006  # n8n service
check_port 8080  # API Gateway
check_port 5173  # Web interface

# Start auth service
echo "🔐 Starting Auth Service..."
cd auth-mcp
npm start > ../auth-server.log 2>&1 &
AUTH_PID=$!
cd ..

# Wait for auth service to start
sleep 3

# Start n8n service
echo "🤖 Starting n8n Service..."
cd n8n-mcp
npm start > ../n8n-server.log 2>&1 &
N8N_PID=$!
cd ..

# Wait for n8n service to start
sleep 3

# Start API Gateway
echo "🌐 Starting API Gateway..."
cd api-gateway
npm start > ../api-gateway.log 2>&1 &
GATEWAY_PID=$!
cd ..

# Wait for gateway to start
sleep 2

# Start web interface
echo "💻 Starting Web Interface..."
cd web-interface
npm run dev > ../frontend.log 2>&1 &
WEB_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "📋 Service Status:"
echo "   Auth Service:   http://localhost:3005 (PID: $AUTH_PID)"
echo "   n8n Service:    http://localhost:3006 (PID: $N8N_PID)"
echo "   API Gateway:    http://localhost:8080 (PID: $GATEWAY_PID)"
echo "   Web Interface:  http://localhost:5173 (PID: $WEB_PID)"
echo ""
echo "🌐 Open your browser and go to: http://localhost:5173"
echo ""
echo "📝 Default login credentials:"
echo "   Email: test@example.com"
echo "   Password: password123"
echo ""
echo "🛑 To stop all services, press Ctrl+C or run: ./stop-all.sh"
echo ""
echo "📊 Monitoring logs:"
echo "   tail -f auth-server.log     # Auth service logs"
echo "   tail -f n8n-server.log      # n8n service logs"
echo "   tail -f api-gateway.log     # Gateway logs"
echo "   tail -f frontend.log        # Frontend logs"
echo ""

# Create stop script
cat > stop-all.sh << 'EOF'
#!/bin/bash
echo "Stopping all services..."
pkill -f "node.*auth-mcp"
pkill -f "node.*n8n-mcp"
pkill -f "node.*api-gateway"
pkill -f "vite"
echo "All services stopped."
EOF
chmod +x stop-all.sh

# Wait for interrupt
trap "echo ''; echo 'Stopping all services...'; kill $AUTH_PID $N8N_PID $GATEWAY_PID $WEB_PID 2>/dev/null; exit" INT

# Keep script running
wait