import { test, expect } from '@playwright/test';

test.setTimeout(90000); // Increase default timeout for the entire test

test('Happy Path: Mission Creation and Launch', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 1. Navigate to Home
  await page.goto('http://localhost:5174/'); // Updated URL
  await page.waitForLoadState('networkidle'); // Wait for network to be idle
  await expect(page).toHaveTitle(/Agent OS/);

  // Wait for the navigation links to be visible
  await expect(page.locator('a:has-text("Knowledge")')).toBeVisible();
  await expect(page.locator('a:has-text("Setup")')).toBeVisible();
  await expect(page.locator('a:has-text("Monitor")')).toBeVisible();

  // Take a screenshot for debugging
  await page.screenshot({ path: 'playwright-debug-before-knowledge-click.png' });

  // 2. Knowledge Base Interaction (Manual Entry)
  await page.click('a:has-text("Knowledge")'); // Use Link for navigation
  await expect(page.locator('h2:has-text("Manual Entry")')).toBeVisible();

  // Fill Manual Entry
  await page.fill('input[placeholder="Source Name (e.g. \'Wiki\')"]', 'Test Source');
  await page.fill('textarea[placeholder="Paste text content..."]', 'This is some test content for the knowledge base.');
  
  // Wait for the API call to complete
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/knowledge') && res.request().method() === 'POST'),
    page.click('button:has-text("Save to Memory")')
  ]);
  expect(response.status()).toBe(200);

  // Verify it appears in the list
  await expect(page.locator('span.font-medium:has-text("Test Source")')).toBeVisible();

  // 3. Mission Setup
  await page.click('a:has-text("Setup")'); // Use Link for navigation
  await expect(page.locator('label:has-text("Mission Goal")')).toBeVisible();

  // Fill Mission Goal
  const goalInput = page.locator('textarea[placeholder*="Describe your mission"]');
  await goalInput.fill('Test Mission: Analyze the current state of AI and write a summary.');

  // Click Generate Plan and wait for the API response
  const [planResponse] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/plan') && res.request().method() === 'POST'),
    page.click('button:has-text("Generate Plan")')
  ]);
  expect(planResponse.status()).toBe(200);
  const planData = await planResponse.json();
  expect(planData.plan).toBeInstanceOf(Array);
  expect(planData.plan.length).toBeGreaterThan(0);
  expect(planData.narrative).toBeDefined();

  // Expect the "Plan" to appear (Launch button becomes visible)
  const launchButton = page.locator('button:has-text("Launch Mission")');
  await expect(launchButton).toBeVisible({ timeout: 15000 });

  // 4. Launch Mission
  await launchButton.click();

  // 5. Monitor
  await expect(page.locator('span.uppercase:has-text("Live Terminal")')).toBeVisible();
  
  // Wait for some logs to appear, indicating the mission has started
  await expect(page.locator('.font-mono.space-y-4.bg-white div.flex.gap-4')).toHaveCount(1, { timeout: 30000 }); // At least one log entry
  
  // Wait for the mission to complete (or at least for the final output to appear)
  await expect(page.locator('h3:has-text("Mission Accomplished")')).toBeVisible({ timeout: 60000 });

  // Verify final output content
  const finalOutputContent = await page.locator('pre.whitespace-pre-wrap').textContent();
  expect(finalOutputContent).toContain('summary'); // Expect a summary to be part of the output

  // 6. Verify Mission History
  await page.click('a:has-text("Monitor")'); // Go back to monitor to see history
  await expect(page.locator('h3:has-text("Mission Accomplished")')).toBeVisible(); // Ensure final output is still there
  
  // Scroll down to mission history
  await page.locator('h3:has-text("Mission Accomplished")').scrollIntoViewIfNeeded();
  await expect(page.locator('div.p-3.bg-slate-50.border-b.border-slate-200.font-bold:has-text("Recent Missions")')).toBeVisible();
  await expect(page.locator('p.text-sm.text-slate-600.truncate.font-medium:has-text("Test Mission")')).toBeVisible();
});
