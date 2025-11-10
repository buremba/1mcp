# Cloudflare Tunnel Setup

This directory contains a simple HTTP server and Cloudflare Tunnel setup.

## What's Included

1. **cloudflared** - The Cloudflare Tunnel client (version 2025.11.1)
2. **simple_server.py** - A simple Python HTTP server
3. **start_tunnel.sh** - Script to start both the server and tunnel together

## Quick Start

### Option 1: Run Server Only

```bash
python3 simple_server.py
```

This starts the server on `http://localhost:8080`

### Option 2: Run Server with Cloudflare Tunnel

```bash
./start_tunnel.sh
```

This will:
- Start the HTTP server on port 8080
- Create a Cloudflare Tunnel that exposes it to the internet
- Generate a temporary public URL (e.g., `https://random-name.trycloudflare.com`)

The tunnel uses Cloudflare's "Quick Tunnel" feature which doesn't require authentication.

### Option 3: Manual Cloudflare Tunnel

```bash
# Start your server first
python3 simple_server.py

# In another terminal, start the tunnel
./cloudflared tunnel --url http://localhost:8080
```

## About the Simple Server

The HTTP server (`simple_server.py`) is a basic Python web server that:
- Listens on port 8080
- Responds with a friendly HTML page
- Shows the current path and timestamp
- Logs all requests

## About Cloudflare Tunnel

Cloudflare Tunnel (formerly Argo Tunnel) creates a secure connection between your local server and Cloudflare's edge network, allowing you to:
- Expose local services to the internet without opening ports
- Get HTTPS automatically
- Protect against DDoS attacks
- Use without authentication (Quick Tunnel mode)

## Advanced Usage

### Use with a specific port

```bash
# Start server on custom port
python3 -c "
from simple_server import run_server
run_server(port=3000)
"

# Tunnel to that port
./cloudflared tunnel --url http://localhost:3000
```

### Named Tunnels (Persistent)

For production use, you can create named tunnels with authentication:

```bash
# Login to Cloudflare
./cloudflared tunnel login

# Create a named tunnel
./cloudflared tunnel create my-tunnel

# Route traffic
./cloudflared tunnel route dns my-tunnel myapp.example.com

# Run the tunnel
./cloudflared tunnel run my-tunnel
```

## Files

- `cloudflared` - The tunnel client binary
- `simple_server.py` - Python HTTP server
- `start_tunnel.sh` - Combined startup script
- `cloudflared.deb` - Original debian package (can be removed)
- `cloudflared_extracted/` - Extracted files (can be removed)
