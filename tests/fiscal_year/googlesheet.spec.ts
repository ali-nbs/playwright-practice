// import { test, expect } from '@playwright/test';
// import { google } from 'googleapis';
// import path from 'path';

// const SPREADSHEET_ID = '1ArHNlvrv-4vMedIlz5cohymFZtMhHhEK6FRAg7KqlIU';
// const SHEET_NAME = '1/22';
// const KEY_FILE = path.resolve(process.cwd(), 'credentials.json');
// const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// test("Fiscal-Year Google Sheets Processor", async ({ page }) => {
//     const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
//     const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() as any });

//     const getResponse = await sheets.spreadsheets.values.get({
//         spreadsheetId: SPREADSHEET_ID,
//         range: `'${SHEET_NAME}'!B2:B30`,
//     });
//     const rows = getResponse.data.values || [];
//     console.log(`Total rows fetched: ${rows}`);
//     await page.goto("/");

//     if (await page.locator('#userid').isVisible({ timeout: 2400000 }).catch(() => false)) {
//         await page.locator('#userid').fill(process.env.APP_USERNAME!);
//         await page.getByRole('button', { name: 'Next' }).click();
//         await page.locator('#password').fill(process.env.APP_PASSWORD!);
//         await page.getByRole('button', { name: 'Sign in' }).click();
//         await page.waitForURL(/.*apps.intelligize.com/);
//     }

//     const secLink = page.locator('text=/SEC Filings/i').first();
//     await secLink.click();

//     for (let i = 0; i < rows.length; i++) {
//         const accNum = rows[i][0];
//         if (!accNum) continue;

//         console.log(`--- Processing Row ${i + 2}: ${accNum} ---`);

//         const accessionNoInput = page.locator('div').filter({ hasText: /^Accession Number$/ }).locator('input');
//         await expect(accessionNoInput).toBeVisible({ timeout: 2400000 });
//         await accessionNoInput.fill('');
//         await accessionNoInput.fill(accNum);
//         await page.getByRole('button', { name: /^Search$/i }).click();

//         // const viewBtn = page.locator('button', { hasText: /^View$/i }).first();
//         // await viewBtn.waitFor({ state: 'visible', timeout: 15000 });
//         // await viewBtn.click();
//         const allViewBtns = page.locator('button', { hasText: 'View' });
//         const noResults = page.locator('text=/No Results Found/i');
//         await Promise.race([
//             allViewBtns.first().waitFor({ state: 'visible', timeout: 2400000 }).catch(() => { }),
//             noResults.waitFor({ state: 'visible', timeout: 2400000 }).catch(() => { })
//         ]);
//         const viewBtnCount = await allViewBtns.count();
//         console.log(`--- Result for ${accNum}: Found ${viewBtnCount} View button(s). ---`);

//         const targetRow = page.locator('div[data-test="resultRow"]').filter({ hasText: accNum });

//         const viewBtn = targetRow.getByRole('button', { name: /View/i });

//         await viewBtn.waitFor({ state: 'visible', timeout: 240000 });
//         await viewBtn.click();

//         const docFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();
//         // let periodEndElement = docFrame.locator('ix\\:nonnumeric[name="dei:CurrentFiscalYearEndDate"]');
//         // await periodEndElement.waitFor({ state: 'attached', timeout: 2400000 });
//         // let periodEndValue = await periodEndElement.textContent();

//         // periodEndElement = docFrame.locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]');
//         // await periodEndElement.waitFor({ state: 'attached', timeout: 2400000 });
//         const currentFYELocator = docFrame.locator('ix\\:nonnumeric[name="dei:CurrentFiscalYearEndDate"]');
//         const docPeriodLocator = docFrame.locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]');

//         let fiscalYearEndValue: string | null = null;

//         // 2. Try to find CurrentFiscalYearEndDate first
//         if (await currentFYELocator.isVisible({ timeout: 5000 }).catch(() => false)) {
//             fiscalYearEndValue = await currentFYELocator.textContent();
//             console.log(`Found Priority 1 (CurrentFiscalYearEndDate): ${fiscalYearEndValue}`);
//         }
//         // 3. Fallback to DocumentPeriodEndDate if the first one wasn't found
//         else {
//             await docPeriodLocator.waitFor({ state: 'attached', timeout: 30000 });
//             fiscalYearEndValue = await docPeriodLocator.textContent();
//             console.log(`Found Priority 2 (DocumentPeriodEndDate): ${fiscalYearEndValue}`);
//         }

