# 1mcp

**MCP server with sandboxed JavaScript and Python execution using QuickJS and Pyodide.**

1mcp provides secure, isolated code execution for JavaScript and Python through the Model Context Protocol (MCP). It uses WebAssembly-based runtimes (QuickJS for JavaScript, Pyodide for Python) to execute code in a sandboxed environment with configurable security policies.

> ⚠️ **SECURITY WARNING:** This is pre-alpha software under active development. While WASM provides strong isolation, policy enforcement is not yet fully implemented. See [SECURITY.md](SECURITY.md) for detailed security assessment. **Not recommended for production use.**

## Features

- 🔒 **Sandboxed Execution** - Runs JavaScript (QuickJS) and Python (Pyodide) in isolated WASM environments
- 🛡️ **Policy Enforcement** - Network, filesystem, and resource limits with fine-grained control
- 🔌 **MCP Integration** - Acts as both MCP server and client to upstream MCP servers
- 📦 **Code Bundling** - Automatic bundling with esbuild for JavaScript dependencies
- ⚡ **Fast Startup** - Pre-initialized runtimes ready in ~10 seconds
- 🎯 **TypeScript Support** - Full type definitions for AI-assisted development

## Installation

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/1mcp.git
cd 1mcp

# Install dependencies and build
npm install
npm run build

# Set up environment (optional - defaults to examples/hello-world)
cp .env.example .env
# Edit .env to set PROJECT_DIR if needed

# Run the dev server
npm run serve

# Or use custom project directory
npm run 1mcp -- serve --dir my-project --no-ui
```

### Global Installation (Coming Soon)

```bash
npm install -g 1mcp
1mcp init
1mcp serve
```

## Quick Start

### For Local Development

```bash
# After cloning and building the project
npm run serve

# Or with a custom directory
npm run 1mcp -- init --dir my-project
npm run 1mcp -- serve --dir my-project --no-ui
```

### After Global Installation (Coming Soon)

```bash
mkdir my-project
cd my-project
npx 1mcp init
npx 1mcp serve --no-ui
```

3. **Execute code:**

```bash
# JavaScript
curl -X POST http://localhost:7800/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "run_js",
      "arguments": {
        "code": "console.log(\"Hello from JavaScript!\")"
      }
    }
  }'

# Python
curl -X POST http://localhost:7800/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "run_py",
      "arguments": {
        "code": "print(\"Hello from Python!\")"
      }
    }
  }'
```

## Configuration Format

The `1mcp.config.json` file controls security policies and MCP server connections:

```json
{
  "language": "js",
  "npm": {
    "dependencies": {},
    "lockfile": ""
  },
  "policy": {
    "network": {
      "allowedDomains": ["api.github.com", "*.npmjs.org", "api.context7.com"],
      "deniedDomains": [],
      "denyIpLiterals": true,
      "blockPrivateRanges": true,
      "maxBodyBytes": 5242880,
      "maxRedirects": 5
    },
    "filesystem": {
      "readonly": ["/"],
      "writable": ["/tmp", "/out"]
    },
    "limits": {
      "timeoutMs": 60000,
      "memMb": 256,
      "stdoutBytes": 1048576
    }
  },
  "mcps": [
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/private/tmp"]
    },
    {
      "name": "sentry",
      "transport": "http",
      "endpoint": "https://mcp.sentry.dev/mcp"
    },
    {
      "name": "context7",
      "transport": "http",
      "endpoint": "https://api.context7.com/mcp"
    }
  ],
  "sessionTtlMs": 300000,
  "signingKeyPath": ".1mcp/keys/",
  "cacheDir": ".1mcp/capsules/"
}
```

### Policy Options

- **network.allowedDomains** - Whitelist of domains (supports wildcards like `*.example.com`)
- **network.deniedDomains** - Blacklist of domains (takes precedence over allowlist)
- **network.denyIpLiterals** - Block direct IP addresses (e.g., `192.168.1.1`)
- **network.blockPrivateRanges** - Block RFC1918 private ranges
- **network.maxBodyBytes** - Maximum response body size
- **network.maxRedirects** - Maximum redirect hops

- **filesystem.readonly** - Read-only mount points
- **filesystem.writable** - Writable mount points

- **limits.timeoutMs** - Maximum execution time
- **limits.memMb** - Memory limit (informational)
- **limits.stdoutBytes** - Maximum stdout buffer size

## MCP Integration

1mcp acts as both an **MCP server** (exposing code execution tools) and an **MCP client** (connecting to upstream MCP servers).

### As MCP Server

Exposes two tools via JSON-RPC:

#### `run_js` - Execute JavaScript

```typescript
interface RunJsParams {
  code: string;              // JavaScript code to execute
  stdin?: string;            // Standard input
  args?: string[];           // Command-line arguments
  env?: Record<string, string>; // Environment variables
  cwd?: string;              // Working directory
  npm?: {
    dependencies: Record<string, string>; // NPM dependencies
  };
  policy?: Partial<Policy>;  // Override security policy
}
```

#### `run_py` - Execute Python

```typescript
interface RunPyParams {
  code: string;              // Python code to execute
  stdin?: string;            // Standard input
  args?: string[];           // Command-line arguments
  env?: Record<string, string>; // Environment variables
  cwd?: string;              // Working directory
  pip?: {
    requirements: string[];  // Python packages (pip format)
    wheelUrls?: string[];    // URLs to wheel files
  };
  policy?: Partial<Policy>;  // Override security policy
}
```

### As MCP Client

Connect to upstream MCP servers configured in `mcps` array:

**Stdio Transport:**
```json
{
  "name": "filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/private/tmp"]
}
```

**HTTP Transport:**
```json
{
  "name": "sentry",
  "transport": "http",
  "endpoint": "https://mcp.sentry.dev/mcp"
}
```

```json
{
  "name": "context7",
  "transport": "http",
  "endpoint": "https://api.context7.com/mcp"
}
```

**Call upstream tools:**

```bash
# List tools from upstream MCP server
curl http://localhost:7800/mcps/filesystem/tools

