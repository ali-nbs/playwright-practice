// import { test, expect } from "@playwright/test";
// import * as fs from 'fs';
// import { off } from "node:cluster";

// test("Ro-Crawling", async ({ page, context }) => {

//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
//     const fileName = `ro-crawling-${timestamp}.txt`;
//     // const logToFile = (message: any) => {
//     //     fs.appendFileSync(fileName, message + "\n");
//     //     console.log(message);
//     // };

//     // logToFile("title RO-Crawling");
//     // logToFile(`filename ${fileName}\n`);

//     await page.goto("/");
//     if (page.url().includes('lexisnexis.com/en-us/gateway.page')) {
//         await page.getByRole('link', { name: /sign[-\s]?in/i }).click();

//         const pagePromise = context.waitForEvent('page');

//         await page.getByRole('link', { name: /intelligize/i }).click();

//         const loginPage = await pagePromise;
//         await loginPage.waitForLoadState();
//         //   await loginPage.pause();

//         const userIdInput = loginPage.locator('#userid');
//         await expect(userIdInput).toBeVisible({ timeout: 240000 });
//         await userIdInput.fill(process.env.APP_USERNAME!);

//         await loginPage.getByRole('button', { name: 'Next' }).click();
//         await loginPage.waitForLoadState();

//         const userPasswordInput = loginPage.locator('#password');
//         await expect(userPasswordInput).toBeVisible({ timeout: 240000 });
//         await userPasswordInput.fill(process.env.APP_PASSWORD!);

//         await loginPage.getByRole('button', { name: 'Sign in' }).click();
//         await loginPage.waitForURL(/^https:\/\/apps\.intelligize\.com/, { timeout: 240000 });

//         const currentUrl = loginPage.url();
//         console.log(`Current URL after login: ${currentUrl}`);
//         if (currentUrl.includes('/Account/LogOn')) {
//             const cleanUrl = currentUrl.replace('/Account/LogOn', '');
//             console.log(`Cleaning URL to: ${cleanUrl}`);
//             await loginPage.goto(cleanUrl, { waitUntil: 'commit' }).catch(() => { });
//         }

//         await expect(loginPage).toHaveURL(/^https:\/\/apps\.intelligize\.com/);
//         await loginPage.locator('text=Transactions').waitFor({
//             state: 'visible',
//             timeout: 240000
//         });
//         //240000
//         const reportingSection = loginPage.locator('text=Transactions').first();
//         await expect(reportingSection).toBeVisible({ timeout: 3600 });

//         const secLink = loginPage.locator('text=/Registered Offerings/i').first();
//         await secLink.waitFor({ state: 'visible', timeout: 3600 });
//         await secLink.click();

//         let dateInput = loginPage.locator('//label[text()="Date"]/ancestor::div[5]//input');
//         await dateInput.waitFor({ state: 'visible', timeout: 240000 });
//         await dateInput.click({ force: true });
//         await dateInput.pressSequentially('Yesterday', { delay: 100 });
//         // await loginPage.pause();

//         let searchBtn = loginPage.getByRole('button', { name: /^Search$/i });
//         await searchBtn.click();
//         let viewBtn = loginPage.getByRole('button', { name: /^View$/i });

//         let offeringCountLocator = loginPage.locator('//span[contains(text(), "Offerings:")]');
//         await offeringCountLocator.first().waitFor({ state: 'visible' });
//         let offeringText = await offeringCountLocator.innerText();
//         let initialCount = await offeringCountLocator.count();
//         console.log("offering count 1st tab value:", offeringText);
//         //  logToFile(`1st tab (Date Yesterday): ${offeringText}`);
//         // 1. Get all row containers that have a View button
//         const rows = loginPage.locator('div').filter({ has: loginPage.getByRole('button', { name: /View/i }) });

//         const rowCount = await rows.count();
//         console.log(`Found ${rowCount} result rows with View buttons.`);

//         // for (let i = 8; i < rowCount-1; i++) {
//         //     const currentRow = rows.nth(i);

//         //     // Target the actual input inside the row
//         //     const checkbox = currentRow.locator('input[type="checkbox"]').first();

//         //     // evaluate() runs directly in the browser, bypassing Playwright's "stuck" logic
//         //     await loginPage.pause();
//         //     await checkbox.evaluate((node: HTMLInputElement) => {
//         //         node.checked = true;
//         //         node.dispatchEvent(new Event('change', { bubbles: true }));
//         //         node.dispatchEvent(new Event('click', { bubbles: true }));
//         //     });
//         //     await loginPage.pause();
//         //     if (i == 8) {
//         //         await loginPage.pause();
//         //         await checkbox.evaluate((node: HTMLInputElement) => {
//         //             node.checked = true;
//         //             node.dispatchEvent(new Event('change', { bubbles: true }));
//         //             node.dispatchEvent(new Event('click', { bubbles: true }));
//         //         });
//         //         await loginPage.pause();
//         //     }

//         //     console.log(`Row ${i + 1}: State forced to Checked via JS.`);
//         // }
//         //  await loginPage.pause();
//         let currentRow = rows.nth(6);
//         let checkbox = currentRow.locator('input[type="checkbox"]').first();

