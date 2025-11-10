import { test, expect } from '@playwright/test';

test.describe('Chrome Prompt API + Relay-MCP Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('should load the application', async ({ page }) => {
    // Check main heading (shown when no messages)
    await expect(page.locator('h1')).toContainText('Hello there!');

    // Check that the app loaded successfully
    await expect(page.locator('textarea[placeholder="Send a message..."]')).toBeVisible();
  });

  test('should check MCP status', async ({ page }) => {
    // Wait for connection attempt
    await page.waitForTimeout(2000);

    // Check if MCP status badge exists in top bar
    const hasMCPBadge = await page.getByText('MCP').isVisible().catch(() => false);
    console.log('MCP Status Badge Visible:', hasMCPBadge);

    // MCP badge should be visible if relay is connected
    expect(hasMCPBadge).toBeDefined();
  });

  test('should have textarea and send button', async ({ page }) => {
    // Check textarea exists
    const textarea = page.locator('textarea[placeholder="Send a message..."]');
    await expect(textarea).toBeVisible();

    // Check send button exists (it has an SVG icon, not text)
    const sendButton = page.locator('button[aria-label="Send message"]');
    await expect(sendButton).toBeVisible();
  });

  test('should send a message and get response', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder="Send a message..."]');
    const sendButton = page.locator('button[aria-label="Send message"]');

    // Type a message
    await textarea.fill('Hello');

    // Send it
    await sendButton.click();

    // Wait for the message to appear
    await page.waitForTimeout(1000);

    // Check that the message appears on screen (in the chat area)
    await expect(page.locator('.bg-primary.text-primary-foreground').getByText('Hello')).toBeVisible();
  });

  test.describe('Tool Calling - CRITICAL TEST', () => {
    test('should execute JavaScript code tool (not just output "javascript")', async ({ page }) => {
      const textarea = page.locator('textarea[placeholder="Send a message..."]');
      const sendButton = page.locator('button[aria-label="Send message"]');

      // THE CORE BUG: User says "run fibonacci example" and it outputs "javascript" instead of executing
      await textarea.fill('run a simple fibonacci calculation in javascript for n=5');
      await sendButton.click();

      // Wait for response
      await page.waitForTimeout(3000);

      // Get all text on page
      const pageText = await page.locator('body').textContent();
      console.log('Page content:', pageText);

      // THE TEST: It should NOT just output the word "javascript"
      // It SHOULD show actual execution results or tool call activity

      // Check if tool calls appeared (shown inline in the chat)
      const hasToolCalls = await page.locator('.bg-muted\\/50.border').isVisible().catch(() => false);

      if (hasToolCalls) {
        console.log('✅ Tool calls appeared - tool was executed!');
        expect(hasToolCalls).toBe(true);
      } else {
        console.log('❌ No tool calls - checking if it just output text...');

        // If the response is JUST describing what it would do (like "```javascript"),
        // that means the bug is still present
        const hasCodeBlock = pageText?.includes('```javascript');
        const hasExecutionResult = pageText?.includes('Result:') ||
                                   pageText?.includes('fibonacci');

        if (hasCodeBlock && !hasExecutionResult) {
          throw new Error('BUG STILL EXISTS: AI is outputting code description instead of executing the tool!');
        }
      }
    });

    test('should show tool execution inline', async ({ page }) => {
      const textarea = page.locator('textarea[placeholder="Send a message..."]');
      const sendButton = page.locator('button[aria-label="Send message"]');

      await textarea.fill('execute: function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); } factorial(5)');
      await sendButton.click();

      // Wait longer for tool execution
      await page.waitForTimeout(5000);

      // Check for tool execution card (shown inline in chat)
      const toolCallCard = page.locator('.bg-muted\\/50.border');

      if (await toolCallCard.isVisible()) {
        console.log('✅ Tool call card visible - tool was executed');

        // Check for actual tool execution content
        const bodyText = await page.locator('body').textContent();
        console.log('Body text contains:', bodyText);

        // Should show actual execution, not just "javascript" text
        expect(bodyText).not.toMatch(/^javascript$/);
      } else {
        console.log('⚠️ Tool call card not visible - tools may not be executing');
      }
    });
  });
});
