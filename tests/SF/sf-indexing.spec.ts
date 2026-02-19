// import { test, expect } from "@playwright/test";
// import * as fs from 'fs';
// import path from "path/win32";

// // Only use storageState if the file actually exists
// // if (fs.existsSync('auth.json')) {
// //     console.log("file found");
// //     test.use({ storageState: 'auth.json' });
// // }

// test("SF-Indexing", async ({ page }) => {
//     // const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
//     // const logDirectory = path.resolve(__dirname, './Results/sf-indexing');
//     // if (!fs.existsSync(logDirectory)) {
//     //     fs.mkdirSync(logDirectory, { recursive: true });
//     // }

//     // const fileName = path.join(logDirectory, `sf-indexing-${timestamp}.txt`);
//     // const logToFile = (message: any) => {
//     //     fs.appendFileSync(fileName, message + "\n");
//     //     console.log(message);
//     // };

//     // logToFile("title SF-Indexing");
//     await page.goto("/");

//     if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
//         console.log("Not logged in. Performing login...");
//         await page.locator('#userid').fill(process.env.APP_USERNAME!);
//         await page.getByRole('button', { name: 'Next' }).click();
//         await page.locator('#password').fill(process.env.APP_PASSWORD!);
//         await page.getByRole('button', { name: 'Sign in' }).click();

//         await page.waitForURL(/.*apps.intelligize.com/);
//       //  await page.context().storageState({ path: 'auth.json' });
//     }

//     const secLink = page.locator('text=/SEC Filings/i').first();
//     await secLink.click();

//     const getTabText = async (expectedIndex: number) => {
//         const tabLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//         await expect(tabLocator).toHaveCount(expectedIndex + 1, { timeout: 240000 });
//         return await tabLocator.nth(expectedIndex).innerText();
//     };

//     //let dateInput = page.locator('[data-testid="date-input"]');
//     let dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
//     await dateInput.click({ force: true });
//     await dateInput.pressSequentially('Today', { delay: 100 });
//     //await dateInput.fill('Today');
//     await page.getByRole('button', { name: /^Search$/i }).first().click();
//     const offeringText1 = await getTabText(0);
//     //console.log(`1st tab: ${offeringText1}`);
//    // logToFile(`1st tab (Date Today): ${offeringText1}`);

//     let keywordsInput = page.locator('[data-testid="keywords-input"]');
//     await keywordsInput.click({ force: true });
//     await keywordsInput.pressSequentially('is OR the', { delay: 100 });
//     await page.getByRole('button', { name: /^Search$/i }).first().click();
//     const offeringText2 = await getTabText(1);
//     // console.log(`2nd tab: ${offeringText2}`);
//  //   logToFile(`2nd tab (Date + Keyword): ${offeringText2}`);
//    // logToFile(offeringText1 === offeringText2 ? "Result: Valid" : "Result: Invalid");
//    // logToFile("-----------------------------------");

//     //  console.log(offeringText1 === offeringText2 ? "Result: Valid" : "Result: Invalid");
//     let clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });
//     await clearBtn.click();

//     dateInput = page.locator('[data-testid="date-input"] input').first();
//     await dateInput.waitFor({ state: 'visible' });
//     await dateInput.click({ force: true });
//     await dateInput.pressSequentially('Yesterday', { delay: 100 });
//     await page.getByRole('button', { name: /^Search$/i }).first().click();
//     let offeringText3 = await getTabText(2);
//     // console.log(`3rd tab: ${offeringText3}`);
//    // logToFile(`3rd tab (Date Yesterday): ${offeringText3}`);

//     keywordsInput = page.locator('[data-testid="keywords-input"]');
//     await keywordsInput.click({ force: true });
//     await keywordsInput.pressSequentially('is OR the', { delay: 100 });
//     await page.getByRole('button', { name: /^Search$/i }).first().click();
//     let offeringText4 = await getTabText(3);
//     // console.log(`4th tab: ${offeringText4}`);
//     // console.log(offeringText3 === offeringText4 ? "7 Days Result: Valid" : "7 Days Result: Invalid");
//   //  logToFile(`4th tab (Date + Keyword): ${offeringText4}`);
//    // logToFile(offeringText3 === offeringText4 ? "Result: Valid" : "Result: Invalid");
//   //  logToFile("-----------------------------------");

//     clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });
//     await clearBtn.click();

//     dateInput = page.locator('[data-testid="date-input"]');
//     await dateInput.waitFor({ state: 'visible' });
//     await dateInput.click({ force: true });
//     await dateInput.pressSequentially('Last 7 Days', { delay: 100 });
//     await page.getByRole('button', { name: /^Search$/i }).first().click();
//     offeringText3 = await getTabText(4);
//     // console.log(`3rd tab: ${offeringText3}`);
//    // logToFile(`5th tab (Date Last 7 Days): ${offeringText3}`);

