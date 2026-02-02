// import { test, expect } from "@playwright/test";
// import * as fs from 'fs';
// import path from "path";

// test("SF-XBRL Parsing", async ({ page }) => {

//     // const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
//     // const logDirectory = path.resolve(__dirname, './Results/sf-xbrlParsing');

//     // if (!fs.existsSync(logDirectory)) {
//     //     fs.mkdirSync(logDirectory, { recursive: true });
//     // }

//     // const fileName = path.join(logDirectory, `sf-xbrlParsing-${timestamp}.txt`);
//     // const logToFile = (message: any) => {
//     //     const output = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
//     //     fs.appendFileSync(fileName, output + "\n");
//     //     console.log(output);
//     // };

//     await page.goto("/");

//     // 1. Login Logic
//     const userField = page.locator('#userid');
//     if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
//         await userField.fill(process.env.APP_USERNAME!);
//         await page.getByRole('button', { name: 'Next' }).click();
//         await page.locator('#password').fill(process.env.APP_PASSWORD!);
//         await page.getByRole('button', { name: 'Sign in' }).click();
//         await page.waitForURL(/.*apps.intelligize.com/, { timeout: 60000 });
//     }

//     await page.locator('text=/SEC Filings/i').first().click();
//     await page.pause();
//     const sectionFilterBlock = page.locator('div.styles__focusContainer___13rFy')
//         .filter({ has: page.locator('label', { hasText: /^Section$/ }) });

//     const sectionPlusBtn = sectionFilterBlock.locator('span._icon_1jkal_249.Add');
//     await sectionPlusBtn.click({ force: true });
//     //  await page.pause();

//     //const item4checkbox = page.locator('input[name="Item 4. Mine Safety Disclosures"]');
//     const item4checkbox = page.locator('input[name="Item 5. Market for Registrant\'s Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities"]');

//     await item4checkbox.evaluate((node: HTMLInputElement) => {
//         node.checked = true;
//         node.dispatchEvent(new Event('click', { bubbles: true }));
//     });

//     //const item4checkbox1 = page.locator('label').filter({ hasText: 'Item 4. Mine Safety Disclosures' });
//     const item4checkbox1 = page.locator('label').filter({ hasText: 'Item 5. Market for Registrant\'s Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities' });
//     await item4checkbox1.waitFor({ state: 'attached' });
//     await item4checkbox1.click();

//     const onlyLabel = page.locator('label').filter({ hasText: /^Only$/ }).last();
//     await onlyLabel.click();
//     ///

//     const popupBody = page.locator('div.PopupBody__popup__body___1J_d3.styles__tabs-container___1kNEn');

//     const nonMaterialRow = popupBody.locator('div').filter({
//         has: page.locator('span', { hasText: /^Non-Material Sections$/ })
//     });
//     const plusBtn = nonMaterialRow.locator('span._icon_1jkal_249.Add');
//     await plusBtn.first().click({ force: true });
//     //  await page.pause();

//     // const notApplicableRow = page.locator('li.styles__check-list-item__container___233d9').filter({ hasText: /^Not Applicable/ });
//     // await notApplicableRow.locator('label._checkbox__icon_1xotg_257').click({ force: true });

//     const crossRefRow = page.locator('li.styles__check-list-item__container___233d9').filter({ hasText: /Cross-References/ });
//     await crossRefRow.locator('label._checkbox__icon_1xotg_257').click({ force: true });

//     const reservedRow = page.locator('li.styles__check-list-item__container___233d9').filter({ hasText: /^Reserved/ });
//     await reservedRow.locator('label._checkbox__icon_1xotg_257').click({ force: true });

//     const otherRow = page.locator('li.styles__check-list-item__container___233d9').filter({ hasText: /^Other/ });
//     await otherRow.locator('label._checkbox__icon_1xotg_257').click({ force: true });

//     let okBtn = popupBody.getByRole('button', { name: /^OK$/ });
//     await okBtn.click();

//     okBtn = sectionFilterBlock.getByRole('button', { name: /^OK$/ });
//     await okBtn.click();

//     await page.getByRole('button', { name: /^Search$/i }).click();
//     const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//     await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });
//     const statusText = await statusLocator.first().innerText();
//     if (statusText.includes("No Results Found")) {
//         throw new Error("No results found for the specified form types.");
//     } else {
//         for (let i = 0; i < 3; i++) {
//             const currentRow = page.locator(`div[data-test="resultRow"][id="${i}"]`);
//             const allContent = currentRow.locator('a, p');
//             const totalItems = await allContent.count();

