// import { test, expect } from "@playwright/test";

// const TARGET_ROW_COUNT = 25;

// test("SF-6-K Company Type SRC", async ({ page }) => {
//     await page.goto("/");

//     const userField = page.locator('#userid');
//     if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
//         await userField.fill(process.env.APP_USERNAME!);
//         await page.getByRole('button', { name: 'Next' }).click();
//         await page.locator('#password').fill(process.env.APP_PASSWORD!);
//         await page.getByRole('button', { name: 'Sign in' }).click();
//         await page.waitForURL(/.*apps.intelligize.com/, { timeout: 60000 });
//     }

//     await page.locator('text=/SEC Filings/i').first().click();

//     const companyTypeFilterBlock = page.locator('div.styles__focusContainer___13rFy')
//         .filter({ has: page.locator('label', { hasText: /^Company Type\/Status$/ }) });

//     const sectionPlusBtn = companyTypeFilterBlock.locator('span._icon_1jkal_249.Add').first();
//     const modal = page.locator('div.PopupBody__popup__body___1J_d3');

//     while (!(await modal.isVisible())) {
//         await sectionPlusBtn.click({ force: true }).catch(() => { });
//         await page.waitForTimeout(500);

//         if (await sectionPlusBtn.isVisible()) {
//             await sectionPlusBtn.scrollIntoViewIfNeeded();
//         }
//     }
//     await modal.waitFor({ state: 'visible', timeout: 0 });

//     await modal.locator('label[for="IsSRC"]').click();

//     await page.getByRole('button', { name: /^OK$/ }).click();

//     //     let dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
//     //     await dateInput.click({ force: true });
//     //     await dateInput.pressSequentially('Yesterday', { delay: 100 });

//     const formsInput = page.locator('#Forms').getByRole('textbox');
//     await formsInput.click();
//     await formsInput.pressSequentially('10-K', { delay: 500 });
//     await page.waitForTimeout(500);
//     await formsInput.press('Enter');

//     await page.getByRole('button', { name: /^Search$/i }).click();

//     const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//     await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

//     if ((await statusLocator.first().innerText()).includes("No Results Found")) {
//         throw new Error("No results found for selection.");
//     }

//     let resultsFound = 0;
//     await page.pause();
//     // const scrollContainer = page.locator('.ReactVirtualized__Grid__innerScrollContainer').locator('..');
//     const resultsContainer = page.locator('div[role="rowgroup"]').last();
//     while (resultsFound < TARGET_ROW_COUNT) {
//         const scrollContainer = page.locator('.ReactVirtualized__Grid').first();
//         const currentRow = resultsContainer.locator(`div[data-test="resultRow"][id="${resultsFound}"]`).first();
//         const resultLabel = currentRow.locator('span', { hasText: 'Company Type/Status' });
//         const resultValueContainer = resultLabel.locator('xpath=..').locator('p');
//         const allValues = await resultValueContainer.all();

//         for (const value of allValues) {
//             console.log(await value.innerText());
//         }

//         //const xbrlBtn = currentRow.getByRole('button', { name: /Xbrl/i });
//         const previousScroll = await scrollContainer.evaluate(el => el.scrollTop);
//         const viewBtn = currentRow.getByRole('button', { name: /View/i }).last();
//         // await viewBtn.click();
//         //if (await xbrlBtn.isVisible()) {
//         if (await viewBtn.isVisible()) {
//             try {
//                 await viewBtn.click();
//                 const ixbrlBtn = page.locator('text=/^iXBRL$/i').first();
//                 await ixbrlBtn.click();

//                 const ex101Link = page.locator('text=/^EX-101$/i').first();
//                 await ex101Link.click();

//             } catch (error) {
//                 console.log("XBRL content not found or clickable for row", resultsFound);
//             } finally {
//                 const activeTab = page.locator('//span[contains(text(), "Docs:")]');
//                 if (await activeTab.isVisible()) {
//                     await activeTab.first().click();
//                 }
//             }
//         } else {
//             console.log(`Row ${resultsFound} has no XBRL Doc`)
//         }
//         await scrollContainer.evaluate((el, scroll) => {
//             el.scrollTop = scroll;
//         }, previousScroll);
//         await currentRow.last().scrollIntoViewIfNeeded();
//         resultsFound++
//         await currentRow.last().scrollIntoViewIfNeeded();
//     }
//     await page.pause();
// });

import { test, expect } from "@playwright/test";

const TARGET_ROW_COUNT = 25;

