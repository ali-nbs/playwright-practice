import { test, expect } from '@playwright/test';

test("Fiscal-Year", async ({ page, context }) => {

    await page.goto("/");

    if (await page.locator('#userid').isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log("Not logged in. Performing login...");
        await page.locator('#userid').fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();

        await page.waitForURL(/.*apps.intelligize.com/);
        await page.context().storageState({ path: 'auth.json' });
    }

    const secLink = page.locator('text=/SEC Filings/i').first();
    await secLink.click();

    const accessionNoInput = page.locator('div')
        .filter({ hasText: /^Accession Number$/ })
        .locator('input');
    await expect(accessionNoInput).toBeVisible({ timeout: 240000 });
    await accessionNoInput.fill('0000876167-26-000008');

    const searchBtn = page.getByRole('button', { name: /^Search$/i });
    await searchBtn.click();

    const viewBtn = page.getByRole('button', { name: /^View$/i }).first();
    await viewBtn.click();

    const documentFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();
    const periodEndElement = documentFrame.locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]');
    await periodEndElement.waitFor({ state: 'attached', timeout: 15000 });

    const periodEndValue:any = await periodEndElement.textContent();
    console.log(` Quarterly Period Ended: ${periodEndValue?.trim()}`);

    const ixbrlBtn = page.locator('text=/^iXBRL$/i').first();
    await ixbrlBtn.waitFor({ state: 'visible', timeout: 240000 });
    await ixbrlBtn.click();

    const ex101Link = page.locator('text=/^EX-101$/i').first();
    await ex101Link.waitFor({ state: 'visible', timeout: 240000 });
    await ex101Link.click();
    await page.pause();

    // const documentFrame = page.frameLocator('iframe[src*="/SECFilings/Documents/"]').first();

    // const targets = [
    //     { label: "Document Period End Date", key: "periodEndDate" },
    //     { label: "Document Fiscal Year Focus", key: "fiscalYear" },
    //     { label: "Document Fiscal Period Focus", key: "fiscalPeriod" },
    //     { label: "Current Fiscal Year End Date", key: "yearEndDate" }
    // ];

    // const finalData: Record<string, string> = {};

    // // Use evaluateAll to process all rows once for speed and stability
    // const allRows = await documentFrame.locator('tr').evaluateAll((rows) => {
    //     return rows.map(tr => {
    //         const cells = Array.from(tr.querySelectorAll('td'));
    //         // Filter out hidden cells to match your "Visible Cells Array" log
    //         return cells
    //             .filter(td => window.getComputedStyle(td).display !== 'none')
    //             .map(td => td.textContent?.trim() || "")
    //             .filter(text => text.length > 0);
    //     }).filter(rowArray => rowArray.length >= 2);
    // });

    // // Match our targets against the extracted row arrays
    // targets.forEach(target => {
    //     const match = allRows.find(row => row[0].includes(target.label));
    //     if (match) {
    //         // The value is the last element in the array
    //         finalData[target.key] = match[match.length - 1].replace(/\s+/g, ' ');
    //         console.log(` ${target.label}: ${finalData[target.key]}`);
    //     } else {
    //         console.log(` ${target.label}: Not found in table.`);
    //     }
    // });
    //const docFrame = page.frameLocator('iframe[src*="/SECFilings/Documents/"]').first();
    const xbrlFrame = page.locator('iframe[src*="/SECFilings/Documents/"]').first().contentFrame();

    const getValue = async (label: string) => {
        const row = xbrlFrame.locator('tr').filter({ hasText: label }).first();
        const val = await row.evaluate(tr => {
            const cells = Array.from(tr.querySelectorAll('td'));
            const dataCells = cells.filter(c => c.textContent?.trim());
            return dataCells.length > 0 ? dataCells[dataCells.length - 1].textContent : "";
        });
        return val?.replace(/\s+/g, ' ').trim();
    };

    const periodEnd = await getValue("Document Period End Date");
    const fiscalYear = await getValue("Document Fiscal Year Focus");
    const fiscalPeriod = await getValue("Document Fiscal Period Focus");
    const yearEnd = await getValue("Current Fiscal Year End Date");

    console.log(`Results: ${periodEnd}, ${fiscalYear}, ${fiscalPeriod}, ${yearEnd}`);

    function calculateDynamicFiscal(periodStr:string, yearEndStr:string) {
        const periodDate = new Date(periodStr);
        const pMonth = periodDate.getMonth() + 1;
        const pYear = periodDate.getFullYear();

        console.log("periodData", periodDate);
        console.log("pMonth", pMonth);
        console.log("pYear", pYear);
        const fyEndMonth = parseInt(yearEndStr.split('-')[2]);
        console.log("fyEndMonth", fyEndMonth);

        const fyStartMonth = (fyEndMonth % 12) + 1;
        console.log("fyStartMonth", fyStartMonth);

        let monthsSinceStart = (pMonth - fyStartMonth + 12) % 12;
        console.log("monthsSinceStart", monthsSinceStart);
        let quarterNum = Math.floor(monthsSinceStart / 3) + 1;
        console.log("quarterNum", quarterNum);
        const calculatedQuarter = `Q${quarterNum}`;
        console.log("calculatedQuarter", calculatedQuarter);

        let yearOccurrences = { current: 0, next: 0 };
        console.log("yearOccurrences", yearOccurrences);
        for (let i = 0; i < 3; i++) {
            let currentMonthInQ = (pMonth - (2 - i) + 12) % 12 || 12;
            if (currentMonthInQ < fyStartMonth && pMonth >= fyStartMonth) {
                yearOccurrences.next++;
            } else if (currentMonthInQ >= fyStartMonth && pMonth < fyStartMonth) {
                yearOccurrences.current++;
            } else {
                yearOccurrences.current++;
            }
        }

        const finalFiscalYear = yearOccurrences.next > yearOccurrences.current ? pYear + 1 : pYear;

        return {
            quarter: calculatedQuarter,
            fiscalYear: finalFiscalYear,
            debug: { fyStartMonth, pMonth, yearOccurrences }
        };
    }

    const fiscalResult = calculateDynamicFiscal(periodEndValue, yearEnd);
    console.log(`Calculated: ${fiscalResult.quarter} ${fiscalResult.fiscalYear}`);
    await page.pause();
})





