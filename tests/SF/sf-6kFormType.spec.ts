// import { test, expect } from "@playwright/test";

// const TARGET_ROW_COUNT = 25;

// test("SF-6-K Subform Type", async ({ page }) => {
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

//     const sectionFilterBlock = page.locator('div.styles__focusContainer___13rFy')
//         .filter({ has: page.locator('label', { hasText: /^Forms$/ }) });

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

//     const filterInput = modal.getByTestId('forms-input').last();
//     await filterInput.fill('6-K');

//     const targetLabel = modal.locator('label').filter({ hasText: /^6-K/ }).first();

//     await targetLabel.click();

//     await page.pause();
//     await page.getByRole('button', { name: /^OK$/ }).click();

//     let dateInput = page.locator('//label[text()="Date"]/ancestor::div[5]//input');
//     await dateInput.click({ force: true });
//     await dateInput.pressSequentially('Yesterday', { delay: 100 });
//     await page.getByRole('button', { name: /^Search$/i }).click();

//     const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
//     await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

//     if ((await statusLocator.first().innerText()).includes("No Results Found")) {
//         throw new Error("No results found for selection.");
//     }

//     let resultsFound = 0;
//     await page.pause();
//     while (resultsFound < TARGET_ROW_COUNT) {
//         const currentRow = page.locator(`div[data-test="resultRow"][id="${resultsFound}"]`);
//         const rowExists = await currentRow.count() > 0;

//         if (!rowExists) {
//             console.log(`Row ID ${resultsFound} not found yet. Scrolling...`);
//             await currentRow.last().scrollIntoViewIfNeeded();
//             await page.waitForTimeout(1000);
//             continue;
//         }
//         const allContent =  currentRow.locator('span').filter({ hasText: /^6-K/ }).last();
//         try {
//             await allContent.waitFor({ state: 'attached', timeout: 3000 });
//             console.log(`Row ${resultsFound} ` , await allContent.innerText());
//         } catch (e) {
//             console.log(`Note: Row ${resultsFound} has limited content.`);
//         }

//         resultsFound++;
//         await currentRow.last().scrollIntoViewIfNeeded();
//     }
//     await page.pause();
// });



import { test } from "@playwright/test";
import { SECFilingsPage } from "./sf-6kFormType.class.spec";

const TEST_DATA = [
    { id: 0, form: '6-K', day: 'Today', count: 25 },
    { id: 1, form: '6-K', day: 'Yesterday', count: 25 },
];

for (const data of TEST_DATA) {
    test(`Verify filings for subform: ${data.id}`, async ({ page }) => {
        const filingsPage = new SECFilingsPage(page);

        await page.goto("/");
        await filingsPage.login();
        await filingsPage.selectFormType(data.form);
        await filingsPage.executeSearch(data.day);
        const availableDocs = await filingsPage.getAvailableDocCount(data.form, data.day);
        if (availableDocs > 0) {
            const finalScrapeLimit = Math.min(data.count, availableDocs);
            await filingsPage.scrapeResults(finalScrapeLimit, data.form);
        } else {
            console.log(`Index ${data.id}: Move to next...`);
        }
    });
}