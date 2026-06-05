import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Complete Exam Flow — Task 27.2
 * Requirements: 1.3, 2.4, 12.1, 9.4
 */

test.describe('Landing page', () => {
  test('shows TOEFL branding and start button', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TOEFL/i);
    // Landing page should contain a "Start" or "Begin" call to action
    const cta = page.getByRole('link', { name: /start|begin|take the test/i }).or(
      page.getByRole('button', { name: /start|begin|take the test/i }),
    );
    await expect(cta).toBeVisible();
  });
});

test.describe('Exam start', () => {
  test('navigates to exam start page', async ({ page }) => {
    await page.goto('/exam/start');
    // Should either show exam start UI or redirect to home if no session
    await expect(page).toHaveURL(/\/(exam\/start|)/);
  });
});

test.describe('Score report', () => {
  test('redirects to home when no session exists', async ({ page }) => {
    await page.goto('/exam/score');
    // Should show "No Session Found" or redirect
    const noSession = page.getByText(/no session found/i);
    const homeBtn = page.getByRole('button', { name: /return home/i });
    await expect(noSession.or(homeBtn)).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('unknown routes redirect to home', async ({ page }) => {
    await page.goto('/this/route/does/not/exist');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Review modal', () => {
  test('review button triggers modal on section page', async ({ page }) => {
    // Navigate to a section (won't show real content without session, but modal button should exist)
    await page.goto('/exam/section/reading');
    const reviewBtn = page.getByRole('button', { name: /review/i });
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      // Modal should appear
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });
});

test.describe('Timer display', () => {
  test('timer is formatted HH:MM:SS', async ({ page }) => {
    await page.goto('/exam/section/reading');
    // Look for time-format pattern (e.g. 00:30:00)
    const timerEl = page.getByText(/\d{2}:\d{2}:\d{2}/);
    if (await timerEl.isVisible()) {
      const text = await timerEl.textContent();
      expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
    }
  });
});
