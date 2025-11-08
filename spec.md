relay-mcp — Final Technical Spec (v1.3)

This is the definitive blueprint for relay-mcp. It covers architecture, data flow, transports, artifacts, security, and the exact npm dependencies. It's designed so an engineer (or coding agent) can implement without guessing.

CHANGELOG v1.3 (2025-11-06):
- Resolved all 25 specification gaps (see SPEC_UPDATES.md)
- Added concurrency model: FIFO queue, single execution at a time
- Added error recovery: auto-retry 3x with exponential backoff, then Node fallback
- Added JWT session tokens with 5min expiry, Ed25519 signed
- Added --no-ui flag for headless mode (Node harness only, no browser)
- Added capsule size limits: Code 2MB, Deps 20MB, Total 22MB
- Added browser compatibility: Chrome 102+, Safari 17+, Firefox 111+, IndexedDB fallback
- Added graceful shutdown: 30s grace period, cancel in-flight
- Specified Python wheel handling: pre-install during build, importlib at runtime
- Specified OPFS ↔ WASM bridge: Emscripten FS API
- Added CSP headers (no COOP/COEP for v1)
- Added source maps support (optional --sourcemaps flag)
- Removed /mcps special files, use /mcps-rpc endpoint only
- Added formal project structure based on peerbot monorepo pattern

CHANGELOG v1.2 (2025-11-06):
- Added §1.3: Browser Dual Role Architecture - browser acts as both MCP client AND execution target
- Added OPFS (Origin Private File System) documentation - browser's persistent workspace
- CORS wildcard on POST /mcp - enables browser to call MCP endpoint directly
- Clarified VFS backing: browser uses OPFS, server uses real filesystem
- Browser can initiate operations (Role 1: Client) for local file browsing/search
- External clients route ALL operations to browser when attached (Role 2: Target)
- Added flow diagram §3.3 for browser-as-client scenario
- Updated component diagram to show dual-role architecture
- CLI UX: auto-open browser on serve (--no-open to disable)
- Minimal v1 UI: blank page with browser console logging for all events
- Detailed console logging specs for both server (CLI) and browser
- Startup sequence: key generation → server start → browser auto-connect

CHANGELOG v1.1 (2025-11-06):
- Added §1.4: MCP Integration Details - defines /mcps-rpc endpoint and TypeScript definition generation
- Added §1.5: Runtime Distribution - specifies CDN strategy with SRI for QuickJS/Pyodide
- Added read/write/search tool schemas to §5.2 - first-class MCP tools for filesystem operations
- Updated relay.config.json with sessionTtlMs, signingKeyPath, cacheDir, and transport field for MCPs
- Enhanced Security Model (§9) with policy intersection rules, auth model, and limit enforcement details
- Updated Build Pipeline (§6) with cache location, stdin injection, and build error handling
- Updated Harness Responsibilities (§7) with Browser Cache API and /mcps-rpc proxy details
- Updated CLI (§12) with --bind flag, Docker detection, and first-run key generation
- Enhanced flow diagrams (§3, §4) to show /mcps-rpc interactions
- Resolved 12 critical open items in §18

0) What we're building

A single MCP server users can start with:

npx relay-mcp init      # writes relay.config.json
npx relay-mcp serve     # serves the UI and exposes the MCP endpoint


User experience on serve:
1. Server starts at http://127.0.0.1:7800
2. Browser auto-opens to /
3. Browser shows blank/minimal page, logs to console: "relay-mcp: Connected to server (session: abc123)"
4. Browser console logs: "relay-mcp: Ready. Waiting for execution requests..."
5. External MCP client (e.g., Claude) connects to POST http://127.0.0.1:7800/mcp
6. Claude calls run_js → server builds capsule → sends to browser
7. Browser console logs: "relay-mcp: Executing capsule 5f3a2... (language: js)"
8. Browser executes in WASM, streams results back
9. Claude receives streaming response with stdout/stderr/exit
10. Browser console logs: "relay-mcp: Execution completed (exitCode: 0, runtime: 1.2s)"

The MCP endpoint uses Streamable HTTP (no WebSockets).

A website at / auto-opens on serve. In v1, it's a blank/minimal page that logs all activity to the browser console (connection, execution, errors). Visual UI with settings/status display can be added in v2.

On each tool call (run_js, run_py), we build a WASM capsule and:

If a browser tab is attached: stream the capsule to that tab; the browser executes it (QuickJS / Pyodide) and streams results back.

If no browser: server fallback executes the same capsule locally (Node harness) and streams results back.

Optional managed/Cloudflare mode runs the same design with Workers + Durable Objects.

We do not add extra “tools” beyond your existing ones (run_js, run_py, plus read, write, search). 
The filesystem the sandbox will be based on the directories mounted, mcps etc.