//         // Ensure the value is cleaned up for your calculation function
//         const periodEndValue = fiscalYearEndValue?.trim() || "";

//         // periodEndValue = await periodEndElement.textContent();

//         await page.locator('text=/^iXBRL$/i').first().click();
//         await page.locator('text=/^EX-101$/i').first().click();

//         const xbrlFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();

//         // const getValue = async (label: string) => {
//         //     const row = xbrlFrame.locator('tr').filter({ hasText: label }).first();
//         //     const val = await row.evaluate(tr => {
//         //         const cells = Array.from(tr.querySelectorAll('td'));
//         //         const dataCells = cells.filter(c => c.textContent?.trim());
//         //         return dataCells.length > 0 ? dataCells[dataCells.length - 1].textContent : "";
//         //     });
//         //     return val?.replace(/\s+/g, ' ').trim();
//         // };
//         const getValue = async (labels: string[]) => {
//             const combinedSelector = labels.map(label => `tr:has-text("${label}")`).join(', ');
//             const row = xbrlFrame.locator(combinedSelector).first();

//             const val = await row.evaluate(tr => {
//                 const cells = Array.from(tr.querySelectorAll('td'));
//                 //const dataCells = cells.filter(c => c.textContent?.trim());
//                 const dataCells = cells.map(c => c.textContent?.trim()).filter(text => text);
//                 const xbrlDateCell = dataCells.find(text => text?.startsWith('--'));

//                 if (xbrlDateCell) {
//                     console.log("xbrl cell ", xbrlDateCell)
//                     return xbrlDateCell;
//                 }
//                 return dataCells.length > 0 ? dataCells[dataCells.length - 1] : "";
//             });
//             return val?.replace(/\s+/g, ' ').trim();
//         };

//         const yearEnd = await getValue(["Current Fiscal Year End Date", "Fiscal Year End"]);

//         if (periodEndValue && yearEnd) {
//             const calc = calculateDynamicFiscal(periodEndValue, yearEnd);
//             const resultLabel = `${calc.quarter} ${calc.fiscalYear}`;
//             console.log(`Result: ${resultLabel}`);

//             await sheets.spreadsheets.values.update({
//                 spreadsheetId: SPREADSHEET_ID,
//                 range: `'${SHEET_NAME}'!J${i + 2}`,
//                 valueInputOption: 'USER_ENTERED',
//                 requestBody: { values: [[resultLabel]] },
//             });
//         }

//         const activeTab = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//         if (await activeTab.count() > 0) {
//             await activeTab.first().click({ button: 'right' });
//             const closeAllBtn = page.locator('div.react-contextmenu-item:visible').filter({ hasText: 'Close all tabs' }).first();
//             await closeAllBtn.dispatchEvent('click');
//             await expect(activeTab).toHaveCount(0, { timeout: 2400000 });
//         }
//     }
// });

