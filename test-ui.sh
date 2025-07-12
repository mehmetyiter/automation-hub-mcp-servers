#!/bin/bash

echo "🚀 Starting UI Test Environment..."
echo ""

# Navigate to web interface directory
cd web-interface

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "✅ Dependencies installed"
echo ""
echo "🌐 Starting development server..."
echo ""
echo "📋 Available test pages:"
echo "   http://localhost:5173/ui-test    - Component test page"
echo "   http://localhost:5173/dashboard  - Enhanced dashboard"
echo "   http://localhost:5173/           - Main application"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
npm run dev