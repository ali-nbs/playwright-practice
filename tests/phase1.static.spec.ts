import { test, expect } from '@playwright/test';

test('PHASE 1 - Static URL data verification', async ({ page, context }) => {
    let result = 'PASS';

    try {

        await page.goto('/');

        if (page.url().includes('lexisnexis.com/en-us/gateway.page')) {
            await page.getByRole('link', { name: /sign[-\s]?in/i }).click();

            const pagePromise = context.waitForEvent('page');

            await page.getByRole('link', { name: /intelligize/i }).click();

            const loginPage = await pagePromise;
            await loginPage.waitForLoadState();

            const userIdInput = loginPage.locator('#userid');
            await expect(userIdInput).toBeVisible({ timeout: 240000 });
            await userIdInput.fill(process.env.APP_USERNAME!);

            await loginPage.getByRole('button', { name: 'Next' }).click();
            await loginPage.waitForLoadState();

            const userPasswordInput = loginPage.locator('#password');
            await expect(userPasswordInput).toBeVisible({ timeout: 240000 });
            await userPasswordInput.fill(process.env.APP_PASSWORD!);

            await loginPage.getByRole('button', { name: 'Sign in' }).click();
            await loginPage.waitForURL(/^https:\/\/apps\.intelligize\.com/, { timeout: 240000 });

            const currentUrl = loginPage.url();
            console.log(`Current URL after login: ${currentUrl}`);
            if (currentUrl.includes('/Account/LogOn')) {
                const cleanUrl = currentUrl.replace('/Account/LogOn', '');
                console.log(`Cleaning URL to: ${cleanUrl}`);
                await loginPage.goto(cleanUrl, { waitUntil: 'commit' }).catch(() => { });
            }

            await expect(loginPage).toHaveURL(/^https:\/\/apps\.intelligize\.com/);
            await loginPage.locator('text=Reporting & Benchmarking').waitFor({
                state: 'visible',
                timeout: 240000
            });

            const reportingSection = loginPage.locator('text=Reporting & Benchmarking').first();
            await expect(reportingSection).toBeVisible({ timeout: 240000 });

            const secLink = loginPage.locator('text=/SEC Filings/i').first();
            await secLink.waitFor({ state: 'visible', timeout: 240000 });
            await secLink.click();

            // const accessionNoInput = loginPage.getByLabel('Accession Number');
            // await expect(accessionNoInput).toBeVisible();
            // await accessionNoInput.fill('0001193125-23-084822');
            const accessionNoInput = loginPage.locator('div')
                .filter({ hasText: /^Accession Number$/ })
                .locator('input');
            await expect(accessionNoInput).toBeVisible({ timeout: 240000 });
            await accessionNoInput.fill('0001275187-26-000003');

            // const searchBtn = loginPage.locator('text=/^Search$/i').first();
            // await searchBtn.waitFor({ state: 'visible', timeout: 240000 });
            // await searchBtn.click();
            const searchBtn = loginPage.getByRole('button', { name: /^Search$/i });
            await searchBtn.click();

            // const viewBtn = loginPage.locator('text=/^View$/i').first();
            // await viewBtn.waitFor({ state: 'visible', timeout: 240000 });
            // await viewBtn.click();
            const viewBtn = loginPage.getByRole('button', { name: /^View$/i });
            await viewBtn.click();

            const ixbrlBtn = loginPage.locator('text=/^iXBRL$/i').first();
            await ixbrlBtn.waitFor({ state: 'visible', timeout: 240000 });
            await ixbrlBtn.click();

            const ex101Link = loginPage.locator('text=/^EX-101$/i').first();
            await ex101Link.waitFor({ state: 'visible', timeout: 240000 });
            await ex101Link.click();

            await loginPage.pause();    
        }

    } catch (error) {
        result = 'FAIL';
        console.error(' Phase 1 validation failed:', error);
        throw error;
    } finally {
        console.log(` PHASE 1 RESULT: ${result}`);
    }
});
