import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

const AUTH_PATH = path.resolve(__dirname, 'auth.json');
const SPREADSHEET_ID = '1WG7yXVN4RVwpKCGc41YHievOySO--3WPuHGr7nusnwc';
const SHEET_NAME = 'Automated Test Cases';
const KEY_FILE = path.resolve(process.cwd(), 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const IDENTIFIER = 'se_indexing';

const setupLogger = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const logDirectory = path.resolve(__dirname, './Results/se-indexing');

    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    const fileName = path.join(logDirectory, `se-indexing-${timestamp}.txt`);

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

const getColumnLetter = (column: number): string => {
    let letter = '';
    while (column >= 0) {
        letter = String.fromCharCode((column % 26) + 65) + letter;
        column = Math.floor(column / 26) - 1;
    }
    return letter;
};
async function updateGoogleSheet(resultValue: string) {
    const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() as any });

    // Format today's date as "2/24"
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}`;

    // 1. Fetch current data (A1 to Z100 covers 26 columns, increase Z if needed)
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:Z100`,
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];

    // 2. Find or Create Date Column (Starts from Column F / index 5)
    let dateColIndex = headers.indexOf(dateStr);

    if (dateColIndex === -1) {
        // Find first empty column after Column E (index 4)
        dateColIndex = Math.max(headers.length, 5);
        const newColLetter = getColumnLetter(dateColIndex);

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!${newColLetter}1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[dateStr]] },
        });
    }

    // 3. Find Identifier in Column E (Index 4)
    let rowIndex = rows.findIndex(row => row[4] === IDENTIFIER);

    if (rowIndex === -1) {
        // If "sf_indexing" isn't found in Column E, append it to the bottom
        rowIndex = rows.length;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!E${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[IDENTIFIER]] },
        });
    }

    // 4. Update the Result Cell
    // rowIndex + 1 because Sheets is 1-indexed
    const targetCell = `${getColumnLetter(dateColIndex)}${rowIndex + 1}`;

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!${targetCell}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[resultValue]] },
    });

    const hasInvalid = resultValue.includes("Invalid");
    const bgColor = hasInvalid 
        ? { red: 0.95, green: 0.80, blue: 0.80 } // Light Red 2
        : { red: 0.71, green: 0.88, blue: 0.80 }; // Light Green 2

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    updateCells: {
                        range: {
                            sheetId: 1395635342,
                            startRowIndex: rowIndex,
                            endRowIndex: rowIndex + 1,
                            startColumnIndex: dateColIndex,
                            endColumnIndex: dateColIndex + 1
                        },
                        rows: [{
                            values: [{
                                userEnteredValue: { stringValue: resultValue },
                                userEnteredFormat: {
                                    backgroundColor: bgColor,
                                    verticalAlignment: "TOP",
                                    wrapStrategy: "WRAP",
                                    textFormat: { fontSize: 9 }
                                }
                            }]
                        }],
                        fields: 'userEnteredValue,userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)'
                    }
                }
            ]
        }
    });
}


test.describe("SE-Indexing Automation", () => {

    if (fs.existsSync(AUTH_PATH)) {
        test.use({ storageState: AUTH_PATH });
    }

    test("SE-Indexing", async ({ page }) => {
        const logToFile = setupLogger();
        logToFile("--- Starting SE-Indexing Report ---");

        await performLogin(page, logToFile);

        await page.locator('text=/SEC Enforcement/i').first().click();

        const dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
        let keywordsInput = page.locator('[data-testid="keywords-input"]');
        const searchBtn = page.getByRole('button', { name: /^Search$/i }).first();
        const clearBtn = page.getByRole('button', { name: /^Clear Filters$/i });

        logToFile("Exhibits to Filings: Checked");

        const testCases = [
            { date: 'Today', keyword: 'is OR the OR a', },
            { date: 'Yesterday', keyword: 'is OR the OR a', },
            { date: 'Last 7 Days', keyword: 'is OR the OR a',}
        ];

        let tabIndex = 0;
        let resultsSummary: string[] = [];

        for (const scenario of testCases) {
          

            logToFile(`\nTesting Scenario: ${scenario.date}`);

            await fillAndEnter(page, dateInput, scenario.date);
            await searchBtn.click();

            const textDateOnly = await getTabText(page, tabIndex++, logToFile, false);
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
            
            logToFile(isValid ? "✅ Result: Valid" : "❌ Result: Invalid - Counts mismatch");
            const scenarioFinding = [
                `Date: ${scenario.date}`,
                `Doc Found: ${textDateOnlyCount}`,
                ``,
                `Data: ${scenario.date} + Keyword: ${scenario.keyword}`,
                `Doc Found: ${textWithKeywordCount}`,
                ``,
                `Result: ${isValid ? "Valid ✅" : "Invalid ❌"}`
            ].filter(line => line !== "").join("\n");
            resultsSummary.push(scenarioFinding);
            await clearBtn.click();
        }
        const finalDumpString = resultsSummary.join("\n--------------------------------------------------------------------------------\n");

        try {
            await updateGoogleSheet(finalDumpString);
            logToFile("\nSuccessfully dumped detailed findings to Google Sheets.");
        } catch (err: any) {
            logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
        }
        logToFile("\n--- End of Report ---");
    });
});