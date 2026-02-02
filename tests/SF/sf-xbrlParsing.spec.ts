import { test, expect } from "@playwright/test";
import * as fs from 'fs';
import path from "path";

test("SF-XBRL Parsing", async ({ page }) => {

    // const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    // const logDirectory = path.resolve(__dirname, './Results/sf-xbrlParsing');

    // if (!fs.existsSync(logDirectory)) {
    //     fs.mkdirSync(logDirectory, { recursive: true });
    // }

    // const fileName = path.join(logDirectory, `sf-xbrlParsing-${timestamp}.txt`);
    // const logToFile = (message: any) => {
    //     const output = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
    //     fs.appendFileSync(fileName, output + "\n");
    //     console.log(output);
    // };

    await page.goto("/");

    const userField = page.locator('#userid');
    if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await userField.fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(/.*apps.intelligize.com/, { timeout: 60000 });
    }

    await page.locator('text=/SEC Filings/i').first().click();
    //await page.pause();
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 });
    
    const formsInput = page.locator('#Forms').getByRole('textbox');
    await formsInput.click();
    await formsInput.pressSequentially('10-K', { delay: 50 });
    await formsInput.press('Enter');
    // await formsInput.pressSequentially('10-Q', { delay: 50 });
    // await formsInput.press('Enter');

    await page.getByRole('button', { name: /^Search$/i }).click();

    const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
    await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });
    const statusText = await statusLocator.first().innerText();
    if (statusText.includes("No Results Found")) {
        throw new Error("No results found for the specified form types.");
    } else {
        const exhibitsLabel = page.locator('label').filter({ hasText: /^Exhibits$/ });
        await exhibitsLabel.click();

        const rows = page.locator('[data-test="resultRow"]');
        const count = await rows.count();

        const totalToProcess = 4;
        let processedCount = 0;

        while (processedCount < totalToProcess) {

            const currentRow = page.locator(`div[data-test="resultRow"][id="${processedCount}"]`);
            const viewButton = currentRow.getByRole('button', { name: /View/i });

            try {
                await viewButton.click({ force: true });

                await page.waitForTimeout(2000);
                //await page.pause();
                const ixbrlBtn = page.locator('text=/^iXBRL$/i').first();

                try {
                    await ixbrlBtn.click({ trial: true, timeout: 2000 });
                    await ixbrlBtn.click();
                    console.log("iXBRL activated.");

                    const ex101Link = page.locator('text=/^EX-101$/i').first();
                    await ex101Link.click();
                } catch (e) {
                    console.log("iXBRL not clickable or EX-101 missing. Skipping...");
                }
                const tabLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
                const tabCount = await tabLocator.count();
                console.log(`Found ${tabCount} tabs. Focusing the newest document...`);
                await tabLocator.first().click();
                processedCount++;
            } catch (e) {
                console.log(`Row ${processedCount} not found in DOM, scrolling to load more...`);
                await page.mouse.wheel(0, 600);
                await page.waitForTimeout(1000);

                const totalRowsFound = await page.locator('div[data-test="resultRow"]').count();
                if (processedCount > totalRowsFound + 10) {
                    console.log("Reached end of available results.");
                    break;
                }
            }
        }
    }
    await page.pause();
});