# Call a tool
curl -X POST http://localhost:7800/mcps-rpc \
  -H 'Content-Type: application/json' \
  -d '{
    "mcp": "filesystem",
    "tool": "read_text_file",
    "params": {
      "path": "/tmp/example.txt"
    }
  }'
```

## TypeScript Definitions for AI

1mcp provides comprehensive TypeScript definitions in `packages/shared/src/types/`:

- **`capsule.ts`** - Execution artifact types (Policy, Runtime, Capsule)
- **`mcp.ts`** - MCP protocol types (RunJsParams, RunPyParams, tool schemas)
- **`config.ts`** - Configuration file schema (RelayConfig)
- **`events.ts`** - Execution events (stdout, stderr, exit codes)

These types enable AI assistants to:
1. Validate configuration files
2. Generate correct tool call payloads
3. Understand policy constraints
4. Handle execution results properly

**Example usage in AI context:**

```typescript
import type { RunJsParams } from '@1mcp/shared';

// AI generates type-safe tool calls
const params: RunJsParams = {
  code: 'console.log("Hello, World!")',
  policy: {
    limits: {
      timeoutMs: 5000
    }
  }
};
```

## Exposed Tools

### Core Execution Tools

| Tool | Description | Runtime |
|------|-------------|---------|
| `run_js` | Execute JavaScript code | QuickJS WASM |
| `run_py` | Execute Python code | Pyodide WASM |

### Upstream MCP Tools (Example: filesystem)

When connected to `@modelcontextprotocol/server-filesystem`:

| Tool | Description |
|------|-------------|
| `read_text_file` | Read file contents |
| `write_file` | Write file contents |
| `list_directory` | List directory contents |
| `search_files` | Search for files |
| `get_file_info` | Get file metadata |
| `create_directory` | Create directory |
| `move_file` | Move or rename file |
| And 7 more... | See `/mcps/:name/tools` |

## CLI Reference

```bash
1mcp init [options]
  -c, --config <path>   Config file path (default: 1mcp.config.json)

1mcp serve [options]
  -c, --config <path>   Config file path (default: 1mcp.config.json)
  -p, --port <number>   Server port (default: 7800)
  --bind <address>      Bind address (default: 127.0.0.1)
  --no-ui               Headless mode (no browser UI)
  --open                Auto-open browser
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Client (AI)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓ JSON-RPC
┌─────────────────────────────────────────────────────────────┐
│                      1mcp Server                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ MCP Endpoint │  │   Capsule    │  │  MCP Client  │    │
│  │ (run_js/py)  │  │   Builder    │  │  (upstream)  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│          ↓                 ↓                   ↓           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Node Harness Executor                   │ │
│  │  ┌──────────────────┐   ┌──────────────────┐       │ │
│  │  │  QuickJS Runtime │   │  Pyodide Runtime │       │ │
│  │  │     (WASM)       │   │      (WASM)      │       │ │
│  │  └──────────────────┘   └──────────────────┘       │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Examples

