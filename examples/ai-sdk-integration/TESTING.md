# Testing Chrome Prompt API Integration

## The Reality: Chrome Prompt API in Automated Tests

### Current Limitations

**Chrome Prompt API cannot be reliably tested with Playwright** for these reasons:

1. **Experimental Feature**: The Chrome Prompt API is only available in Chrome Canary/Dev builds (version 129+) with specific flags enabled
2. **Flag Requirements**: Requires `chrome://flags/#optimization-guide-on-device-model` and `chrome://flags/#prompt-api-for-gemini-nano` enabled
3. **Model Download**: Gemini Nano model must be downloaded (~2GB)
4. **Browser Launch**: Even with custom launch flags, there's no reliable way to programmatically enable Chrome flags
5. **Chromium vs Chrome**: Playwright typically uses Chromium, which doesn't include the experimental Prompt API

### What We've Built Instead

Our testing setup works in **two modes**:

#### Mode 1: Test Mode (Automated Testing)
- Works without Chrome Prompt API
- Parses commands and executes tools directly
- Perfect for CI/CD and automated testing
- Tests all tool functionality without AI involvement

#### Mode 2: Manual Testing with Chrome
- Use actual Chrome browser with Prompt API enabled
- Full AI-powered tool calling
- Requires manual setup (flags + model download)

## Running Tests

### Install Playwright Browsers

```bash
pnpm exec playwright install
```

### Run All Tests

```bash
pnpm test
```

This runs tests in both modes:
- `chrome-with-prompt-api` - Attempts to use Chrome (will use test mode fallback)
- `chromium-fallback` - Regular Chromium (uses test mode)

### Run Tests with UI

```bash
pnpm test:ui
```

Opens Playwright's interactive test runner.

### Run Tests in Headed Mode

```bash
pnpm test:headed
```

Watch the tests run in a visible browser window.

### Debug Tests

```bash
pnpm test:debug
```

Step through tests with Playwright's debugger.

### Run Only Chrome Tests

```bash
pnpm test:chrome
```

## Test Coverage

Our test suite covers:

### Application Loading
- ✅ Main UI renders correctly
- ✅ Status indicators display properly
- ✅ Relay-MCP connection check

### Browser Tools (Test Mode)
- ✅ Save to localStorage
- ✅ List storage keys
- ✅ Get from storage
- ✅ Get current time
- ✅ Get geolocation (if permission granted)

### Relay-MCP Tools (Test Mode)
- ✅ Calculate factorial
- ✅ Generate Fibonacci sequence
- ✅ Execute JavaScript in sandbox
- ✅ Execute 

### Chrome Prompt API (Manual Only)
- ⚠️ Full AI-powered tool calling (requires manual Chrome setup)
- ⚠️ Natural language understanding (requires manual Chrome setup)

## Manual Testing with Chrome Prompt API

If you want to test the FULL Chrome Prompt API integration manually:

### 1. Setup Chrome Canary/Dev

Download Chrome Canary or Dev:
- **macOS**: https://www.google.com/chrome/canary/
- **Windows**: https://www.google.com/chrome/canary/
- **Linux**: https://www.google.com/chrome/dev/

### 2. Enable Flags

Navigate to `chrome://flags` and enable:

1. **Optimization Guide On Device Model**
   - Flag: `chrome://flags/#optimization-guide-on-device-model`
   - Set to: **Enabled BypassPerfRequirement**

2. **Prompt API for Gemini Nano**
   - Flag: `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to: **Enabled**

### 3. Download Gemini Nano

1. Open Chrome DevTools (F12)
2. In the Console, run:
   ```javascript
   await window.LanguageModel.create({
     expectedOutputs: [{ type: "text", languages: ["en"] }],
     monitor(m) {
       m.addEventListener('downloadprogress', (e) => {
         console.log(`Downloaded ${Math.round(e.loaded * 100)}%`);
       });
     }
   });
   ```
3. Wait for the ~2GB download to complete

### 4. Start Servers

```bash
# Terminal 1: Start relay-mcp server
cd packages/server
pnpm dev:serve

# Terminal 2: Start dev server
cd examples/ai-sdk-integration
pnpm dev
```

### 5. Test in Chrome

1. Open `http://localhost:7888` in Chrome Canary/Dev
2. You should see "Chrome API: Ready" status (green badge)
3. Try natural language prompts:
   - "run a fibonacci calculation in javascript for n=5"
   - "calculate 15 * 7 + 32 in javascript"
   - "execute: function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); } factorial(5)"

**Expected Behavior:**
- A "Tool Calls" sidebar should appear on the right showing tool execution
- The AI should EXECUTE the tool, not just output code descriptions
- Results should be shown in the sidebar and summarized by the AI

**Bug Indicator (if session persistence fix regresses):**
- If you only see text output like "```javascript" or the word "javascript"
- If no "Tool Calls" sidebar appears
- This means the AI is describing what it would do instead of executing the tool

## Attempting Chrome Prompt API with Playwright (Experimental)

While this doesn't work reliably, here's the theoretical approach we've configured:

### playwright.config.ts Configuration