1) Key concepts
1.1 Capsule (portable run artifact)

A signed manifest (capsule.json) + zipped FS layers.

The code does not rely on Node built-ins or native Python extensions.

Executed by a runtime WASM (QuickJS for JS, Pyodide for Python).

capsule.json

{
  "version": "1",
  "language": "js" | "py",
  "runtime": { "id": "quickjs@2025-10" | "pyodide@0.27" },
  "entry": { "path": "/entry.js", "argv": [], "env": {}, "cwd": "/" },
  "fsLayers": [
    { "id": "code", "sha256": "<sha>", "path": "fs.code.zip" },
    { "id": "deps", "sha256": "<sha>", "path": "fs.deps.zip" }
  ],
  "policy": {
    "network": {
      "allowedDomains": ["api.github.com", "*.npmjs.org"],
      "deniedDomains": [],
      "denyIpLiterals": true,
      "blockPrivateRanges": true,
      "maxBodyBytes": 5242880,
      "maxRedirects": 5
    },
    "filesystem": { "readonly": ["/"], "writable": ["/tmp", "/out"] },
    "limits": { "timeoutMs": 60000, "memMb": 256, "stdoutBytes": 1048576 }
  },
  "sig": "<JWS over the manifest>"
}

1.2 VFS (virtual filesystem) visible to the runtime
/
  mcps/                 # synthetic tree: upstream MCPs as files
  host/                 # local mounts (see below)
  tmp/                  # writable tmp
  out/                  # writable output


Special files: /mcps/<srv>/tools/<tool>/invoke

Write params.json → server performs upstream MCP tools/call

Read result.json → server returns upstream result

VFS backing storage by context:

Browser (OPFS - Origin Private File System):
  - /host/ maps to browser's OPFS root (persistent, sandboxed browser storage)
  - /tmp/, /out/ also backed by OPFS
  - Survives page refreshes within same origin
  - Isolated from host machine filesystem
  - Used when:
    * Browser calls POST /mcp directly (browser as client)
    * External client calls tools AND browser session is attached

Server (Node harness):
  - /host/ can bind to real filesystem paths (policy-guarded, OSS only)
  - /tmp/, /out/ map to actual temp directories
  - Used only when: external client calls tools AND no browser attached (fallback)

This dual-backing means browser has its own persistent workspace (OPFS), while server fallback uses real filesystem.

1.3 Browser Dual Role Architecture

The browser plays TWO distinct roles:

Role 1: MCP Client (browser-initiated operations)
  - Browser UI directly calls POST /mcp (enabled via CORS: Access-Control-Allow-Origin: *)
  - Use cases: file browsing, searching project files, local edits
  - Execution: Operations run on browser's OPFS (isolated, persistent storage)
  - Example: User clicks "Browse Files" → UI calls POST /mcp {tool: "search", pattern: "..."} → runs on OPFS

Role 2: Execution Target (external client-initiated operations)
  - External MCP client (e.g., Claude) calls POST /mcp
  - Server detects: browser session attached via POST /session
  - Server routes ALL operations (read/write/search/run_js/run_py) to browser
  - Browser receives capsule via SSE at /session/:id/events
  - Browser executes in WASM sandbox on OPFS
  - Results stream back via POST /session/:id/result
  - Example: Claude calls run_js → server → browser executes → Claude receives results

Key insight: When browser is attached, it becomes the execution environment for external clients.
This allows external MCP clients to "map their execution target" to a browser instance.

Session management:
  - Browser calls POST /session → receives sessionId + JWT attachToken (5min expiry, Ed25519 signed)
  - Opens SSE connection: GET /session/:id/events?token=...
  - Server marks this session as "browser attached"
  - External clients calling POST /mcp get routed to this browser
  - Browser disconnects → server falls back to Node harness

Concurrency model:
  - Single FIFO execution queue (one capsule at a time)
  - Multiple MCP clients can connect simultaneously
  - Requests queued in order, executed sequentially
  - If queue depth > 100: return HTTP 429 Too Many Requests
  - Queue entries older than 5min are auto-canceled

Error recovery:
  - SSE drop during capsule transfer: auto-retry 3x with exponential backoff (1s, 2s, 4s)
  - After 3 failures: fallback to Node harness
  - Browser crash mid-execution: cancel, stream error to MCP client
  - Network interruption: browser resumes with Range header
  - Graceful shutdown (SIGTERM): 30s grace period, cancel in-flight, close SSE

1.4 MCP Integration (upstream MCP servers)

MCPs are configured in relay.config.json with either HTTP or stdio transports.

For each configured MCP, the server generates a TypeScript definition file at:
  .relay/mcp/<name>.ts.d

This allows sandboxed code to discover available upstream tools via the read tool.

Invoking upstream MCPs:
Code running in the WASM sandbox invokes upstream MCP tools via a special RPC endpoint:

fetch('/mcps-rpc', {
  method: 'POST',
  body: JSON.stringify({
    mcp: 'search',              // name from relay.config.json
    tool: 'grep',               // tool name from MCP
    params: { pattern: '...' }  // tool parameters
  })
})

The server:
1. Validates the MCP name exists and tool is allowed
2. Proxies the request to the upstream MCP (via HTTP or stdio)
3. Returns the upstream result as JSON response
4. Applies policy limits (timeout, body size)

This design keeps upstream MCP credentials server-side and enforces policy at the relay layer.

1.5 Runtime Distribution (QuickJS & Pyodide)

Both browser and Node harnesses load WASM runtimes from CDN with Subresource Integrity.

QuickJS:
  Source: https://cdn.jsdelivr.net/npm/quickjs-emscripten@latest/dist/
  Files: quickjs-emscripten.wasm, quickjs-emscripten.js
  SRI: (to be determined during implementation - pin specific version)
  Fallback: https://unpkg.com/quickjs-emscripten@<version>/

Pyodide:
  Source: https://cdn.jsdelivr.net/pyodide/v0.27.0/full/
  Files: pyodide.js, pyodide.wasm, plus standard library packages
  SRI: (to be determined during implementation)
  Fallback: https://unpkg.com/pyodide@0.27.0/

Version pinning:
  - capsule.json runtime.id specifies exact version (e.g., "quickjs@2025-01" or "pyodide@0.27")
  - Harness loads the corresponding CDN URL based on runtime.id
  - SRI hashes are embedded in harness code for verification

Cache strategy:
  - Browser: Cache API with runtime.id as key
  - Node: optional disk cache in .relay/runtimes/ (same CDN URLs)

Offline mode:
  - Pre-populate cache by loading runtimes on first serve
  - Log warning if CDN is unreachable but cache is available

2) Transports & endpoints
2.1 MCP (Streamable HTTP)

Endpoint: POST /mcp

CORS: Access-Control-Allow-Origin: * (wildcard, public access)
  - Enables browser UI to call POST /mcp directly as an MCP client
  - External MCP clients can also connect from any origin
  - Preflight: Support OPTIONS with appropriate headers

Request body: JSON-RPC envelope per MCP spec.

Response body: Follows the official MCP Streamable HTTP specification exactly.
  - Streaming format as defined by MCP spec (likely NDJSON or SSE)
  - Progress events during capsule build: {"type":"progress","phase":"build-capsule"}
  - If build fails: stream error event then exit with non-zero code
  - Execution events: stdout, stderr, progress
  - Final event: {"type":"exit","exitCode":0,"usage":{...}}

Browser as MCP Client:
  - Browser UI can directly call POST /mcp for read/write/search operations
  - When browser calls these tools, they execute on browser's OPFS (Origin Private File System)
  - Browser acts as a first-class MCP client for its own local operations

External Client → Browser Execution:
  - When external MCP client calls ANY tool (read/write/search/run_js/run_py)
  - AND browser session is attached (via POST /session)
  - Server routes ALL operations to browser for execution
  - Browser executes in its sandbox/OPFS environment
  - Results stream back through session backchannel

Note: Refer to https://spec.modelcontextprotocol.io for exact wire format.

2.2 UI + execution channel (no WebSockets)

UI: GET / (static app + Web Worker bundle + runtime assets)

Minimal v1 UI specification:
  - Visual: Blank/minimal page is acceptable for v1
  - Browser console logging (console.log/info/warn/error) for status:
    * Session connection: "relay-mcp: Connected to server (session: abc123)"
    * Waiting state: "relay-mcp: Ready. Waiting for execution requests..."
    * Capsule received: "relay-mcp: Received capsule <hash> (language: js, size: 45KB)"
    * Runtime loading: "relay-mcp: Loading QuickJS runtime from CDN..."
    * Execution start: "relay-mcp: Executing capsule <hash>..."
    * Execution output: "relay-mcp: stdout: <line>" / "relay-mcp: stderr: <line>"
    * Execution complete: "relay-mcp: Execution completed (exitCode: 0, runtime: 1.2s)"
    * Errors: "relay-mcp: ERROR - Policy denied: domain not allowed: evil.com"
  - Optional: Display session ID and connection status in page title or small header
  - On page load: auto-connect to session (POST /session, then SSE)

Session control:

POST /session → { sessionId, attachToken }

GET /session/:id/events?token=... → SSE to the browser (commands): capsule, cancel, shutdown

POST /session/:id/result → NDJSON backchannel from browser to server with events: stdout, stderr, progress, exit, error

Capsule blobs:

GET /capsules/:hash/:file → streams capsule.json / fs.code.zip / fs.deps.zip (OSS: from disk; managed: from R2)

Upstream MCP proxy:

POST /mcps-rpc → proxy calls to upstream MCP servers
  Request: { "mcp": "<name>", "tool": "<tool>", "params": {...} }
  Response: JSON result from upstream MCP (or error)
  Used by sandboxed code to invoke upstream MCP tools securely

No WebSockets. SSE downstream + streaming POST upstream is enough.

3) End-to-end flows
3.1 Normal flow (browser attached)
Client (MCP)       relay-mcp Server               Browser (Tab)
     |                 |    / (UI)                      |
1) POST /mcp ---------->    |                          |
   {run_js}                 |                          |
     |                 2) build capsule                 |
     |                 3) SSE 'capsule' --------------> |  (EventSource)
     |                                                  | 4) Worker loads runtime + layers
     |                                                  |    runs JS/Py
     |                                                  | 5a) Code calls fetch('/mcps-rpc')
     |                 5b) POST /mcps-rpc <------------ |     {mcp:'search',tool:'grep',params}
     |                      proxy to upstream MCP       |
     |                 5c) return result -------------> |
     |                                                  | 6) continue execution
     |                 7) POST /session/:id/result <--- |  NDJSON stream: stdout/stderr/progress/exit
     | <====== stream response to /mcp =================|
     |                      final result                |

3.2 Fallback flow (no browser)
Client (MCP)       relay-mcp Server (Node harness)
     |                 |
POST /mcp  ----------> | 1) build capsule
     |                 | 2) run with QuickJS/Pyodide (same capsule)
     | <===== stream stdout/stderr/exit back to client

3.3 Browser as MCP Client (browser-initiated)
Browser (UI)       relay-mcp Server
     |                 |
1) POST /mcp ---------->    |
   {search}               | 2) detect: request FROM browser session
     |                    | 3) build capsule (or execute directly on browser's OPFS)
     |                    | 4) return to browser via same HTTP stream
     | <===== stream results back
     |
Note: Browser calls POST /mcp directly (CORS enabled), operates on its own OPFS

4) Sequence details (ASCII)
4.1 run_js request (Streamable HTTP)
Client                          Server                         Browser
------                          ------                         -------
POST /mcp: {method:"tools/call", tool:"run_js", params:{...}}
                                   |
                                   | buildCapsule(params)
                                   |
SSE (capsule)  --------------------------------------------->  onCapsule(manifest+urls)
                                   |                           |
                                   |                           | Worker: load runtime by manifest.runtime.id
                                   |                           |   (from CDN via Cache API)
                                   |                           | mount fsLayers; inject guarded fetch + VFS
                                   |                           | inject /mcps-rpc endpoint
                                   |                           | run /entry.js -> /app/bundle.js
                                   |                           |
                                   |                           | [optional: code calls upstream MCP]
                                   |  POST /mcps-rpc <--------- |   {mcp, tool, params}
                                   |  proxy to upstream ------> |
                                   |  return result <---------- |
                                   |                           |
                                   |                           | POST /session/:id/result (NDJSON)
                                   |<--------------------------- stdout/stderr/progress/exit
stream NDJSON back to client  <----|
close response with final JSON  ---|

5) Schema inputs
5.1 relay.config.json (created by init)
{
  "language": "js",                  // or "py"
  "npm": { "dependencies": {}, "lockfile": "" },      // JS only
  "pip": { "requirements": [], "wheelUrls": [] },     // Python only (wheel-only)
  "policy": {
    "network": {
      "allowedDomains": ["api.github.com", "*.npmjs.org"],
      "deniedDomains": [],
      "denyIpLiterals": true,
      "blockPrivateRanges": true,
      "maxBodyBytes": 5242880,
      "maxRedirects": 5
    },
    "filesystem": { "readonly": ["/"], "writable": ["/tmp","/out"] },
    "limits": { "timeoutMs": 60000, "memMb": 256, "stdoutBytes": 1048576 }
  },
  "mcps": [
    { "name": "search", "endpoint": "http://localhost:9001", "transport": "http" },
    { "name": "fs", "command": "mcp-server-filesystem", "args": [], "transport": "stdio" }
  ],
  "sessionTtlMs": 300000,            // optional: session cleanup after idle (default 5min)
  "signingKeyPath": ".relay/keys/",  // optional: JWS signing keys (auto-generated if missing)
  "cacheDir": ".relay/capsules/"     // optional: built capsule cache (default .relay/capsules/)
}

5.2 MCP tool calls

run_js

{
  "code": "console.log('hi')",
  "stdin": "",
  "args": [],
  "env": {},
  "cwd": "/",
  "npm": { "dependencies": { "lodash": "^4.17.21" } },
  "policy": { "... overrides allowed (intersected with server defaults) ..." }
}


run_py