import { test, expect } from '@playwright/test';
import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1ArHNlvrv-4vMedIlz5cohymFZtMhHhEK6FRAg7KqlIU';
const SHEET_NAME = '1/20';
const KEY_FILE = path.resolve(process.cwd(), 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

test("Fiscal-Year Google Sheets Processor", async ({ page }) => {
    const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() as any });

    // Fetch B (Accession) and I (Existing Value) columns
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!B2:I30`, // Extended range to include Column I
    });
    const rows = getResponse.data.values || [];
    await page.goto("/");

    // Login logic
    if (await page.locator('#userid').isVisible({ timeout: 15000 }).catch(() => false)) {
        await page.locator('#userid').fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(/.*apps.intelligize.com/);
    }

    const secLink = page.locator('text=/SEC Filings/i').first();
    await secLink.click();

    for (let i = 0; i < rows.length; i++) {
        const accNum = rows[i][0];
        const existingValueI = rows[i][7] ? String(rows[i][7]).trim() : ""; // Column I is index 7
        
        if (!accNum) continue;

        console.log(`\n--- [${i + 1}/${rows.length}] Processing: ${accNum} ---`);

        try {
            const accessionNoInput = page.locator('div').filter({ hasText: /^Accession Number$/ }).locator('input');
            await accessionNoInput.waitFor({ state: 'visible', timeout: 30000 });
            await accessionNoInput.fill(accNum);
            await page.getByRole('button', { name: /^Search$/i }).click();

            const allViewBtns = page.locator('button', { hasText: 'View' });
            const noResults = page.locator('text=/No Results Found/i');

            await Promise.race([
                allViewBtns.first().waitFor({ state: 'visible', timeout: 45000 }),
                noResults.waitFor({ state: 'visible', timeout: 45000 })
            ]);

            if (await noResults.isVisible()) {
                console.log(`No results for ${accNum}, skipping...`);
                continue;
            }

            const targetRow = page.locator('div[data-test="resultRow"]').filter({ hasText: accNum });
            const viewBtn = targetRow.getByRole('button', { name: /View/i });
            await viewBtn.click();

            const docFrame = page.frameLocator('iframe[src*="/SECFilings/Documents/"]').first();
            const currentFYELocator = docFrame.locator('ix\\:nonnumeric[name="dei:CurrentFiscalYearEndDate"]');
            const docPeriodLocator = docFrame.locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]');

            let fiscalYearEndValue: string | null = null;

            if (await currentFYELocator.isVisible({ timeout: 10000 }).catch(() => false)) {
                fiscalYearEndValue = await currentFYELocator.textContent();
            } else {
                await docPeriodLocator.waitFor({ state: 'attached', timeout: 15000 });
                fiscalYearEndValue = await docPeriodLocator.textContent();
            }

            const periodEndValue = fiscalYearEndValue?.trim() || "";

            const ixbrlBtn = page.locator('text=/^iXBRL$/i').first();
            await ixbrlBtn.click();

            const ex101Link = page.locator('text=/^EX-101$/i').first();
            await ex101Link.click();

            const xbrlFrame = page.frameLocator('iframe[src*="/SECFilings/Documents/"]').first();

            const getValue = async (labels: string[]) => {
                const combinedSelector = labels.map(label => `tr:has-text("${label}")`).join(', ');
                const row = xbrlFrame.locator(combinedSelector).first();
                return await row.evaluate(tr => {
                    const cells = Array.from(tr.querySelectorAll('td'));
                    const dataCells = cells.map(c => c.textContent?.trim()).filter(text => text);
                    const xbrlDateCell = dataCells.find(text => text?.startsWith('--'));
                    return xbrlDateCell || (dataCells.length > 0 ? dataCells[dataCells.length - 1] : "");
                });
            };

            const yearEnd = await getValue(["Current Fiscal Year End Date", "Fiscal Year End"]);

            if (periodEndValue && yearEnd) {
                const calc = calculateDynamicFiscal(periodEndValue, yearEnd);
                const resultLabelJ = String(`${calc.quarter} ${calc.fiscalYear}`).trim();
                
                // Comparison Logic (I vs J)
                const isMatch = String(existingValueI) === String(resultLabelJ);
                const statusK = isMatch ? "TRUE" : "FALSE";

                console.log(`Result J: ${resultLabelJ} | Existing I: ${existingValueI} | Match: ${statusK}`);

                // Batch update J, K, and M
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `'${SHEET_NAME}'!J${i + 2}:M${i + 2}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { 
                        values: [[
                            resultLabelJ, // Column J
                            statusK,      // Column K
                            "",           // Column L (leave empty)
                            "Playwright-Bot" // Column M
                        ]] 
                    },
                });
            }

        } catch (error: any) {
            console.error(`Error processing ${accNum}: ${error.message}`);
        } finally {
            const activeTab = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
            if (await activeTab.count() > 0) {
                try {
                    await activeTab.first().click({ button: 'right', timeout: 5000 });
                    const closeAllBtn = page.locator('div.react-contextmenu-item:visible').filter({ hasText: 'Close all tabs' }).first();
                    await closeAllBtn.dispatchEvent('click');
                    await expect(activeTab).toHaveCount(0, { timeout: 15000 });
                } catch (cleanupError) {
                    await page.reload();
                }
            }
        }
    }
});

// Helper functions (calculateDynamicFiscal) remain same as previous version...