//     keywordsInput = page.locator('[data-testid="keywords-input"]');
//     await keywordsInput.click({ force: true });
//     await keywordsInput.pressSequentially('is OR the', { delay: 100 });
//     await page.getByRole('button', { name: /^Search$/i }).first().click();
//     offeringText4 = await getTabText(5);
//     // console.log(`4th tab: ${offeringText4}`);
//     // console.log(offeringText3 === offeringText4 ? "7 Days Result: Valid" : "7 Days Result: Invalid");
//    // logToFile(`6th tab (Date + Keyword): ${offeringText4}`);
//    // logToFile(offeringText3 === offeringText4 ? "Result: Valid" : "Result: Invalid");
//    // logToFile("-----------------------------------");
//     console.log("\n--- End of Report ---");

//   //  await page.pause();
// });



// import { test, expect, Page, Locator } from "@playwright/test";

// const setupLogger = () => {
//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
//     const logDirectory = path.resolve(__dirname, './Results/sf-indexing');

//     if (!fs.existsSync(logDirectory)) {
//         fs.mkdirSync(logDirectory, { recursive: true });
//     }

//     const fileName = path.join(logDirectory, `sf-indexing-${timestamp}.txt`);

//     return (message: string) => {
//         fs.appendFileSync(fileName, message + "\n");
//         console.log(message);
//     };
// };

// const performLogin = async (page: Page, logToFile: Function) => {

//     const userIdInput = page.locator('#userid');

//     if (await userIdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
//         logToFile("Not logged in. Performing login...");
//         await userIdInput.fill(process.env.APP_USERNAME!);
//         await page.getByRole('button', { name: 'Next' }).click();
//         await page.locator('#password').fill(process.env.APP_PASSWORD!);
//         await page.getByRole('button', { name: 'Sign in' }).click();

//         // Wait for successful redirect
//         await page.waitForURL(/.*apps.intelligize.com/);

//         // Save state for next time
//         await page.context().storageState({ path: authFile });
//         logToFile("Login successful. auth.json updated.");
//     } else {
//         logToFile("Session found. Skipping login.");
//     }
// };

// const typeValue = async (locator: Locator, value: string) => {
//     await locator.click({ force: true });
//     await locator.fill('');
//     await locator.pressSequentially(value, { delay: 50 });
// };

// const commitInput = async (page: Page) => {
//     await page.keyboard.press('Enter');
// };

// const fillAndEnter = async (page: Page, locator: Locator, value: string) => {
//     await typeValue(locator, value);
//     //await commitInput(page);
// };

// const getTabText = async (page: Page, expectedIndex: number) => {
//     const tabLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//     await expect(tabLocator.nth(expectedIndex)).toBeVisible({ timeout: 240000 });
//     return await tabLocator.nth(expectedIndex).innerText();
// };

// test("SF-Indexing - Scalable Validation", async ({ page }) => {

//     const logToFile = setupLogger();
//     logToFile("Starting SF-Indexing Report...");

//     const dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
//     const keywordsInput = page.locator('[data-testid="keywords-input"]');
//     const searchBtn = page.getByRole('button', { name: /^Search$/i }).first();
//     const clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });

//     await page.goto("/");
//     if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
//         await page.locator('#userid').fill(process.env.APP_USERNAME!);
//         await page.getByRole('button', { name: 'Next' }).click();
//         await page.locator('#password').fill(process.env.APP_PASSWORD!);
//         await page.getByRole('button', { name: 'Sign in' }).click();
//     }
//     await page.locator('text=/SEC Filings/i').first().click();

//     const testCases = [
//         { date: 'Today', keyword: 'is OR the' },
//         { date: 'Yesterday', keyword: 'is OR the' },
//         { date: 'Last 7 Days', keyword: 'is OR the' }
//     ];

//     let tabIndex = 0;
//     page.locator('label[for="-ExhibitsToFilings"]').click();

//     for (const scenario of testCases) {
//         console.log(`--- Testing Scenario: ${scenario.date} ---`);

//         await fillAndEnter(page, dateInput, scenario.date);
//         await searchBtn.click();
//         const textDateOnly = await getTabText(page, tabIndex++);

//         await fillAndEnter(page, keywordsInput, scenario.keyword);
//         await searchBtn.click();
//         const textWithKeyword = await getTabText(page, tabIndex++);

//         const isValid = textDateOnly === textWithKeyword;
//         console.log(`Baseline (${scenario.date}): ${textDateOnly}`);
//         console.log(`With Keyword: ${textWithKeyword}`);
//         console.log(isValid ? "✅ Result: Valid" : "❌ Result: Invalid - Counts mismatch");

//         await clearBtn.click();
//         console.log("-----------------------------------");
//     }

//     console.log("\n--- End of Report ---");
// });




import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from 'fs';
import * as path from 'path';

const AUTH_PATH = path.resolve(__dirname, 'auth.json');

