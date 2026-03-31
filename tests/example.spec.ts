import { test, expect } from '@playwright/test';

test('SEC Enforcement Multi-Field Search', async ({ page }) => {
  await page.goto("https://ddc4-multiversion.intelligize.net/SECFilings?v=sf-ids");

  if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Not logged in. Performing login...");
    await page.locator('#userid').fill('berczely8');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#password').fill("Testing99");
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/.*multiversion.intelligize.net/);
  }
  const fillAndEnter = async (selector: string, value: string) => {
    const input = page.locator(selector);
    await input.pressSequentially(value, { delay: 50 });
    // await page.keyboard.press('Enter');
    await page.pause();
  };

  const secLink = page.locator('text=/SEC Filings/i').first();
  await secLink.click();


  await page.locator('[data-testid="ascAndAsuReferences-round-btn"]').click();
  await page.pause();
  await page.locator('[data-testid="ascAndAsuReferences-tree-container"]').locator('span._icon_1jkal_249.Add').first().click({ force: true });
  await page.pause();
 
  const checkbox = page.locator('input[name="1XX - General Principles"]');
  await checkbox.evaluate((node: HTMLInputElement) => {
    node.checked = true;
    node.dispatchEvent(new Event('click', { bubbles: true }));
  });
  await page.pause();
  const clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });
  await clearBtn.click();

  await page.pause();
  const formerNamesLabel = page.locator('label[for="CompanyCIK-formerNames"]');
  await formerNamesLabel.waitFor({ state: 'attached' });
  await formerNamesLabel.click();

  await page.pause();

  await page.pause();
  await page.locator('[data-testid="company-round-btn"]')
    .locator('span')
    .click();
  await page.pause();


  await fillAndEnter('[data-testid="company-popup-results-search-input"]', 'Apple Inc.');
  await page.pause();

  await page.locator('[data-testid="company-popup-cik-filter-list-item-1"]').click();
  await page.pause();

  await page.locator('[data-testid="company-popup-results-view-peers-0000320193"]').locator('span').first().click();
  await page.pause();

  await page.locator('[data-testid="company-popup-peers-tree-type-of-peers-btn"]').click();
  await page.pause();

  await page.locator('[data-testid="company-popup-configure-peers-radio-custom"]').click();
  await page.pause();

  await page.locator('[data-testid="company-popup-configure-peers-filter-industry"]').locator('span').first().click();
  await page.pause();
  await page.locator('[data-testid="company-popup-configure-peers-filter-incorporatedIn"]').locator('label').first().click();
  await page.pause();


  let exhibitsToFilingsCheckbox = page.locator('[data-testid="searchFor-checkbox-ExhibitsToFilings-wrapper"] div div label').first();
  await exhibitsToFilingsCheckbox.click({ force: true });
  await page.pause();



  await fillAndEnter('[data-testid="keywords-input"]', 'insider trading');

  // const searchBtn = page.getByRole('button', { name: /^Search$/i });
  // await searchBtn.click();
  await page.pause();
});