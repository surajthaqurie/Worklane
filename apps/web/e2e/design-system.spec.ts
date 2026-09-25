import { test, expect } from '@playwright/test';

test.describe('Design System & Responsive Architecture E2E', () => {
  test('skip link is accessible on focus', async ({ page }) => {
    await page.goto('/login');
    const skipLink = page.locator('.skip-to-content');
    await expect(skipLink).toHaveText('Skip to main content');

    // Press Tab from the address bar onto the skip link
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
  });

  test('login page responds to keyboard focus and error feedback', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Verify submit triggers form validation
    await submitBtn.click();
    await expect(emailInput).toBeFocused();
  });

  test('responsive viewport adjusts navigation', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    // Desktop sidebar should not be visible
    const desktopSidebar = page.locator('div.hidden.md\\:block');
    await expect(desktopSidebar).toBeHidden();
  });
});