//         // evaluate() runs directly in the browser, bypassing Playwright's "stuck" logic
//         await loginPage.pause();
//         await checkbox.evaluate((node: HTMLInputElement) => {
//             node.checked = true;
//             node.dispatchEvent(new Event('change', { bubbles: true }));
//             node.dispatchEvent(new Event('click', { bubbles: true }));
//         });
//         await loginPage.pause();


//         currentRow = rows.nth(8);
//         let checkboxrowCount = await currentRow.locator('input[type="checkbox"]').count();
//         console.log("checkboxrowCount", checkboxrowCount);
//         checkbox = currentRow.locator('input[type="checkbox"]').first();

//         await loginPage.pause();
//         //To first check all docs along their exhibits
//         await checkbox.evaluate((node: HTMLInputElement) => {
//             node.checked = true;
//             node.dispatchEvent(new Event('change', { bubbles: true }));
//             node.dispatchEvent(new Event('click', { bubbles: true }));
//         });
//         await loginPage.pause();
//         //To select all doc without exhibits
//         await checkbox.evaluate((node: HTMLInputElement) => {
//             node.checked = true;
//             node.dispatchEvent(new Event('change', { bubbles: true }));
//             node.dispatchEvent(new Event('click', { bubbles: true }));
//         });
//         await loginPage.pause();
//         // no selection
//         await checkbox.evaluate((node: HTMLInputElement) => {
//             node.checked = true;
//             node.dispatchEvent(new Event('change', { bubbles: true }));
//             node.dispatchEvent(new Event('click', { bubbles: true }));
//         });
//         await loginPage.pause();
//         // Select first doc
//         checkbox = currentRow.locator('input[type="checkbox"]').nth(1);

//         await loginPage.pause();
//         await checkbox.evaluate((node: HTMLInputElement) => {
//             node.checked = true;
//             node.dispatchEvent(new Event('change', { bubbles: true }));
//             node.dispatchEvent(new Event('click', { bubbles: true }));
//         });
//         await loginPage.pause();

//         const downloadBtn = loginPage.locator('button[title="Download the selected items from the list below"]');
//         await downloadBtn.waitFor({ state: 'visible' });
//         await downloadBtn.click();
//         await loginPage.pause();

//         const summaryRadio = loginPage.locator('#ListSelectedOfferingsWithSummary');
//         await summaryRadio.click({ force: true });
//         await loginPage.pause();

//         let downloadPromise = loginPage.waitForEvent('download');

//         let okbtnDownload = loginPage.getByRole('button', { name: /ok/i });
//         okbtnDownload.click();

//         const download = await downloadPromise;
//         const failure = await download.failure();
//         if (failure) {
//             console.error(`Download failed: ${failure}`);
//         } else {
//             const path = await download.path();

//             if (path) {
//                 const suggestedName = download.suggestedFilename();
//                 console.log(`Server suggested name: ${suggestedName}`);

//                 // 5. Save the file. If you don't know the extension, 
//                 // suggestedFilename() will keep it as .pdf automatically
//                 const finalLocation = `./downloads/${suggestedName}`;
//                 await download.saveAs(finalLocation);

//                 // 6. Verification: Check if the file is actually a PDF
//                 if (suggestedName.toLowerCase().endsWith('.pdf')) {
//                     console.log("Verified: This is a PDF document.");
//                 }
//             }
//         }
//         await loginPage.pause();

//         let emailbtn = loginPage.locator('//button[span[text()="Email"]]');
//         await emailbtn.click();

//         await loginPage.pause();

//         let okbtnEmail = loginPage.getByRole('button', { name: /ok/i });
//         okbtnEmail.click();

//         await loginPage.pause();

//         let excelbtn = loginPage.locator('//button[span[text()="Excel List"]]');
//         await excelbtn.click();

//         await loginPage.pause();

//         const documentIncludedRadio = loginPage.locator('#ListSelectedOfferingsWithDocumentsList');
//         await documentIncludedRadio.click({ force: true });

//         await loginPage.pause();

//         let downloadExcelPromise = loginPage.waitForEvent('download');


//         let okbtnExcel = loginPage.getByRole('button', { name: /ok/i });
//         okbtnExcel.click();

//         const downloadExcel = await downloadExcelPromise;
//         const failure1 = await downloadExcel.failure();
//         if (failure1) {
//             console.error(`Download failed: ${failure}`);
//         } else {
//             const path = await downloadExcel.path();

//             if (path) {
//                 const suggestedName = downloadExcel.suggestedFilename();
//                 console.log(`Server suggested name: ${suggestedName}`);

//                 // 5. Save the file. If you don't know the extension, 
//                 // suggestedFilename() will keep it as .pdf automatically
//                 const finalLocation = `./downloads/${suggestedName}`;
//                 await downloadExcel.saveAs(finalLocation);

//                 // 6. Verification: Check if the file is actually a PDF
//                 if (suggestedName.toLowerCase().endsWith('.xlsx')) {
//                     console.log("Verified: This is a xlsx document.");
//                 }
//             }
//         }
//         await loginPage.pause();
//     }
// })

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
