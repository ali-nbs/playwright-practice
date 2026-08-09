import { test, expect } from "@playwright/test";
import * as fs from 'fs';
import path from "path";

test("Ro-Crawling-Optimized", async ({ page }) => {

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const logDirectory = path.resolve(__dirname, './Results/ro-crawling');

    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    const fileName = path.join(logDirectory, `ro-crawling-${timestamp}.txt`);
    const logToFile = (message: any) => {
        const output = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        fs.appendFileSync(fileName, output + "\n");
        console.log(output);
    };

    logToFile(`TITLE: RO-CRAWLING REPORT`);
    logToFile(`START TIME: ${new Date().toLocaleString()}`);

    await page.goto("/");

    const userField = page.locator('#userid');
    if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
        logToFile("Status: Logging in...");
        await userField.fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(/.*apps.intelligize.com/, { timeout: 60000 });
    }

   // await page.locator('text=Transactions').first().click();
    await page.locator('text=/Registered Offerings/i').first().click();

    let daySearch = 'Today';

    logToFile(`Status: Searching for '${daySearch}'...`);
    const dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
    await dateInput.click({ force: true });
    await dateInput.pressSequentially(daySearch, { delay: 100 });
    await page.getByRole('button', { name: /^Search$/i }).click();

    const statusLocator = page.locator('//span[contains(text(), "Offerings:") or contains(text(), "No Results Found")]');
    await expect(statusLocator.first()).toBeVisible({ timeout: 240000 });

    const statusText = await statusLocator.first().innerText();
    logToFile(`Search Result: ${statusText}`);

    if (statusText.includes("No Results Found")) {
        logToFile(`Result: VALID (No data to crawl ${daySearch})`);
    } else {

        const rows = page.locator('div').filter({ has: page.getByRole('button', { name: /View/i }) });
        const rowCount = await rows.count();

        let currentRow = rows.nth(6);
        let checkbox = currentRow.locator('input[type="checkbox"]').first();
        await checkbox.evaluate((node: HTMLInputElement) => {
            node.checked = true;
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('click', { bubbles: true }));
        });

        currentRow = rows.nth(8);
        checkbox = currentRow.locator('input[type="checkbox"]').first();

        for (let i = 0; i < 2; i++) {
          //  await page.pause();
            await checkbox.evaluate((node: HTMLInputElement) => {
                node.checked = true;
                node.dispatchEvent(new Event('change', { bubbles: true }));
                node.dispatchEvent(new Event('click', { bubbles: true }));
            });
        }

        const performDownload = async (btnLocator: any, radioSelector: string | null, extension: string) => {
            await btnLocator.click();
            if (radioSelector) {
                await page.locator(radioSelector).click({ force: true });
            }
            //await page.pause();
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.getByRole('button', { name: /ok/i }).click()
            ]);

            const suggestedName = download.suggestedFilename();
            const filePath = path.join('./downloads', suggestedName);
            await download.saveAs(filePath);

            const isCorrectType = suggestedName.toLowerCase().endsWith(extension);
            logToFile(`Downloaded: ${suggestedName} | Verified ${extension}: ${isCorrectType}`);
        };

        logToFile("Action: Processing PDF Download...");
        const downloadBtn = page.locator('button[title*="Download"]');
        await performDownload(downloadBtn, '#ListSelectedOfferingsWithSummary', '.pdf');

        logToFile("Action: Processing Email...");
        await page.locator('//button[span[text()="Email"]]').click();
        await page.getByRole('button', { name: /ok/i }).click();
        logToFile("Email status: OK clicked.");

        logToFile("Action: Processing Excel Download...");
        const excelBtn = page.locator('//button[span[text()="Excel List"]]');
        await performDownload(excelBtn, '#ListSelectedOfferingsWithDocumentsList', '.xlsx');
    }

    logToFile("=".repeat(30) + `\nREPORT END: ${new Date().toLocaleString()}`);

   // await page.pause();
});
