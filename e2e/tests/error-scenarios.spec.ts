import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Error Scenarios — Task 27.4
 * Requirements: 19.1, 19.2, 20.7
 */

test.describe('Offline behavior', () => {
  test('shows offline banner when network is disabled', async ({ page, context }) => {
    await page.goto('/');
    // Simulate going offline
    await context.setOffline(true);
    // Trigger a navigation to cause the offline event
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // ConnectivityIndicator banner should appear
    await expect(
      page.getByText(/you are currently offline/i),
    ).toBeVisible({ timeout: 3000 });

    await context.setOffline(false);
  });
});

test.describe('Error boundary', () => {
  test('error boundary does not show on clean navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('home page has no obvious accessibility violations (basic check)', async ({ page }) => {
    await page.goto('/');
    // Check for page title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('score report has main landmark', async ({ page }) => {
    await page.goto('/exam/score');
    // Either "No Session Found" div or main landmark
    const main = page.getByRole('main');
    const noSession = page.getByText(/no session found/i);
    await expect(main.or(noSession)).toBeVisible();
  });
});
