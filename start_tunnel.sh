#!/bin/bash
# Start the simple HTTP server and expose it via Cloudflare Tunnel

echo "Starting simple HTTP server on port 8080..."
python3 simple_server.py &
SERVER_PID=$!

# Wait for server to start
sleep 2

echo ""
echo "Starting Cloudflare Tunnel..."
echo "This will create a temporary public URL for your local server"
echo ""

# Start cloudflare tunnel (quick tunnel - no login required)
./cloudflared tunnel --url http://localhost:8080

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
