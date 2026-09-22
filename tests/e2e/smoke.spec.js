/**
 * FinTrack Pro — E2E Smoke Tests
 * Validates application bootstrap, main navigation routes, and core UI rendering.
 */

import { test, expect } from '@playwright/test';

test.describe('FinTrack Pro Application Smoke Tests', () => {
  test('loads home/dashboard and renders navigation header', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for the app container or main navbar
    await expect(page).toHaveTitle(/FinTrack Pro/i);

    // Verify main navigation or layout is visible
    const appElement = page.locator('#app, main, .app-container').first();
    await expect(appElement).toBeVisible();

    // Verify no fatal uncaught JavaScript errors on load
    const fatalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('Failed to load resource') &&
        !err.includes('favicon') &&
        !err.includes('unsupported MIME type')
    );
    expect(fatalErrors).toEqual([]);
  });

  test('navigates across main views without breaking layout', async ({ page }) => {
    await page.goto('/');

    const routes = ['#/dashboard', '#/transactions', '#/accounts', '#/settings'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(300);
      const appRoot = page.locator('#app, main, body').first();
      await expect(appRoot).toBeVisible();
    }
  });
});