const setupLogger = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const logDirectory = path.resolve(__dirname, './Results/sf-indexing');

    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    const fileName = path.join(logDirectory, `sf-indexing-${timestamp}.txt`);

    return (message: string) => {
        fs.appendFileSync(fileName, message + "\n");
        console.log(message);
    };
};

const performLogin = async (page: Page, logToFile: Function) => {
    await page.goto("/");

    const userIdInput = page.locator('#userid');

    if (await userIdInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        logToFile("Session expired or not found. Performing manual login...");

        await userIdInput.fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();

        await page.waitForURL(/.*apps.intelligize.com/, { waitUntil: 'networkidle' });
        await page.context().storageState({ path: AUTH_PATH });
        logToFile("Login successful. auth.json updated.");
    } else {
        logToFile("Active session detected via auth.json. Skipping login.");
    }
};


const typeValue = async (locator: Locator, value: string) => {
    // await locator.click({ force: true });
    await locator.focus();
    await locator.fill('');
    await locator.pressSequentially(value, { delay: 50 });
};

const fillAndEnter = async (page: Page, locator: Locator, value: string) => {
    await typeValue(locator, value);
    // await page.keyboard.press('Enter'); 
};


const getTabText = async (page: Page, expectedIndex: number, logToFile: Function, isNeedLoadMoreResults: Boolean) => {
    const tabLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
    await expect(tabLocator.nth(expectedIndex)).toBeVisible({ timeout: 240000 });
    //return await tabLocator.nth(expectedIndex).innerText();
    let text = await tabLocator.nth(expectedIndex).innerText();
    if (text.includes("Docs") && isNeedLoadMoreResults) {
        await page.locator('a:has-text("Load more results")').last().click({ force: true });
        text = await tabLocator.nth(expectedIndex).innerText();
    }
    return text;
};

const parseCount = (text: string): number => {
    const digits = text.replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : 0;
};

test.describe("SF-Indexing Automation", () => {

    if (fs.existsSync(AUTH_PATH)) {
        test.use({ storageState: AUTH_PATH });
    }

    test("SF-Indexing", async ({ page }) => {
        const logToFile = setupLogger();
        logToFile("--- Starting SF-Indexing Report ---");

        await performLogin(page, logToFile);

        await page.locator('text=/SEC Filings/i').first().click();

        const dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
        let keywordsInput = page.locator('[data-testid="keywords-input"]');
        const searchBtn = page.getByRole('button', { name: /^Search$/i }).first();
        const clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });

        logToFile("Exhibits to Filings: Checked");

        const testCases = [
            { date: 'Today', keyword: 'is OR the OR a', NotKeyword: 'NOT (is OR the OR a)' },
            { date: 'Yesterday', keyword: 'is OR the OR a', NotKeyword: 'NOT (is OR the OR a)' },
            { date: 'Last 7 Days', keyword: 'is OR the OR a', NotKeyword: 'NOT (is OR the OR a)' }
        ];

        let tabIndex = 0;

        for (const scenario of testCases) {
            let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
            await exhibitsCheckbox.click();

            let amendmentFillingsRadioButton = page.getByTestId('amendmentFilings-radio-EXC');
            await amendmentFillingsRadioButton.click();

            let ownershipFormsRadioButton = page.getByTestId('ownershipForms-radio-INC');
            await ownershipFormsRadioButton.click();

            logToFile(`\nTesting Scenario: ${scenario.date}`);

            await fillAndEnter(page, dateInput, scenario.date);
            await searchBtn.click();

            const textDateOnly = await getTabText(page, tabIndex++, logToFile, true);
            logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

            await fillAndEnter(page, keywordsInput, scenario.keyword);
            await searchBtn.click();
            let textWithKeyword = await getTabText(page, tabIndex++, logToFile, false);
            logToFile(`With Keyword: ${textWithKeyword}`);

            const textDateOnlyCount = parseCount(textDateOnly);
            console.log("textDateOnlyCount", textDateOnlyCount);
            let textWithKeywordCount = parseCount(textWithKeyword);
            console.log("textWithKeywordCount", textWithKeywordCount);
            let isValid = textDateOnlyCount === textWithKeywordCount;
            if (!isValid) {
                await clearBtn.click();
                await exhibitsCheckbox.click();
                await amendmentFillingsRadioButton.click();
                await ownershipFormsRadioButton.click();
                await fillAndEnter(page, dateInput, scenario.date);
                await fillAndEnter(page, keywordsInput, scenario.NotKeyword);
                await searchBtn.click();
                const textWithNotKeyword = await getTabText(page, tabIndex++, logToFile, false);
                logToFile(`With Not Keyword: ${textWithNotKeyword}`);
                const sum = textWithKeywordCount + parseCount(textWithNotKeyword);
                console.log("sum", sum);
                isValid = sum === textDateOnlyCount;
            }
            logToFile(isValid ? "✅ Result: Valid" : "❌ Result: Invalid - Counts mismatch");

            await clearBtn.click();
        }
        logToFile("\n--- End of Report ---");
    });
});