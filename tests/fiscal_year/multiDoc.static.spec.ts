// import { test, expect } from '@playwright/test';

// test("Fiscal-Year", async ({ page, context }) => {

//     await page.goto("/");
//     // Accession Number , Fiscal Year
//     // 0001477932-26-000242 FY 2025
//     // 0001493152-26-002481 FY 2024
//     // 0001437749-26-001452 Q3 2025
//     // 0001753926-26-000125 FY 2025
//     // 0001493152-26-002503 FY 2025
//     // 0001213900-26-005258 FY 2024
//     // 0001493152-26-002647 FY 2025


//     if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
//         console.log("Not logged in. Performing login...");
//         await page.locator('#userid').fill(process.env.APP_USERNAME!);
//         await page.getByRole('button', { name: 'Next' }).click();
//         await page.locator('#password').fill(process.env.APP_PASSWORD!);
//         await page.getByRole('button', { name: 'Sign in' }).click();

//         await page.waitForURL(/.*apps.intelligize.com/);
//         await page.context().storageState({ path: 'auth.json' });
//     }

//     const secLink = page.locator('text=/SEC Filings/i').first();
//     await secLink.click();

//     let accessionNoInput = page.locator('div')
//         .filter({ hasText: /^Accession Number$/ })
//         .locator('input');
//     await expect(accessionNoInput).toBeVisible({ timeout: 240000 });
//     await accessionNoInput.fill('0001477932-26-000242');

//     let searchBtn = page.getByRole('button', { name: /^Search$/i });
//     await searchBtn.click();

//     let viewBtn = page.getByRole('button', { name: /^View$/i }).first();
//     await viewBtn.click();

//     const documentFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();
//     const periodEndElement = documentFrame.locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]');
//     await periodEndElement.waitFor({ state: 'attached', timeout: 15000 });

//     const periodEndValue: any = await periodEndElement.textContent();
//     console.log(` Quarterly Period Ended: ${periodEndValue?.trim()}`);

//     const ixbrlBtn = page.locator('text=/^iXBRL$/i').first();
//     await ixbrlBtn.waitFor({ state: 'visible', timeout: 240000 });
//     await ixbrlBtn.click();

//     const ex101Link = page.locator('text=/^EX-101$/i').first();
//     await ex101Link.waitFor({ state: 'visible', timeout: 240000 });
//     await ex101Link.click();
//     // await page.pause();

//     const xbrlFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();

//     const getValue = async (label: string) => {
//         const row = xbrlFrame.locator('tr').filter({ hasText: label }).first();
//         const val = await row.evaluate(tr => {
//             const cells = Array.from(tr.querySelectorAll('td'));
//             const dataCells = cells.filter(c => c.textContent?.trim());
//             return dataCells.length > 0 ? dataCells[dataCells.length - 1].textContent : "";
//         });
//         return val?.replace(/\s+/g, ' ').trim();
//     };

//     const periodEnd = await getValue("Document Period End Date");
//     const fiscalYear = await getValue("Document Fiscal Year Focus");
//     const fiscalPeriod = await getValue("Document Fiscal Period Focus");
//     const yearEnd = await getValue("Current Fiscal Year End Date");

//     console.log(`Results: ${periodEnd}, ${fiscalYear}, ${fiscalPeriod}, ${yearEnd}`);

//     function calculateDynamicFiscal(periodStr: string, yearEndStr: string) {
//         const periodDate = new Date(periodStr);
//         const pMonth = periodDate.getMonth() + 1;
//         const pYear = periodDate.getFullYear();

//         console.log("periodData", periodDate);
//         console.log("pMonth", pMonth);
//         console.log("pYear", pYear);
//         const fyEndMonth = parseInt(yearEndStr.split('-')[2]);
//         console.log("fyEndMonth", fyEndMonth);

//         const fyStartMonth = (fyEndMonth % 12) + 1;
//         console.log("fyStartMonth", fyStartMonth);

//         let monthsSinceStart = (pMonth - fyStartMonth + 12) % 12;
//         console.log("monthsSinceStart", monthsSinceStart);
//         let quarterNum = Math.floor(monthsSinceStart / 3) + 1;
//         console.log("quarterNum", quarterNum);
//         const calculatedQuarter = `Q${quarterNum}`;
//         console.log("calculatedQuarter", calculatedQuarter);

//         let yearOccurrences = { current: 0, next: 0 };
//         console.log("yearOccurrences", yearOccurrences);
//         for (let i = 0; i < 3; i++) {
//             let currentMonthInQ = (pMonth - (2 - i) + 12) % 12 || 12;
//             if (currentMonthInQ < fyStartMonth && pMonth >= fyStartMonth) {
//                 yearOccurrences.next++;
//             } else if (currentMonthInQ >= fyStartMonth && pMonth < fyStartMonth) {
//                 yearOccurrences.current++;
//             } else {
//                 yearOccurrences.current++;
//             }
//         }

//         const finalFiscalYear = yearOccurrences.next > yearOccurrences.current ? pYear + 1 : pYear;

//         return {
//             quarter: calculatedQuarter,
//             fiscalYear: finalFiscalYear,
//             debug: { fyStartMonth, pMonth, yearOccurrences }
//         };
//     }

//     const fiscalResult = calculateDynamicFiscal(periodEndValue, yearEnd);
//     console.log(`Calculated: ${fiscalResult.quarter} ${fiscalResult.fiscalYear}`);
//     const activeTab = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//     await activeTab.click({ button: 'right' });

