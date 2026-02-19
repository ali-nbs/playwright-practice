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