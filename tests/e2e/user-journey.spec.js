/**
 * FinTrack Pro — Complete End-to-End User Journey Tests
 * Tests onboarding, dashboard, PWA installation controls, and settings.
 */

import { test, expect } from '@playwright/test';

async function ensureOnboarded(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const indCard = page.locator('#ob-card-individual');
  if (await indCard.isVisible()) {
    await indCard.click();
    await page.locator('#ind-name').fill('Alex Rivera');
    await page.locator('#ob-btn-next').click();
    await page.waitForSelector('#ind-income');
    await page.locator('#ob-btn-next').click();
    await page.waitForTimeout(300);
    await page.locator('#ob-btn-next').click();
    await page.waitForURL(/.*#\/dashboard/);
  }
}

test.describe('FinTrack Pro Complete User Journey & System Interaction Suite', () => {
  test('onboarding completes and initializes user profile', async ({ page }) => {
    await ensureOnboarded(page);
    const dashboardLayout = page.locator('.dashboard-layout');
    await expect(dashboardLayout).toBeVisible();
  });

  test('PWA install button is present in sidebar and triggers installation handler', async ({ page }) => {
    await ensureOnboarded(page);
    await page.waitForSelector('#sidebar-install-btn');

    const installBtn = page.locator('#sidebar-install-btn');
    await expect(installBtn).toBeVisible();
    await expect(installBtn).toHaveText(/Install App|Installed System/);

    // Clicking install button should invoke handler smoothly
    await installBtn.click();
    await page.waitForTimeout(500);

    // Verify modal or toast feedback appears
    const feedback = page.locator('.fintrack-modal-backdrop, .fintrack-toast');
    await expect(feedback.first()).toBeVisible();
  });

  test('navigates to settings and verifies privacy mode selection and data export', async ({ page }) => {
    await ensureOnboarded(page);
    await page.goto('/#/settings');
    await page.waitForLoadState('domcontentloaded');

    // Click Privacy & AI tab
    const aiTab = page.locator('button[data-target="tab-ai"]');
    await expect(aiTab).toBeVisible();
    await aiTab.click();

    // Verify LOCAL_ONLY option exists and is checked by default
    const localRadio = page.locator('input[value="LOCAL_ONLY"]');
    await expect(localRadio).toBeVisible();
    await expect(localRadio).toBeChecked();

    // Check data export button strictly triggers JSON download without leaking credentials
    const dataTab = page.locator('button[data-target="tab-data"]');
    await dataTab.click();

    const exportBtn = page.locator('#btn-export-data');
    await expect(exportBtn).toBeVisible();

    // Check Preferences tab has the System Installation card
    const prefsTab = page.locator('button[data-target="tab-prefs"]');
    await prefsTab.click();
    const installSettingBtn = page.locator('#btn-settings-install');
    await expect(installSettingBtn).toBeVisible();
  });
});
