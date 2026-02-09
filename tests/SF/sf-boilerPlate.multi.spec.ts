
// import { test, expect } from "@playwright/test";

// const SECTIONS_TO_CHECK = [
//     "Item 5. Market for Registrant's Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities",
//     "Item 4. Mine Safety Disclosures"
// ];

// const BOILERPLATE_TO_EXCLUDE = [
//     "Cross-References",
//     "Reserved",
//     "Other",
//     // "Not Applicable"
// ];
// const BOILERPLATE_LENGTH_THRESHOLD = 600;

// const KEYWORDS_NOT_APPLICABLE = [
//     "none", "n/a", "not applicable", "no information", 
//     "not required", "no legal proceeding", "omitted", "not applicable."
// ];

// const KEYWORDS_CROSS_REFERENCE = [
//     "refer", "by reference", "included", "added", "see"
// ];

// const KEYWORDS_RESERVED = ["reserved"];

// const TARGET_ROW_COUNT = 25;

// test("SF-XBRL Parsing - Dynamic", async ({ page }) => {
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

//     // const sectionFilterBlock = page.locator('div.styles__focusContainer___13rFy')
//     //     .filter({ has: page.locator('label', { hasText: /^Section$/ }) });
//     // await sectionFilterBlock.locator('span._icon_1jkal_249.Add').click({ force: true });

//     const sectionFilterBlock = page.locator('div.styles__focusContainer___13rFy')
//         .filter({ has: page.locator('label', { hasText: /^Section$/ }) });

//     const sectionPlusBtn = sectionFilterBlock.locator('span._icon_1jkal_249.Add').first();
//     const modal = page.locator('div.PopupBody__popup__body___1J_d3');

//     while (!(await modal.isVisible())) {
//         await sectionPlusBtn.click({ force: true }).catch(() => { });
//         await page.waitForTimeout(500);

//         if (await sectionPlusBtn.isVisible()) {
//             await sectionPlusBtn.scrollIntoViewIfNeeded();
//         }
//     }
//     await modal.waitFor({ state: 'visible', timeout: 0 });

//     for (const sectionName of SECTIONS_TO_CHECK) {
//         const checkbox = page.locator(`input[name="${sectionName}"]`);
//         await checkbox.evaluate((node: HTMLInputElement) => {
//             node.checked = true;
//             node.dispatchEvent(new Event('click', { bubbles: true }));
//         });
//         await page.locator('label').filter({ hasText: sectionName }).click();
//     }
//     await page.locator('label').filter({ hasText: /^Only$/ }).last().click();

//     const popupBody = page.locator('div.PopupBody__popup__body___1J_d3.styles__tabs-container___1kNEn');
//     const nonMaterialRow = popupBody.locator('div').filter({
//         has: page.locator('span', { hasText: /^Non-Material Sections$/ })
//     });

//     await nonMaterialRow.locator('span._icon_1jkal_249.Add').first().click({ force: true });

//     for (const excludeName of BOILERPLATE_TO_EXCLUDE) {
//         const row = page.locator('li.styles__check-list-item__container___233d9')
//             .filter({ hasText: new RegExp(excludeName) });
//         await row.locator('label._checkbox__icon_1xotg_257').click({ force: true });
//     }

//     await popupBody.getByRole('button', { name: /^OK$/ }).click();
//     await sectionFilterBlock.getByRole('button', { name: /^OK$/ }).click();
//     await page.getByRole('button', { name: /^Search$/i }).click();

//     const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//     await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

//     if ((await statusLocator.first().innerText()).includes("No Results Found")) {
//         throw new Error("No results found for selection.");
//     }

//     // for (let i = 0; i < 3; i++) {
//     //     const currentRow = page.locator(`div[data-test="resultRow"][id="${i}"]`);
//     //     const allContent = currentRow.locator('a, p');
//     //     const totalItems = await allContent.count();

