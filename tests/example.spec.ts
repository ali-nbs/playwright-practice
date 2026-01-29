import { test, expect } from '@playwright/test';

test('SEC Enforcement Multi-Field Search', async ({ page }) => {
  await page.goto("https://ddc4-multiversion.intelligize.net/?v=MR-4626");

  // Login Logic
  if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("Not logged in. Performing login...");
    await page.locator('#userid').fill(process.env.APP_USERNAME!);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#password').fill(process.env.APP_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/.*multiversion.intelligize.net/);
  }

  const secLink = page.locator('text=/SEC Enforcement/i').first();
  await secLink.click();

  // Violation Number

  // 1. Navigate through the divs to find the icon label specifically
  // Target the div or label that immediately follows the input with that testid
  // await page.locator('[data-testid="violation-input-radio-all"] + div').click();
  // await page.pause();

  // OR: If the structure is wrapped in a label (common for radio buttons)
  await page.pause();
  await page.locator('[data-testid="defendantType-radio-Individual"]').click();
  await page.pause();

  const firstActivity = page.locator('[data-testid="date-radio-FirstActivity"]').first();
  await firstActivity.click({ force: true });
  await page.pause();


  // Violation Category
  const fillAndEnter = async (selector: string, value: string) => {
    const input = page.locator(selector);
    await input.pressSequentially(value, { delay: 50 }); // Simulates human typing
    await page.keyboard.press('Enter'); // Presses Enter
    await page.pause(); // Pause after each field
  };

  const violationInput = page.locator('[data-testid="violation-input"]');
  await expect(violationInput).toBeVisible({ timeout: 240000 });
  await violationInput.fill('C-4506');
  await page.pause();

  await fillAndEnter('[data-testid="violationCategory-input"]', 'Fraud');

  await page.locator('label:has(input[data-testid="violation-input-radio-all"])').click();
  await page.pause();

  await fillAndEnter('[data-testid="defendant-input"]', 'John Doe');
  // Defendant Type Radio

  // await page.locator('[data-testid="defendantType-radio-BusinessEntity"]').click();
  // await page.pause();

  // await page.locator('[data-testid="defendantType-radio-Individual"]').click();
  // await page.pause();

  // Place of Employment
  await fillAndEnter('[data-testid="placeOfEmployment-input"]', 'Tech Corp');
  // await page.locator('[data-testid="placeOfEmployment-input"]').fill('Tech Corp');
  // await page.pause();

  // Defendant Position
  // await page.locator('[data-testid="defendantPosition-input"]').fill('CEO');
  // await page.pause();

  // Keywords
  await fillAndEnter('[data-testid="keywords-input"]', 'insider trading');

  // Document Title
  await fillAndEnter('[data-testid="documentTitle-input"]', 'Initial Complaint');

  // Date Radio


  // Venue
  await fillAndEnter('[data-testid="venue-input"]', 'S.D.N.Y.');

  // Administrative Law Judge
  await fillAndEnter('[data-testid="administrativeLawJudge-input"]', 'Judge Smith');

  // Penalty Type
  await fillAndEnter('[data-testid="penaltyType-input"]', 'Civil Penalty');
  const noPenaltyIcon = page.locator('[data-testid="penaltyType-noPenalty-checkbox"] div div label').first();

  // 2. Use click with force:true to ensure it bypasses any React event shielding
  await noPenaltyIcon.click({ force: true });
  await page.pause();
  // Relief Other Than Penalties
  await fillAndEnter('[data-testid="reliefOtherThanPenalties-input"]', 'Injunction');

  // 3. Apply the same pattern to the other checkbox
  const noOtherActionIcon = page.locator('[data-testid="reliefOtherThanPenalties-noOtherAction-checkbox"] div div label').first();
  await noOtherActionIcon.click({ force: true });
  await page.pause();


  // Total Amount of Penalties (Min/Max)
  await fillAndEnter('[data-testid="totalAmountOfPenalties-input-min"]', '1000');
  await fillAndEnter('[data-testid="totalAmountOfPenalties-input-max"]', '50000');

  // Release No / Case No
  await fillAndEnter('[data-testid="releaseNoCaseNo-input"]', '33-12345');


  // Search Action
  const searchBtn = page.getByRole('button', { name: /^Search$/i });
  await searchBtn.click();
  await page.pause();
});