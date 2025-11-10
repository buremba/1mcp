#!/bin/bash
# Run a persistent tunnel (must be set up first with setup_persistent_tunnel.sh)

if [ ! -f "cloudflared-config.yml" ]; then
    echo "Error: cloudflared-config.yml not found!"
    echo "Please run ./setup_persistent_tunnel.sh first"
    exit 1
fi

# Extract tunnel name from config
TUNNEL_ID=$(grep "^tunnel:" cloudflared-config.yml | awk '{print $2}')

if [ -z "$TUNNEL_ID" ]; then
    echo "Error: Could not find tunnel ID in cloudflared-config.yml"
    exit 1
fi

echo "Starting HTTP server on port 8080..."
python3 simple_server.py &
SERVER_PID=$!

# Wait for server to start
sleep 2

echo ""
echo "Starting persistent Cloudflare Tunnel..."
echo ""

# Start the tunnel
./cloudflared tunnel --config cloudflared-config.yml run

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