//             console.log(`--- Row ${i} Sequence (${totalItems} items) ---`);

//             for (let j = 2; j < totalItems; j++) {
//                 const element = allContent.nth(j);
//                 const tagName = await element.evaluate(node => node.tagName.toLowerCase());
//                 const text = await element.innerText();

//                 if (text.trim()) {
//                     const type = tagName === 'a' ? '[Link]' : '[Text]';
//                     console.log(`${type}: ${text.trim()}`);
//                 }
//             }
//         }
//         await page.pause();
//     }
// });


import { test, expect } from "@playwright/test";

// --- CONFIGURATION ---
const SECTIONS_TO_CHECK = [
    "Item 5. Market for Registrant's Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities",
    "Item 4. Mine Safety Disclosures"
];

const BOILERPLATE_TO_EXCLUDE = [
    "Cross-References",
    "Reserved",
    "Other",
    // "Not Applicable"
];
// ---------------------

test("SF-XBRL Parsing - Dynamic", async ({ page }) => {
    await page.goto("/");

    // 1. Login Logic
    const userField = page.locator('#userid');
    if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
        await userField.fill(process.env.APP_USERNAME!);
        await page.getByRole('button', { name: 'Next' }).click();
        await page.locator('#password').fill(process.env.APP_PASSWORD!);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(/.*apps.intelligize.com/, { timeout: 60000 });
    }

    await page.locator('text=/SEC Filings/i').first().click();

    // const sectionFilterBlock = page.locator('div.styles__focusContainer___13rFy')
    //     .filter({ has: page.locator('label', { hasText: /^Section$/ }) });
    // await sectionFilterBlock.locator('span._icon_1jkal_249.Add').click({ force: true });

    const sectionFilterBlock = page.locator('div.styles__focusContainer___13rFy')
        .filter({ has: page.locator('label', { hasText: /^Section$/ }) });

    const sectionPlusBtn = sectionFilterBlock.locator('span._icon_1jkal_249.Add').first();
    const modal = page.locator('div.PopupBody__popup__body___1J_d3');

    while (!(await modal.isVisible())) {
        await sectionPlusBtn.click({ force: true }).catch(() => { });
        await page.waitForTimeout(500);

        if (await sectionPlusBtn.isVisible()) {
            await sectionPlusBtn.scrollIntoViewIfNeeded();
        }
    }
    await modal.waitFor({ state: 'visible', timeout: 0 });

    for (const sectionName of SECTIONS_TO_CHECK) {
        const checkbox = page.locator(`input[name="${sectionName}"]`);
        await checkbox.evaluate((node: HTMLInputElement) => {
            node.checked = true;
            node.dispatchEvent(new Event('click', { bubbles: true }));
        });
        await page.locator('label').filter({ hasText: sectionName }).click();
    }
    await page.locator('label').filter({ hasText: /^Only$/ }).last().click();

    const popupBody = page.locator('div.PopupBody__popup__body___1J_d3.styles__tabs-container___1kNEn');
    const nonMaterialRow = popupBody.locator('div').filter({
        has: page.locator('span', { hasText: /^Non-Material Sections$/ })
    });

    await nonMaterialRow.locator('span._icon_1jkal_249.Add').first().click({ force: true });

    for (const excludeName of BOILERPLATE_TO_EXCLUDE) {
        const row = page.locator('li.styles__check-list-item__container___233d9')
            .filter({ hasText: new RegExp(excludeName) });
        await row.locator('label._checkbox__icon_1xotg_257').click({ force: true });
    }

    await popupBody.getByRole('button', { name: /^OK$/ }).click();
    await sectionFilterBlock.getByRole('button', { name: /^OK$/ }).click();
    await page.getByRole('button', { name: /^Search$/i }).click();

    const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
    await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

    if ((await statusLocator.first().innerText()).includes("No Results Found")) {
        throw new Error("No results found for selection.");
    }

    for (let i = 0; i < 3; i++) {
        const currentRow = page.locator(`div[data-test="resultRow"][id="${i}"]`);
        const allContent = currentRow.locator('a, p');
        const totalItems = await allContent.count();

        console.log(`--- Row ${i} Sequence ---`);
        for (let j = 2; j < totalItems; j++) {
            const element = allContent.nth(j);
            const tagName = await element.evaluate(node => node.tagName.toLowerCase());
            const text = await element.innerText();

            if (text.trim()) {
                console.log(`${tagName === 'a' ? '[Link]' : '[Text]'}: ${text.trim()}`);
            }
        }
    }
    await page.pause();
});