//     const closeAllBtn = page.locator('div.react-contextmenu-item:visible')
//         .filter({ hasText: 'Close all tabs' })
//         .first();
//     await closeAllBtn.waitFor({ state: 'attached', timeout: 5000 });
//     await closeAllBtn.dispatchEvent('click');

//     accessionNoInput = page.locator('div')
//         .filter({ hasText: /^Accession Number$/ })
//         .locator('input');
//     await expect(accessionNoInput).toBeVisible({ timeout: 240000 });
//     await accessionNoInput.fill('0001493152-26-002481');

//     searchBtn = page.getByRole('button', { name: /^Search$/i });
//     await searchBtn.click();

//     viewBtn = page.getByRole('button', { name: /^View$/i }).first();
//     await page.pause();
// })




import { test, expect } from '@playwright/test';

test("Fiscal-Year Key-Value Mapping", async ({ page }) => {
    // Input mapping for validation
    const targetDocs = [
        { acc: '0001079973-26-000097', expected: 'Q2 2025' },
        { acc: '0001753926-26-000125', expected: 'FY 2025' },
        { acc: '0000876167-26-000008', expected: 'FY 2025' },
        { acc: '0001683168-26-000412', expected: 'FY 2025' },

        { acc: '0001493152-26-002503', expected: 'FY 2025' },
        { acc: '0001213900-26-005258', expected: 'FY 2024' },
        { acc: '0001493152-26-002647', expected: 'FY 2025' }
    ];

    // This object will store the final results
    const finalResults: Record<string, string> = {};

    await page.goto("/");

    // --- Login Logic (Same as before) ---
    if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
        await page.locator('#userid').fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(/.*apps.intelligize.com/);
    }

    const secLink = page.locator('text=/SEC Filings/i').first();
    await secLink.click();

    for (const doc of targetDocs) {
        console.log(`--- Processing: ${doc.acc} ---`);

        // 1. Search and Open
        const accessionNoInput = page.locator('div').filter({ hasText: /^Accession Number$/ }).locator('input');
        await expect(accessionNoInput).toBeVisible({ timeout: 60000 });
        await accessionNoInput.fill(doc.acc);
        await page.getByRole('button', { name: /^Search$/i }).click();
        // await page.getByRole('button', { name: /^View$/i }).last().click();
        const viewBtn = page.locator('button', { hasText: /^View$/i }).first();

        // Wait for the button to be stable and visible before clicking
        await viewBtn.waitFor({ state: 'visible', timeout: 15000 });
        await viewBtn.click();

        // 2. Extract Data from Frames
        const docFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();
        const periodEndElement = docFrame.locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]');
        await periodEndElement.waitFor({ state: 'attached', timeout: 30000 });
        const periodEndValue = await periodEndElement.textContent();

        await page.locator('text=/^iXBRL$/i').first().click();
        await page.locator('text=/^EX-101$/i').first().click();

        const xbrlFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();

        // Helper to grab table values
        const getValue = async (label: string) => {
            const row = xbrlFrame.locator('tr').filter({ hasText: label }).first();
            const val = await row.evaluate(tr => {
                const cells = Array.from(tr.querySelectorAll('td'));
                const dataCells = cells.filter(c => c.textContent?.trim());
                return dataCells.length > 0 ? dataCells[dataCells.length - 1].textContent : "";
            });
            return val?.replace(/\s+/g, ' ').trim();
        };

        const yearEnd = await getValue("Current Fiscal Year End Date");

        // 3. Calculation and Assignment
        if (periodEndValue && yearEnd) {
            const calc = calculateDynamicFiscal(periodEndValue, yearEnd);
            const resultLabel = `${calc.quarter} ${calc.fiscalYear}`;

            // Assign to final object
            finalResults[doc.acc] = resultLabel;

            console.log(`Match Result for ${doc.acc}: ${resultLabel}`);
        }

        // 4. Cleanup Context Menu
        const activeTab = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
        if (await activeTab.count() > 0) {
            await activeTab.first().click({ button: 'right' });
            const closeAllBtn = page.locator('div.react-contextmenu-item:visible').filter({ hasText: 'Close all tabs' }).first();
            await closeAllBtn.dispatchEvent('click');
            // await page.waitForTimeout(1000); // Wait for tabs to close
            await expect(activeTab).toHaveCount(0, { timeout: 10000 });
        }
    }

    console.log("--- FINAL EXTRACTION OBJECT ---");
    console.log(JSON.stringify(finalResults, null, 2));
});

// Helper function
function calculateDynamicFiscal(periodStr: string, yearEndStr: string) {
    const periodDate = new Date(periodStr);
    const pMonth = periodDate.getMonth() + 1;
    const pYear = periodDate.getFullYear();
    const fyEndMonth = parseInt(yearEndStr.split('-')[2]);
    const fyStartMonth = (fyEndMonth % 12) + 1;

    let monthsSinceStart = (pMonth - fyStartMonth + 12) % 12;
    let quarterNum = Math.floor(monthsSinceStart / 3) + 1;

    let nextYearCount = 0;
    let currentYearCount = 0;
    for (let i = 0; i < 3; i++) {
        let monthInQ = (pMonth - (2 - i) + 12) % 12 || 12;
        if (fyStartMonth !== 1 && monthInQ < fyStartMonth && pMonth >= fyStartMonth) {
            nextYearCount++;
        } else {
            currentYearCount++;
        }
    }
    return {
        quarter: `Q${quarterNum}`,
        fiscalYear: nextYearCount > currentYearCount ? pYear + 1 : pYear
    };
}
