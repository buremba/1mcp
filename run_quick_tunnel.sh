#!/bin/bash
# Run a quick/temporary tunnel (no setup required, but URL changes each time)

echo "=========================================="
echo "Quick Tunnel (Temporary URL)"
echo "=========================================="
echo ""
echo "⚠️  Note: This creates a TEMPORARY tunnel"
echo "   - URL will be different each time"
echo "   - URL dies when you stop the tunnel"
echo "   - For permanent URLs, use setup_persistent_tunnel.sh"
echo ""

echo "Starting HTTP server on port 8080..."
python3 simple_server.py &
SERVER_PID=$!

# Wait for server to start
sleep 2

echo ""
echo "Starting Cloudflare Quick Tunnel..."
echo "Watch for the public URL below:"
echo ""

# Start quick tunnel
./cloudflared tunnel --url http://localhost:8080

# Cleanup on exit
kill $SERVER_PID 2>/dev/null