//     //     console.log(`--- Row ${i} Sequence ---`);
//     //     for (let j = 2; j < totalItems; j++) {
//     //         const element = allContent.nth(j);
//     //         const tagName = await element.evaluate(node => node.tagName.toLowerCase());
//     //         const text = await element.innerText();

//     //         if (text.trim()) {
//     //             console.log(`${tagName === 'a' ? '[Link]' : '[Text]'}: ${text.trim()}`);
//     //         }
//     //     }
//     // }

//     // let processedIds = new Set();
//     // let resultsFound = 0;

//     // while (resultsFound < TARGET_ROW_COUNT) {
//     //     const visibleRows = page.locator('div[data-test="resultRow"]');
//     //     const count = await visibleRows.count();
//     //     console.log(`Visible Rows Count: ${count}`);
//     //     if (count === 0) break;

//     //     for (let i = 0; i < count; i++) {
//     //         const row = visibleRows.nth(i);
//     //         const rowId = await row.getAttribute('id');

//     //         if (rowId && !processedIds.has(rowId)) {
//     //             const allContent = row.locator('a, p');

//     //             try {
//     //                 // Wait specifically for the 3rd element (index 2) to exist
//     //                 await allContent.nth(2).waitFor({ state: 'attached', timeout: 15000 });
//     //             } catch (e) {
//     //                 // If it takes too long, the row might actually be a short one.
//     //                 // We'll log it and move on so the script doesn't get stuck.
//     //                 console.log(`Row ${rowId} content took too long to load or is short.`);
//     //             }
//     //             processedIds.add(rowId);
//     //             resultsFound++;

//     //             console.log(`--- Processing Row ID: ${rowId} (Total: ${resultsFound}) ---`);

//     //             // Extract sequence content skipping first 2 metadata links
//     //           //  const allContent = row.locator('a, p');
//     //             const totalItems = await allContent.count();

//     //             for (let j = 2; j < totalItems; j++) {
//     //                 const element = allContent.nth(j);
//     //                 const tagName = await element.evaluate(node => node.tagName.toLowerCase());
//     //                 const text = await element.innerText();

//     //                 if (text.trim()) {
//     //                     console.log(`${tagName === 'a' ? '[Link]' : '[Text]'}: ${text.trim()}`);
//     //                 }
//     //             }

//     //             if (resultsFound >= TARGET_ROW_COUNT) break;
//     //         }
//     //     }

//     //     // Scroll the last visible item to load new rows into the DOM
//     //     await visibleRows.last().scrollIntoViewIfNeeded();
//     //     await page.waitForTimeout(800); // Wait for React virtualization to render new nodes
//     // }
//     let resultsFound = 0;

//     while (resultsFound < TARGET_ROW_COUNT) {
//         const currentRow = page.locator(`div[data-test="resultRow"][id="${resultsFound}"]`);
//         const rowExists = await currentRow.count() > 0;

//         if (!rowExists) {
//             console.log(`Row ID ${resultsFound} not found yet. Scrolling...`);
//             await page.mouse.wheel(0, 600);
//             await page.waitForTimeout(1000);
//             continue;
//         }
//         const allContent = currentRow.locator('a, p');
//         try {
//             await allContent.nth(2).waitFor({ state: 'attached', timeout: 3000 });
//         } catch (e) {
//             console.log(`Note: Row ${resultsFound} has limited content.`);
//         }

//         const totalItems = await allContent.count();
//         console.log(`--- Row ${resultsFound} Sequence (Total Items: ${totalItems}) ---`);

//         for (let j = 2; j < totalItems; j++) {
//             const element = allContent.nth(j);
//             const tagName = await element.evaluate(node => node.tagName.toLowerCase());
//             const text = await element.innerText();

//             if (text.trim()) {
//                 console.log(`${tagName === 'a' ? '[Link]' : '[Text]'}: ${text.trim()}`);
//             }
//         }

//         resultsFound++;
//         await currentRow.last().scrollIntoViewIfNeeded();
//     }
//     await page.pause();
// });