test("SF Company Type", async ({ page }) => {
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

    const companyTypeFilterBlock = page.locator('div.styles__focusContainer___13rFy')
        .filter({ has: page.locator('label', { hasText: /^Company Type\/Status$/ }) });

    const sectionPlusBtn = companyTypeFilterBlock.locator('span._icon_1jkal_249.Add').first();
    const modal = page.locator('div.PopupBody__popup__body___1J_d3');

    while (!(await modal.isVisible())) {
        await sectionPlusBtn.click({ force: true }).catch(() => { });
        await page.waitForTimeout(500);

        if (await sectionPlusBtn.isVisible()) {
            await sectionPlusBtn.scrollIntoViewIfNeeded();
        }
    }
    await modal.waitFor({ state: 'visible', timeout: 0 });

    //await modal.locator('label[for="IsSRC"]').click();
    //await modal.locator('label[for="IsShellCompany"]').click();
    //await modal.locator('label[for="IsWKSI"]').click();
    await modal.locator('label[for="IsEGC"]').click();
    await page.getByRole('button', { name: /^OK$/ }).click();

    const formsInput = page.locator('#Forms').getByRole('textbox');
    await formsInput.click();
    await formsInput.pressSequentially('10-K', { delay: 500 });
    await page.waitForTimeout(500);
    await formsInput.press('Enter');

    await page.getByRole('button', { name: /^Search$/i }).click();

    const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
    await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

    if ((await statusLocator.first().innerText()).includes("No Results Found")) {
        throw new Error("No results found for selection.");
    }

    let resultsFound = 0;
    await page.pause();

    while (resultsFound < TARGET_ROW_COUNT) {
        const scroller = page.locator('.ReactVirtualized__Grid').last();
        //let resultsContainer = scroller.locator('div[role="rowgroup"]').first();
        let resultsContainer = scroller.locator('> div[role="rowgroup"]');
        const rowHeight = await scroller.evaluate((el) => {
            const sampleRow = el.querySelector('[data-test="resultRow"]');
            return sampleRow ? sampleRow.getBoundingClientRect().height : 115;
        });

        console.log(`Measured row height: ${rowHeight}px`);
        await scroller.evaluate((el, { index, height }) => {
            el.scrollTop = index * height;
        }, { index: resultsFound, height: rowHeight });

        console.log(`Processing ID: ${1 + resultsFound}`);

        const currentRowCount = await resultsContainer.locator(`div[data-test="resultRow"][id="${resultsFound}"]`).count();
        console.log("current row count", resultsFound, currentRowCount);

        //let currentRow = resultsContainer.locator(`div[data-test="resultRow"][id="${resultsFound}"]`).first();
        let currentRow = resultsContainer.locator(`> div > div[data-test="resultRow"][id="${resultsFound}"]`).first();

        const rowExists = await currentRow.count() > 0;
        if (rowExists) {
            await currentRow.evaluate(el => el.scrollIntoView({ block: 'start' }));
        } else {

            await scroller.evaluate(el => el.scrollTop += el.clientHeight);
            await page.waitForTimeout(1000);
            continue;
        }

        await currentRow.evaluate(el => {
            el.style.border = '5px solid red';
            el.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            console.log('Currently looking at DIV ID:', el.id);
        });
        await page.pause();
        await page.waitForTimeout(1000);

        const viewBtnCount = await currentRow.getByRole('button', { name: /View/i }).count();
        console.log("view button count ", viewBtnCount);
        const viewBtn = currentRow.getByRole('button', { name: /View/i }).last();

        const resultLabel = currentRow.locator('span', { hasText: 'Company Type/Status' });
        const resultValueContainer = resultLabel.locator('xpath=..').locator('p');
        const allValues = await resultValueContainer.all();

        for (const value of allValues) {
            console.log(await value.innerText());
        }
        if (await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            try {
                await viewBtn.click();
                await page.locator('text=/^iXBRL$/i').first().click();
                await page.locator('text=/^EX-101$/i').first().click();

                const xbrlFrame = page.frameLocator('iframe[src*="/SECFilings/Documents/"]').first();
                const getValue = async (labels: string[]) => {
                    const combinedSelector = labels.map(label => `tr:has-text("${label}")`).join(', ');
                    const row = xbrlFrame.locator(combinedSelector).first();

                    return await row.evaluate(tr => {
                        const textCells = Array.from(tr.querySelectorAll('td.text'));
                        const booleanCell = textCells.find(c => {
                            const content = c.textContent?.trim().toLowerCase();
                            return content === 'true' || content === 'false' || content === 'Yes' || content === 'No';
                        });

                        return booleanCell ? booleanCell.textContent?.trim() : "Boolean value not found";
                    });
                };

                //const EntitySmallBuisinesValue = await getValue(["Entity Small Business"]);
                //const EntitySmallBuisinesValue = await getValue(["Entity Shell Company"]);
                //const EntitySmallBuisinesValue = await getValue(["Entity Well-known Seasoned Issuer"]);
                const EntitySmallBuisinesValue = await getValue(["Entity Emerging Growth Company"]);
                console.log("EntitySmallBuisinesValue" ,EntitySmallBuisinesValue );


            } catch {
                console.log("XBRL content not found for row", resultsFound);
            } finally {
                const activeTab = page.locator('//span[contains(text(), "Docs:")]');
                if (await activeTab.first().isVisible()) {
                    await activeTab.first().click();
                }

                await page.waitForTimeout(2000);
            }
        } else {
            console.log(`Row ${resultsFound} has no XBRL Doc`);
        }
        resultsFound++;
    }
    await page.pause();
});
