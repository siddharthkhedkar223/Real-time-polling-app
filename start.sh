#!/bin/bash

# Cross-platform startup script for Polling App
# Works on Linux, macOS, and Windows (with Git Bash/WSL)

echo "================================================"
echo "          POLLING APP - SERVER START          "
echo "================================================"
echo ""

# Check if we're in the right directory
if [ ! -d "client" ] || [ ! -d "server" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Make sure both 'client' and 'server' folders exist"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    echo "   Please install npm (usually comes with Node.js)"
    exit 1
fi

echo "🚀 Starting Backend Server (Port 5000)..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

echo "⏳ Waiting 3 seconds for backend to initialize..."
sleep 3

echo "🚀 Starting Frontend Server (Auto port detection)..."
cd client
npm run dev &
CLIENT_PID=$!
cd ..

sleep 2

echo ""
echo "================================================"
echo "✅ Both servers are starting..."
echo ""
echo "🔗 Backend:  http://localhost:5000"
echo "🔗 Frontend: Check terminal output above for the actual port"
echo "   (Usually 3000, but may be 3001, 3002, etc. if port is busy)"
echo ""
echo "📝 To stop both servers, press Ctrl+C"
echo "================================================"

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $SERVER_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit
}

# Set up trap to handle Ctrl+C
trap cleanup INT

# Wait for both processes
wait
