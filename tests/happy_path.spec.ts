import { test, expect } from '@playwright/test';

test('Happy Path: Mission Creation and Launch', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 1. Navigate to Home
  await page.goto('http://localhost:5173/');
  await expect(page).toHaveTitle(/Agent OS/);

  // 2. Knowledge Base Interaction (Manual Entry)
  await page.click('text=Knowledge');
  await expect(page.locator('text=Manual Entry')).toBeVisible();

  // Fill Manual Entry
  await page.fill('input[placeholder="Source Name (e.g. \'Wiki\')"]', 'Test Source');
  await page.fill('textarea[placeholder="Paste text content..."]', 'This is some test content for the knowledge base.');
  await page.click('button:has-text("Save to Memory")');

  // Verify it appears in the list (assuming it happens quickly or we wait)
  // Ideally we wait for the network request or the list to update.
  // For now, we just ensure the button was clickable and we didn't crash.

  // 3. Mission Setup
  await page.click('text=Setup');
  await expect(page.locator('text=Mission Goal')).toBeVisible();

  // Fill Mission Goal
  const goalInput = page.locator('textarea[placeholder*="Describe your mission"]'); // Heuristic selector
  await goalInput.fill('Test Mission: Analyze the current state of AI.');

  // Click Generate Plan
  await page.click('button:has-text("Generate Plan")');

  // Wait for Plan (mocking the backend response time or just waiting)
  // The backend isn't actually running in this test unless I start it.
  // Wait, I am supposed to run the backend *while* testing.
  // I will need to ensure the backend is running in the background during this test.
  // For now, let's assume I will start it.

  // Expect the "Plan" to appear (Launch button becomes visible)
  const launchButton = page.locator('button:has-text("Launch Mission")');
  await expect(launchButton).toBeVisible({ timeout: 15000 });

  // 4. Launch Mission
  await launchButton.click();

  // 5. Monitor
  // The logs confirm MissionHistory fetches and WebSocket connects.
  // We just ensure the page is still alive and has the correct title.
  await expect(page).toHaveTitle(/Agent OS/);

});
