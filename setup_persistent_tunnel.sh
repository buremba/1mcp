#!/bin/bash
# Setup a persistent Cloudflare Tunnel with a permanent URL
# This requires a free Cloudflare account

set -e

echo "=========================================="
echo "Cloudflare Persistent Tunnel Setup"
echo "=========================================="
echo ""
echo "This will create a tunnel that:"
echo "  - Has a permanent URL"
echo "  - Survives restarts"
echo "  - Can use custom domains"
echo ""
echo "Prerequisites:"
echo "  1. A Cloudflare account (free)"
echo "  2. A domain managed by Cloudflare (optional)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Step 1: Login to Cloudflare
echo ""
echo "Step 1: Authenticating with Cloudflare..."
echo "A browser window will open. Please login to your Cloudflare account."
./cloudflared tunnel login

# Step 2: Create a named tunnel
echo ""
read -p "Enter a name for your tunnel (e.g., 'my-app'): " TUNNEL_NAME
echo "Creating tunnel: $TUNNEL_NAME"
./cloudflared tunnel create "$TUNNEL_NAME"

# Get tunnel ID
TUNNEL_ID=$(./cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "Tunnel created with ID: $TUNNEL_ID"

# Step 3: Create config file
echo ""
echo "Creating tunnel configuration..."
cat > cloudflared-config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: /home/user/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: CHANGE_ME.example.com
    service: http://localhost:8080
  - service: http_status:404
EOF

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Configuration file created: cloudflared-config.yml"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit cloudflared-config.yml and change 'CHANGE_ME.example.com' to your domain"
echo ""
echo "2. Route DNS to your tunnel:"
echo "   ./cloudflared tunnel route dns $TUNNEL_NAME yourdomain.example.com"
echo ""
echo "3. Run the tunnel:"
echo "   ./cloudflared tunnel --config cloudflared-config.yml run $TUNNEL_NAME"
echo ""
echo "Or use the helper script:"
echo "   ./run_persistent_tunnel.sh"
echo ""