// function calculateDynamicFiscal(periodStr: string, yearEndStr: string) {
//     const periodDate = new Date(periodStr);
//     const pMonth = periodDate.getMonth() + 1;
//     const pYear = periodDate.getFullYear();
//     const fyEndMonth = parseInt(yearEndStr.split('-')[2]);
//     const fyStartMonth = (fyEndMonth % 12) + 1;
//     console.log(`periodStr: ${periodStr}`);
//     console.log(`yearEndStr: ${yearEndStr}`);
//     console.log(`pMonth: ${pMonth}`);
//     console.log(`pYear: ${pYear}`);
//     console.log(`periodDate: ${periodDate}`);
//     console.log(`fyEndMonth: ${fyEndMonth}`);
//     console.log(`fyStartMonth: ${fyStartMonth}`);

//     let monthsSinceStart = (pMonth - fyStartMonth + 12) % 12;
//     let quarterNum = Math.floor(monthsSinceStart / 3) + 1;
//     console.log(`monthsSinceStart: ${monthsSinceStart}`);
//     console.log(`quarterNum: ${quarterNum}`);

//     let nextYearCount = 0;
//     let currentYearCount = 0;
//     for (let i = 0; i < 3; i++) {
//         let monthInQ = (pMonth - (2 - i) + 12) % 12 || 12;
//         if (fyStartMonth !== 1 && monthInQ < fyStartMonth && pMonth >= fyStartMonth) {
//             nextYearCount++;
//         } else {
//             currentYearCount++;
//         }
//     }
//     console.log(`nextYearCount: ${nextYearCount}, currentYearCount: ${currentYearCount}`);
//     return {
//         quarter: `Q${quarterNum}`.replace(/^Q4$/, `FY`),
//         fiscalYear: nextYearCount >= currentYearCount ? pYear + 1 : pYear
//     };
// }


function calculateDynamicFiscal(periodStr: string, yearEndStr: string) {
    const periodDate = new Date(periodStr);
    const pMonth = periodDate.getMonth() + 1;
    const pYear = periodDate.getFullYear();

    // 1. Parse the Fiscal Year End Month (e.g., "--03-31" -> 3)
    const parts = yearEndStr.split('-');
    const fyEndMonth = parseInt(parts[parts.length - 2]); 
    const fyStartMonth = (fyEndMonth % 12) + 1;
    console.log(`periodStrh: ${periodStr}, yearEndStr: ${yearEndStr}`);

    // 2. Calculate Quarter (Standard Logic)
    let monthsSinceStart = (pMonth - fyStartMonth + 12) % 12;
    let quarterNum = Math.floor(monthsSinceStart / 3) + 1;

    // 3. DYNAMIC MAJORITY COUNTING
    // We determine which calendar years make up the full 12-month fiscal cycle
    // Example: FY End March 2026 starts April 2025.
    let yearOfCycleStart = (pMonth < fyStartMonth) ? pYear - 1 : pYear;
    
    let yearCountMap:Record<number, number> = {};
    
    // Iterate through all 12 months of this specific fiscal cycle
    for (let i = 0; i < 12; i++) {
        let m = (fyStartMonth + i - 1) % 12 + 1;
        // If the month number 'm' is smaller than the start month, 
        // it has rolled over into the next calendar year.
        let yearOfTrailingMonth = (m < fyStartMonth) ? yearOfCycleStart + 1 : yearOfCycleStart;
        
        yearCountMap[yearOfTrailingMonth] = (yearCountMap[yearOfTrailingMonth] || 0) + 1;
    }

    // 4. Determine Fiscal Year based on occurrences
    const years = Object.keys(yearCountMap).map(Number).sort((a, b) => b - a);
    let finalFiscalYear = years[0]; // Default to latest

    if (years.length > 1) {
        const latestYear = years[0];
        const earlierYear = years[1];
        
        // Use the earlier year if it has strictly more occurrences
        // If counts are equal (draw), the sort order ensures we keep the latestYear
        if (yearCountMap[earlierYear] > yearCountMap[latestYear]) {
            finalFiscalYear = earlierYear;
        }
    }
    console.log(`Cycle Years:`, yearCountMap);
    console.log(`Result: Q${quarterNum} ${finalFiscalYear}`);

    return {
        quarter: `Q${quarterNum}`.replace(/^Q4$/, `FY`),
        fiscalYear: finalFiscalYear
    };
}