import { test, expect } from "@playwright/test";

const SECTIONS_TO_CHECK = [
    //"Item 4. Mine Safety Disclosures"
    "Item 1. Financial Statements"
];

const BOILERPLATE_TO_EXCLUDE = [
    "Cross-References",
    "Reserved",
    "Other",
    // "Not Applicable"
];
const BOILERPLATE_LENGTH_THRESHOLD = 600;

const KEYWORDS_NOT_APPLICABLE = [
    "none", "n/a", "not applicable", "no information",
    "not required", "no legal proceeding", "omitted", "not applicable."
];

const KEYWORDS_CROSS_REFERENCE = [
    "refer", "by reference", "included", "added", "see"
];

const KEYWORDS_RESERVED = ["reserved"];

const TARGET_ROW_COUNT = 25;

test("SF-XBRL Parsing - Dynamic", async ({ page }) => {
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

    let formType = '10-Q';
    const formTypeItem = modal.locator('li.styles__item-list___17b6k')
        .filter({ has: page.locator('span', { hasText: new RegExp(`^${formType}$`, 'i') }) });
    await formTypeItem.click();
    await page.waitForTimeout(500);

    await page.pause();

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

    let resultsFound = 0;

    while (resultsFound < TARGET_ROW_COUNT) {
        const currentRow = page.locator(`div[data-test="resultRow"][id="${resultsFound}"]`);
        const rowExists = await currentRow.count() > 0;

        if (!rowExists) {
            console.log(`Row ID ${resultsFound} not found yet. Scrolling...`);
            // await page.mouse.wheel(0, 600);
            await currentRow.last().scrollIntoViewIfNeeded();
            await page.waitForTimeout(1000);
            continue;
        }

        const allContent = currentRow.locator('a, p');
        try {
            // Wait for the main data area (j=2) to be attached
            await allContent.nth(2).waitFor({ state: 'attached', timeout: 3000 });
        } catch (e) {
            console.log(`Note: Row ${resultsFound} has limited content.`);
        }

        const totalItems = await allContent.count();
        console.log('----------------------------------------------------------------');
        console.log(`--- Row ${resultsFound} totalItems ${totalItems} ---`);
        console.log('----------------------------------------------------------------');

        let combinedRowText = "";
        let startIdx = 2;

        if (totalItems < 4) {
            startIdx = 0;
        }

        for (let j = startIdx; j < totalItems; j++) {
            const element = allContent.nth(j);
            const tagName = await element.evaluate(node => node.tagName.toLowerCase());
            const text = await element.innerText();

            if (text.trim()) {
                console.log(`${tagName === 'a' ? '[Link]' : '[Text]'}: ${text.trim()}`);
                combinedRowText += text + " ";
                if (tagName === 'p') {
                    const type = getBoilerplateType(text);
                    if (type) {
                        console.log(`>>> VERIFICATION: [${type}] (Length: ${text.trim().length})`);
                        console.log('----------------------------------------------------------------');
                        console.log('----------------------------------------------------------------');
                    } else {
                        console.log(`>>> VERIFICATION: [Substantive Content] (Length: ${combinedRowText.trim().length})`);
                    }
                }
            }
        }
        resultsFound++;
        await currentRow.last().scrollIntoViewIfNeeded();
    }
    await page.pause();
});

function getBoilerplateType(text: string): string | null {
    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();

    if (cleanText.length == 0) {
        return "Empty";
    }

    if (cleanText.length >= BOILERPLATE_LENGTH_THRESHOLD) {
        return null;
    }

    if (KEYWORDS_NOT_APPLICABLE.some(kw => lowerText === kw || lowerText === kw + ".")) {
        return "Not Applicable";
    }

    if (KEYWORDS_CROSS_REFERENCE.some(kw => lowerText.includes(kw))) {
        return "Cross-References";
    }

    if (KEYWORDS_RESERVED.some(kw => lowerText.includes(kw))) {
        return "Reserved";
    }

    return "Other";
}