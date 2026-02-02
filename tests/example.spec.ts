import { test, expect } from '@playwright/test';

test('SEC Enforcement Multi-Field Search', async ({ page }) => {
  await page.goto("https://ddc4-multiversion.intelligize.net/?v=MR-4626");

  if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Not logged in. Performing login...");
    await page.locator('#userid').fill('berczely8');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#password').fill("Testing99");
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/.*multiversion.intelligize.net/);
  }

  const secLink = page.locator('text=/SEC Filings/i').first();
  await secLink.click();

  await page.pause();
  await page.locator('[data-testid="company-input-radio-wrapper"]')
    .locator('div#anyRole')
    .click();
  await page.pause();


  const fillAndEnter = async (selector: string, value: string) => {
    const input = page.locator(selector);
    await input.pressSequentially(value, { delay: 50 });
    await page.keyboard.press('Enter');
    await page.pause();
  };

  let exhibitsToFilingsCheckbox = page.locator('[data-testid="searchFor-checkbox-ExhibitsToFilings-wrapper"] div div label').first();
  await exhibitsToFilingsCheckbox.click({ force: true });
  await page.pause();

  const formerNamesLabel = page.locator('label[for="CompanyCIK-formerNames"]');
  await formerNamesLabel.waitFor({ state: 'attached' });
  await formerNamesLabel.click();

  await page.pause();

  await fillAndEnter('[data-testid="keywords-input"]', 'insider trading');

  // const searchBtn = page.getByRole('button', { name: /^Search$/i });
  // await searchBtn.click();
  await page.pause();
});