{
  "code": "print('hi')",
  "stdin": "",
  "args": [],
  "env": {},
  "cwd": "/",
  "pip": { "requirements": ["requests==2.32.0"], "wheelUrls": [] },
  "policy": { "... overrides ..." }
}


read

{
  "path": "/host/myfile.txt",         // can be VFS (/tmp, /out) or host mount
  "encoding": "utf-8",                // optional: utf-8 (default), base64, or binary
  "maxBytes": 1048576                 // optional: limit read size (default 1MB)
}

Response:
{
  "content": "file contents...",
  "encoding": "utf-8",
  "size": 1234
}


write

{
  "path": "/out/result.json",         // must be writable per policy (/tmp, /out)
  "content": "{\"result\": 42}",
  "encoding": "utf-8",                // optional: utf-8 (default) or base64
  "mode": "create"                    // create (default), append, or overwrite
}

Response:
{
  "path": "/out/result.json",
  "bytesWritten": 16
}


search

{
  "pattern": "function.*export",      // grep-compatible regex pattern
  "paths": ["/host"],                 // directories to search (policy-enforced)
  "filePattern": "*.ts",              // optional: glob to filter files
  "caseSensitive": true,              // optional: default true
  "maxResults": 100                   // optional: limit results (default 100)
}

Response:
{
  "matches": [
    { "path": "/host/index.ts", "line": 42, "column": 5, "text": "export function..." },
    ...
  ],
  "totalMatches": 15,
  "truncated": false
}


Response (streamed, for run_js/run_py)
NDJSON events mirrored into MCP stream: stdout, stderr, progress, ending with:

{"type":"exit","exitCode":0,"usage":{"wallMs":1234,"memPeakMb":85}}

6) Build pipeline (capsule builder)

Cache location: .relay/capsules/ (configurable via relay.config.json)

Dependency validation:
  - JS: No pre-validation for native addons. If esbuild fails to bundle due to native dependencies, return error.
  - Python: Accept wheel-only deps (filename parsing: .whl extension, prefer py3-none-any or known pyodide-compatible)

JS path

Resolve npm deps from package request.

Bundle everything with esbuild → /app/bundle.js (ES2019, no Node built-ins).

Generate /entry.js:

import { installShims } from "/runtime/host.js";
await installShims();        // inject guarded fetch + VFS bindings + stdin
await import("/app/bundle.js");


stdin injection: if request has stdin param, installShims() sets up process.stdin readable stream.

Zip to fs.code.zip (+ fs.deps.zip only if not fully bundled).

Sign capsule.json (JWS with auto-generated Ed25519 key from .relay/keys/).

Stash capsule by content hash: .relay/capsules/<sha256>/

Python path

Accept wheel-only deps (e.g., py3-none-any or known pyodide-compatible).