### Complex JavaScript Execution

```javascript
// Fibonacci and prime number calculation
const code = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function isPrime(num) {
  if (num <= 1) return false;
  for (let i = 2; i * i <= num; i++) {
    if (num % i === 0) return false;
  }
  return true;
}

console.log('Fibonacci(10):', fibonacci(10));
console.log('Primes up to 20:',
  Array.from({length: 20}, (_, i) => i + 1)
    .filter(isPrime)
);
`;

// Execute via MCP
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "run_js",
    "arguments": { "code": code }
  }
}
```

### Python Data Processing

```python
import json
import math

# Process data
data = [1, 2, 3, 4, 5]
results = {
    'sum': sum(data),
    'mean': sum(data) / len(data),
    'squares': [x**2 for x in data],
    'sqrt_sum': math.sqrt(sum(data))
}

print(json.dumps(results, indent=2))
```

### Using MCP Filesystem Tools

```bash
# Create a file
curl -X POST http://localhost:7800/mcps-rpc \
  -H 'Content-Type: application/json' \
  -d '{
    "mcp": "filesystem",
    "tool": "write_file",
    "params": {
      "path": "/tmp/test.txt",
      "content": "Hello from 1mcp!"
    }
  }'

# Read it back
curl -X POST http://localhost:7800/mcps-rpc \
  -H 'Content-Type: application/json' \
  -d '{
    "mcp": "filesystem",
    "tool": "read_text_file",
    "params": {
      "path": "/tmp/test.txt"
    }
  }'
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run the example project
npm run serve

# Run with custom directory
npm run 1mcp -- serve --dir examples/hello-world --no-ui

# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run typecheck
```

### Available Scripts

- `npm run build` - Build all packages
- `npm run dev` - Development mode with watch
- `npm run serve` - Start server (uses PROJECT_DIR from .env)
- `npm run init` - Initialize project (uses PROJECT_DIR from .env)
- `npm run 1mcp -- <command>` - Run CLI directly with custom options

## Project Structure

```
1mcp/
├── packages/
│   ├── server/          # Main MCP server
│   │   ├── src/
│   │   │   ├── cli/     # CLI commands
│   │   │   ├── endpoints/  # HTTP endpoints
│   │   │   ├── harness/ # QuickJS & Pyodide runtimes
│   │   │   ├── services/  # Session & MCP management
│   │   │   └── capsule/ # Code bundling & signing
│   │   └── package.json
│   └── shared/          # Shared types & schemas
│       ├── src/types/   # TypeScript definitions
│       └── package.json
├── examples/
│   └── hello-world/     # Example project
└── README.md
```

## Security Considerations

⚠️ **Development Status:** Policy enforcement is partially implemented. See [SECURITY.md](SECURITY.md) for full security assessment and known issues.

**Current Security Features:**
- ✅ **WASM Sandbox** - QuickJS and Pyodide run in WebAssembly (strong isolation)
- ✅ **Ed25519 Signing** - All capsules are cryptographically signed
- ✅ **Virtual Filesystem** - Pyodide uses isolated virtual filesystem
- ⚠️ **Network Policies** - Configured but not yet enforced during execution
- ⚠️ **Filesystem Policies** - Defined but not enforced for file operations
- ⚠️ **Resource Limits** - Timeout and memory limits not yet enforced

**Performance:**
- Typical latency: 10-15ms (after warmup)
- First request: ~100ms (capsule building overhead)
- Pyodide initialization: ~10 seconds (one-time on startup)

**For detailed security analysis, attack vectors, and recommendations, see [SECURITY.md](SECURITY.md).**

## Troubleshooting

**Pyodide initialization takes long:**
- First startup takes ~10 seconds to load Pyodide
- Subsequent executions are fast (~30ms)
- Pre-initialization happens on server start

**"Module not found" errors:**
- JavaScript: Use `npm.dependencies` in RunJsParams
- Python: Use `pip.requirements` in RunPyParams
- Dependencies are bundled into the execution capsule

**Network requests blocked:**
- Check `policy.network.allowedDomains` in config
- Ensure domain wildcards are correct (e.g., `*.example.com`)
- Verify IP literal and private range policies

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.
