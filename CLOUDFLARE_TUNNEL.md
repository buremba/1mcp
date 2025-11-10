# Cloudflare Tunnel Setup

This directory contains a simple HTTP server and Cloudflare Tunnel setup.

## What's Included

1. **cloudflared** - The Cloudflare Tunnel client (version 2025.11.1)
2. **simple_server.py** - A simple Python HTTP server
3. **Quick tunnel scripts** - For temporary URLs (no setup required)
4. **Persistent tunnel scripts** - For permanent URLs (requires Cloudflare account)

## Tunnel Types: Quick vs Persistent

### Quick Tunnel (Temporary)
- ❌ **URL changes** - New random URL each time you start
- ❌ **Not persistent** - URL dies when tunnel stops
- ✅ **No setup** - No authentication required
- ✅ **Instant** - Start immediately
- 📝 **Best for:** Testing, demos, temporary shares

### Persistent Tunnel (Permanent)
- ✅ **Fixed URL** - Same URL every time
- ✅ **Survives restarts** - URL stays alive
- ✅ **Custom domains** - Use your own domain
- ⚠️ **Requires setup** - Need Cloudflare account (free)
- 📝 **Best for:** Production, permanent deployments

## Quick Start

### Option 1: Run Server Only

```bash
python3 simple_server.py
```

This starts the server on `http://localhost:8080`

### Option 2: Quick Tunnel (Temporary URL)

```bash
./run_quick_tunnel.sh
```

This will:
- Start the HTTP server on port 8080
- Create a temporary Cloudflare Tunnel
- Generate a public URL (e.g., `https://random-words-1234.trycloudflare.com`)
- **Note:** URL is different each time and dies when stopped

### Option 3: Persistent Tunnel (Permanent URL)

First-time setup (requires Cloudflare account):
```bash
./setup_persistent_tunnel.sh
```

Then run your tunnel anytime:
```bash
./run_persistent_tunnel.sh
```

Benefits:
- Same URL every time
- Survives restarts
- Can use custom domain (e.g., `myapp.example.com`)
- Production-ready

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

**Core Files:**
- `cloudflared` - The tunnel client binary
- `simple_server.py` - Python HTTP server

**Quick Tunnel (Temporary URLs):**
- `run_quick_tunnel.sh` - Start quick tunnel (no setup needed)
- `start_tunnel.sh` - Alias for run_quick_tunnel.sh

**Persistent Tunnel (Permanent URLs):**
- `setup_persistent_tunnel.sh` - One-time setup wizard
- `run_persistent_tunnel.sh` - Run persistent tunnel
- `cloudflared-config.yml` - Created during setup

**Installation Artifacts (gitignored):**
- `cloudflared.deb` - Original debian package
- `cloudflared_extracted/` - Extracted files