Stage wheels under /wheels/*.whl.

Generate /entry.py:

import runpy, glob, sys, io
from micropip import install

# stdin injection: if request has stdin, make it available
if hasattr(sys, '_relay_stdin'):
    sys.stdin = io.StringIO(sys._relay_stdin)

for whl in glob.glob("/wheels/*.whl"):
    install(whl, keep_going=False)  # Note: verify micropip API in implementation

runpy.run_path("/app/main.py", run_name="__main__")


Zip to fs.code.zip (code + entry) and fs.deps.zip (wheels).

Sign capsule.json.

Content addressing: compute sha256 for each zip; cache capsules by {language, code, deps, policy} hash.

Build errors: stream progress events during build; if build fails, stream error event with details, then exit with non-zero code.

7) Harness responsibilities
Browser harness (Web Worker)

Runtime loading:
  - Load QuickJS/Pyodide WASM by runtime.id from CDN (jsDelivr/unpkg)
  - Cache using Browser Cache API (persistent across sessions)
  - Verify Subresource Integrity (SRI) hashes before execution

Build an in-memory overlay VFS from zips.

Inject policy-enforced fetch:
  - Deny IP literals (http://192.168.1.1)
  - Note: DNS resolution to private IPs NOT validated in v1 (deferred)
  - Re-validate each redirect hop (domain allowlist)
  - Cap body size and number of redirects

Provide /mcps-rpc endpoint for upstream MCP calls:
  - Worker posts to /mcps-rpc with {mcp, tool, params}
  - Server proxies to upstream MCP
  - Returns result to worker

Enforce limits:
  - Wall-time: setTimeout + worker.terminate() (hard kill)
  - Stdout bytes: cap at policy.limits.stdoutBytes, truncate if exceeded
  - Memory: best-effort only (policy.limits.memMb is a hint, not enforced)

Stream NDJSON events to /session/:id/result.

Node harness (server fallback)

Same interface and semantics as the browser harness; uses Node's undici for HTTP.

Uses the same runtimes:
  - quickjs-emscripten (WASM)
  - pyodide (Node-compatible ESM)

Runtime loading:
  - Load from CDN same as browser (can cache to disk for offline)
  - Same SRI verification

Strict limit enforcement:
  - Wall-time: enforced via runtime timeouts
  - Memory: WASM heap limits where available
  - Stdout: strict byte cap

8) Architecture diagrams
8.1 Component view
+--------------------+     Streamable HTTP     +---------------------------+
|   MCP Client(s)    | <---------------------> |       relay-mcp Server    |
| (External, e.g.    |    POST /mcp           |  - MCP /mcp (CORS: *)     |
|  Claude)           |                         |  - UI / (static)          |
+--------------------+                         |  - Session SSE/Backchannel|
                                               |  - Capsule builder/cache  |
                                               |  - /mcps-rpc proxy        |
                                               |  - Node harness fallback  |
                                               +-------------+-------------+
                                                             |
                                        SSE 'capsule'        | NDJSON result
                                        (Role 2: Target)     | POST /mcp (Role 1: Client)
                                                             |
                                                             v
                                               +---------------------------+
                                               |     Browser (Main Page)   |
                                               |  DUAL ROLE:               |
                                               |  1) MCP Client            |
                                               |     - Calls POST /mcp     |
                                               |     - OPFS operations     |
                                               |  2) Execution Target      |
                                               |     - Receives capsules   |
                                               |     - Web Worker harness  |
                                               |     - QuickJS/Pyodide     |
                                               +---------------------------+

8.2 Data flow (capsule)
code+deps+policy --> builder --> [fs.code.zip][fs.deps.zip] + capsule.json (JWS)
                                     |
                                     +--> to browser (or) --> Node harness

9) Security model

Double-enforcement of policy (browser + server):

Network:
  - Domain allowlist (wildcards supported: *.example.com)
  - Denied domains override allowed (deny beats allow)
  - IP literal blocking in URLs (e.g., http://192.168.1.1) enforced
  - Note: DNS resolution to private IPs (RFC1918/link-local/loopback) NOT blocked in v1 (deferred to v2)
  - Cap body size and redirect hops

Filesystem:
  - Only /tmp, /out writable by default
  - Everything else readonly
  - No path escapes (validated with realpath)
  - Host mounts (OSS only): explicit allowlists; deny overrides allow

Limits:
  - Server: strict enforcement (wall-time, stdout bytes, memory)
  - Browser: best-effort (setTimeout + worker termination for time; memory is hint only)

Authentication:
  - MCP endpoint (/mcp): localhost-only binding (127.0.0.1) by default
  - CORS: Access-Control-Allow-Origin: * (enables browser as MCP client)
  - No authentication required in v1 (trust the network model)
  - Security consideration: CORS wildcard + localhost binding means only same-machine access
    * External network access requires explicit --bind 0.0.0.0
    * In that case, consider adding auth in v2
  - Docker deployment: auto-detect and bind to 0.0.0.0 (container context)
  - Upstream MCP credentials: stored server-side, never in capsules

Policy intersection (client overrides):
  - Clients CAN override policies in run_js/run_py requests
  - Effective policy = min(server_default, client_override)
  - Clients can ONLY make policies MORE restrictive, never more permissive
  - Examples:
    - Server allows *.github.com → Client can restrict to api.github.com (allowed)
    - Server allows 60s timeout → Client can set 30s (allowed)
    - Server denies evil.com → Client cannot override (deny always wins)

Signing:
  - capsule.json is JWS-signed with Ed25519
  - Keys auto-generated on first run, stored in .relay/keys/
  - Both harnesses verify signature before execution

OSS host mounts (optional): explicit allowlists; deny overrides allow; realpath + symlink escape checks.

10) Error model (uniform)

ValidationError (schema) → 400

PolicyDenied (egress/FS rule) → 403

Timeout (deadline hit) → 408

OutputLimitExceeded → 413

DepsResolutionFailed → 424 (include redacted logs excerpt)

NoExecutorAttached (opted to require browser) → 425

Internal → 500

Each streamed response carries an error event then an exit with non-zero exitCode.

11) Observability

Structured logs (JSON): ts, runId, clientId, language, durationMs, exitCode, bytesOut.

Metrics: counters (runs, failures by type), histograms (build time, run time, stdout bytes).

Audit: policy denials, blocked redirects, IP resolutions that were rejected (hostname → IP redacted to /24).

12) Packaging & CLI

CLI (npx relay-mcp):

init → create relay.config.json (validated with ajv)

serve [-c file] [--port 7800] [--bind <addr>] [--no-open] [--no-ui] → start UI + MCP HTTP stream endpoint

  Startup sequence:
    1. First-run initialization (if needed):
       - Generate Ed25519 signing key pair if .relay/keys/ doesn't exist
       - Create .relay/capsules/ cache directory
       - Log key fingerprint for verification

    2. Start HTTP server:
       - Bind to address (see below)
       - Log: "relay-mcp server started at http://127.0.0.1:7800"
       - Log: "MCP endpoint: POST http://127.0.0.1:7800/mcp"

    3. Auto-open browser (unless --no-open):
       - Open http://127.0.0.1:7800/ in default browser
       - Browser auto-connects: calls POST /session, opens SSE connection
       - Log: "Browser session attached: <sessionId>"

  Bind address behavior:
    - Default: 127.0.0.1 (localhost only, safe for "trust the network" model)
    - Docker detection: if /.dockerenv exists OR DOCKER_CONTAINER=true, bind to 0.0.0.0
    - Explicit override: --bind 0.0.0.0 or --bind <ip>

  Headless mode (--no-ui flag):
    - Disables browser UI entirely
    - Does NOT auto-open browser
    - GET / returns JSON status instead of HTML
    - All executions use Node harness only (no browser)
    - Faster startup, lower resource usage
    - Suitable for server deployments, CI/CD
    - Example response:
      {
        "name": "relay-mcp",
        "status": "running",
        "mode": "headless",
        "executionMode": "node-harness-only",
        "endpoints": {
          "mcp": "POST http://127.0.0.1:7800/mcp"
        }
      }

  Console logging during operation:
    - MCP client connections: "MCP client connected from <origin>"
    - Tool invocations: "tools/run_js called by client <id>, routing to browser session <sessionId>"
    - Capsule builds: "Building capsule for run_js (sha256: abc123...)"
    - Execution events: "Browser executing capsule abc123... (stdout: 2.4KB, stderr: 0B, runtime: 1.2s)"
    - Errors: "Build failed: esbuild error - native addon detected in package 'sharp'"
    - Browser disconnect: "Browser session <sessionId> disconnected, falling back to Node harness"

Docker image for OSS:

non-root, read-only FS, --tmpfs /tmp, resource limits

Volumes:
  - Mount .relay/ for persistent cache and keys
  - Mount project directory for host mounts (if using)

Environment variables:
  - DOCKER_CONTAINER=true (auto-detected)
  - RELAY_BIND=0.0.0.0 (override bind address)

Managed/Cloudflare (appendix) uses the same capsules; adds Workers/DOs and R2 storage. (See §15)

13) Exact npm dependencies

Grouped by package. Pin versions in your package.json; versions omitted here on purpose.

packages/cli (Node 22+)

commander — CLI

kleur — pretty output (optional)

ajv, ajv-formats — validate config

nanoid — ids

pino — logging

packages/server (Node OSS server)

hono + @hono/node-server — HTTP server (SSE + streaming POST are easy)

undici — HTTP client for upstream MCP + guarded fetch

ajv, ajv-formats — validation

jose — JWS signing/verify (capsules)

fflate — zip streaming

pino — logging

(Dev) tsx — local dev

packages/capsule (builder)

esbuild — JS bundling

fflate — zip layers

jose — sign capsule.json

ajv — schema validation

packages/harness-browser

quickjs-emscripten — JS runtime WASM

pyodide — Python runtime WASM

fflate — unzip layers

(No undici; browser fetch is native)

packages/harness-node

quickjs-emscripten

pyodide

undici

fflate

packages/policy

tldts — robust domain parsing

ipaddr.js — private/IP literal checks

packages/vfs

(no external deps)

packages/shared

zod or typebox (optional) — extra runtime typing; ajv already used elsewhere

website (UI)

vite — build tool for browser bundle

Plain TS/DOM (no framework required for v1 minimal UI)

Optional for future: preact or similar lightweight framework

Browser console utilities for logging (built-in, no deps)

open — auto-open browser on serve (used by CLI)

Note: v1 UI is intentionally minimal (blank page + console logging). Visual UI can be added in v2.

cf (managed)

hono — Worker + Durable Object server

(No undici; Cloudflare has global fetch)

You can add cross-fetch as an isomorphic fallback if you want to reuse guard code in both environments.

14) Implementation checklist

 JSON Schemas: relay.config.json, capsule.json, NDJSON event shapes.

 MCP Streamable HTTP endpoint at /mcp (request parse → run state machine → streamed response).

 SSE at /session/:id/events and NDJSON backchannel at /session/:id/result.

 Capsule builder (JS via esbuild; Py wheel-only).

 Browser Worker harness (QuickJS, Pyodide, policy enforcement, VFS, /mcps special files).

 Node harness fallback (mirror of browser harness).

 VFS router + /mcps special file driver.

 Policy layer (guarded fetch + path policy; deny beats allow).

 UI (minimal v1: blank page + browser console logging; auto-connect on load).

 CLI auto-open browser on serve (unless --no-open).

 Caching (capsules by hash; runtime by runtime.id).

 Tests: unit + integration for both execution paths; policy denials; redirect chain enforcement.

15) Managed (Cloudflare) — appendix (how to deploy)

Bindings (wrangler):

DO: SESSIONS (per-session coordinator with WebSocket hibernation not required; we’re on SSE/HTTP)

R2: R2_CAPSULES (capsule blobs)

KV: KV_CONFIG (tenant defaults)

Endpoints:

POST /capsule/presign → signed PUT URLs for R2 (or accept direct upload via multipart)

POST /capsule/finalize → verify & sign manifest; return canonical capsuleUrl

GET /capsules/:hash/:file → stream from R2

POST /mcp → Streamable HTTP endpoint identical to OSS

GET /session/:id/events / POST /session/:id/result → same as OSS

Build without CI:

Default: client-build in the browser using esbuild-wasm; upload to R2 via presigned URLs; finalize/sign server-side.

Fallback: edge-build inside the DO with esbuild-wasm; keep hard size/time caps.

16) Hard limits & constraints

JS: bundle everything; no Node built-ins (fs, net, etc.); no native addons.

Python: wheel-only; no sdists; prefer py3-none-any or wheels proven to work with Pyodide.

Network: only http/https via guarded fetch; IP literals denied; private/link-local targets denied; every redirect hop re-validated.

FS: in-memory; only /tmp and /out writable; deny path escapes; denylist overrides allowlist.

Quotas: strict time, memory, and output caps; hard terminate on exceed.

No secrets inside capsules; any credentials live server-side with short TTL.

17) Example responses (stream fragments)

To MCP client (Streamable HTTP)

{"type":"progress","phase":"build-capsule"}
{"type":"stdout","chunk":"aGVsbG8K"}            // base64
{"type":"stderr","chunk":"bWluZXIgbm90IGFsbG93ZWQK"}
{"type":"exit","exitCode":0,"usage":{"wallMs":812,"memPeakMb":74}}


From browser to server (NDJSON backchannel)

{"runId":"r_1","type":"stdout","chunk":"..."}
{"runId":"r_1","type":"exit","exitCode":1,"error":"PolicyDenied: domain not allowed"}

18) Open items to lock before code freeze

✅ RESOLVED in v1.3 spec update:
  - All 25 specification gaps (see SPEC_UPDATES.md for details)
  - Concurrency: FIFO queue, single execution
  - Error recovery: 3x retry + Node fallback
  - Session tokens: JWT with 5min expiry
  - Capsule size limits: 2MB code, 20MB deps
  - Browser compat: Chrome 102+, Safari 17+, Firefox 111+
  - Headless mode: --no-ui flag
  - Python wheels: pre-install + importlib
  - OPFS bridge: Emscripten FS API
  - Security: CSP headers
  - Source maps: optional flag
  - Graceful shutdown: 30s grace period

✅ RESOLVED in v1.2 spec update:
  - Browser dual role: both MCP client (Role 1) and execution target (Role 2)
  - CORS on /mcp: wildcard enabled for browser client access
  - OPFS: browser's persistent workspace (isolated from host filesystem)
  - VFS backing: browser=OPFS, server=real filesystem
  - Browser-initiated operations: execute on browser's OPFS
  - External client operations: route to browser when attached

✅ RESOLVED in v1.1 spec update:
  - MCP invocation mechanism: /mcps-rpc endpoint
  - Authentication model: localhost-only, trust the network
  - Runtime distribution: CDN with SRI (jsDelivr/unpkg)
  - Policy intersection: min(server, client) - only more restrictive
  - Session cleanup: configurable TTL (sessionTtlMs)
  - Signing keys: auto-generated Ed25519 on first run
  - Cache location: .relay/capsules/
  - stdin handling: process.stdin / sys.stdin
  - Build errors: stream progress then error
  - Resource limits: strict on server, best-effort in browser
  - Bind address: smart detection (127.0.0.1 or 0.0.0.0)
  - read/write/search tools: added as first-class MCP tools

REMAINING for implementation:
  - Exact event names and field casing for NDJSON (follow MCP spec)
  - Capsule retention policy (suggest: 7 day TTL or 1GB cache limit with LRU)
  - Fallback policy when browser disconnects mid-run (recommend: cancel for v1)
  - Per-tenant limits (managed): concurrent runs, max capsule size, egress budgets
  - Wheel policy (Python): any py3-none-any for v1 (expand later)
  - UI behavior when multiple MCP clients attach (show all clients, isolate sessions)
  - Specific CDN URLs and SRI hashes for QuickJS/Pyodide versions

19) Reality check

The design is spec-compliant (Streamable HTTP only).

Browser and server execute the same capsule, so behavior is consistent.

Security is enforced twice.

OSS runs locally with npx or Docker. Managed/Cloudflare uses the same artifacts and endpoints.

Ship it.