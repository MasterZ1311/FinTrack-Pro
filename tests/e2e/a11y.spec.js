/**
 * FinTrack Pro — E2E Accessibility (A11y) Tests with Axe
 * Scans key application routes for WCAG 2.1 AA accessibility violations.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('FinTrack Pro Accessibility Audits (Axe-Core)', () => {
  test('audits home / dashboard view for critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const scanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Log any violations clearly for remediation
    if (scanResults.violations.length > 0) {
      console.warn(
        `[A11y] Found ${scanResults.violations.length} accessibility violation(s) on dashboard:`
      );
      for (const v of scanResults.violations) {
        console.warn(` - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} occurrences)`);
      }
    }

    // Critical impact violations should not be present
    const criticalViolations = scanResults.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toEqual([]);
  });

  test('audits transactions view for critical a11y violations', async ({ page }) => {
    await page.goto('/#/transactions');
    await page.waitForLoadState('domcontentloaded');

    const scanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = scanResults.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toEqual([]);
  });

  test('audits settings view for critical a11y violations', async ({ page }) => {
    await page.goto('/#/settings');
    await page.waitForLoadState('domcontentloaded');

    const scanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const criticalViolations = scanResults.violations.filter((v) => v.impact === 'critical');
    expect(criticalViolations).toEqual([]);
  });
});