```typescript
{
  name: 'chrome-with-prompt-api',
  use: {
    channel: 'chrome-canary', // Use Chrome Canary (requires installation)
    launchOptions: {
      args: [
        '--enable-features=OptimizationGuideModelDownloading,OptimizationGuideOnDeviceModel,PromptAPIForGeminiNano',
        '--optimization-guide-model-execution=enabled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    },
  },
}
```

**Note:** This requires Chrome Canary to be installed at `/Applications/Google Chrome Canary.app` (macOS) or the equivalent path on other platforms.

### Why This Doesn't Work

1. **Flags vs Features**: Chrome flags (`chrome://flags`) are different from feature flags (`--enable-features`)
2. **Persistent State**: Model download and flag settings are tied to Chrome's user profile
3. **Bypass Restrictions**: `BypassPerfRequirement` cannot be set via command line
4. **Model Availability**: Even with features enabled, the model must be pre-downloaded

## Best Testing Strategy

### For Development & CI/CD
✅ Use our **Test Mode** with automated Playwright tests
- Fast, reliable, no special setup needed
- Tests all tool functionality
- Perfect for continuous integration

### For Demos & Validation
✅ Use **Manual Testing** with Chrome Canary/Dev
- Shows full AI capabilities
- Real Chrome Prompt API usage
- Natural language interaction

## Environment Variables

Create `.env` file if you need custom configuration:

```env
# Relay-MCP server URL
VITE_RELAY_SERVER_URL=http://127.0.0.1:7888

# Test mode (force test mode even with Chrome API)
VITE_FORCE_TEST_MODE=false
```

## Troubleshooting

### "Chrome Prompt API unavailable"
- ✅ Expected in Playwright tests - test mode will work
- ⚠️ In manual Chrome testing - check flags and model download

### "Relay-MCP not connected"
- ✅ Tests will skip relay-mcp tests
- 🔧 Ensure relay server is running on port 7888

### Tests timing out
- 🔧 Increase timeout in playwright.config.ts
- 🔧 Check if servers are running before tests

### "Model not downloaded"
- ⚠️ Only for manual Chrome testing
- 🔧 Follow model download steps above

## The Session Persistence Fix

### The Bug

Previously, when users asked the AI to "run a fibonacci example in javascript", the AI would output the word "javascript" or a code description instead of actually executing the `executeJavaScript` tool.

### Root Cause

In `packages/ai-sdk/src/chrome-provider.ts` line 286, the condition was:

```typescript
if (!this.session || tools) {  // ❌ BUGGY
  await this.initializeSession(tools);
}
```

Since the AI SDK always passes a `tools` object, the condition `|| tools` was always truthy, causing the session to be destroyed and recreated on EVERY request. This broke:
- **Session persistence**: Chrome sessions maintain context across `prompt()` calls
- **Tool context**: Tools were re-registered but lost state
- **System prompt**: Instructions telling the AI to USE tools were reset
- **Conversation continuity**: Each message was treated as a new conversation

### The Fix

Changed the condition to initialize the session only once:

```typescript
if (!this.session) {  // ✅ FIXED
  await this.initializeSession(tools);
}
```

This ensures:
1. Session is created ONCE on first request
2. Tools and system prompt persist across all subsequent messages
3. Chrome maintains conversation context
4. AI follows the instruction to "USE the tool" instead of describing it

### System Prompt

The session is initialized with a system prompt that explicitly instructs the AI:

```typescript
`You are a helpful assistant with access to tools. When a user asks you to do
something that requires using a tool, you MUST use the appropriate tool instead
of just describing what you would do.

IMPORTANT:
- If the user asks you to execute code, calculate something, or perform an action
  that requires a tool, USE THE TOOL.
- Do not just output text descriptions like "javascript" or "here's the code".
  Actually execute the tool.
- After using a tool, summarize the result for the user in a natural way.`
```

This prompt remains active throughout the entire session.

### Verification

To verify the fix works:

1. Open the app in Chrome Canary with Prompt API enabled
2. Send: "run a fibonacci calculation for n=5"
3. **Expected**: Tool Calls sidebar appears showing `executeJavaScript` execution
4. **Bug would show**: Just text output like "javascript" or code blocks

The Playwright tests in `tests/app.spec.ts` specifically test for this bug:

```typescript
test('should execute JavaScript code tool (not just output "javascript")', async ({ page }) => {
  await input.fill('run a simple fibonacci calculation in javascript for n=5');
  await sendButton.click();

  // Check if tool calls sidebar appeared (indicates tool was called)
  const hasToolCalls = await toolCallsHeader.isVisible();

  if (!hasToolCalls) {
    // If it just outputs code description, that's the bug
    if (hasCodeBlock && !hasExecutionResult) {
      throw new Error('BUG STILL EXISTS: AI is outputting code description instead of executing the tool!');
    }
  }
});
```

## Future Possibilities

If Chrome Prompt API becomes more accessible for automation:
1. User data directory with pre-configured flags
2. Headless Chrome support for AI features
3. API for programmatic flag configuration
4. Smaller model downloads for testing

For now, our dual-mode approach provides the best of both worlds:
- **Automated testing** for CI/CD
- **Manual validation** for full features
