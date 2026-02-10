import { test, expect } from "@playwright/test";

const TEST_COMBINATIONS = [
    {
        name: "Test Case 1: 10-K Only",
        forms: [
            {
                type: "10-K",
                sections: ["Item 1A. Risk Factors", "Item 4. Mine Safety Disclosures"]
            }
        ],
        exclude: ["Cross-References", "Reserved", "Other"]
    },
    {
        name: "Test Case 2: 10-K and 10-Q",
        forms: [
            {
                type: "10-K",
                sections: ["Item 5. Market for Registrant's Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities", "Item 4. Mine Safety Disclosures"]
            },
            {
                type: "10-Q",
                sections: ["Item 1. Financial Statements"]
            }
        ],
        exclude: ["Not Applicable", "Reserved", "Other"]
    },
    {
        name: "Test Case 3: 20-F and 8-K",
        forms: [
            {
                type: "20-F",
                sections: ["Item 4. Information On The Company", "Item 7. Major Shareholders and Related Party Transactions"]
            },
            {
                type: "8-K",
                sections: ["Item 5.04 Temporary Suspension of Trading under Registrant's Employee Benefit Plans", "Item 5.07 Submission of Matters to a Vote of Security Holders"]
            }
        ],
        exclude: ["Cross-References", "Not Applicable", "Other"]
    }
];
const BOILERPLATE_LENGTH_THRESHOLD = 600;
const KEYWORDS_NOT_APPLICABLE = ["none", "n/a", "not applicable", "no information", "not required", "no legal proceeding", "omitted", "not applicable."];
const KEYWORDS_CROSS_REFERENCE = ["refer", "by reference", "included", "added", "see"];
const KEYWORDS_RESERVED = ["reserved"];
const TARGET_ROW_COUNT = 25;
const BOX_WIDTH = 65;

test("SF-XBRL Multi-Combination Suite", async ({ page }) => {

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


    for (const combo of TEST_COMBINATIONS) {
        try {
            console.log(`\n🚀 STARTING COMBINATION: ${combo.name}`);

            const sectionFilterBlock = page.locator('div.styles__focusContainer___13rFy').filter({ has: page.locator('label', { hasText: /^Section$/ }) });
            const sectionPlusBtn = sectionFilterBlock.locator('span._icon_1jkal_249.Add').first();
            const modal = page.locator('div.PopupBody__popup__body___1J_d3');

            while (!(await modal.isVisible())) {
                await sectionPlusBtn.click({ force: true }).catch(() => { });
                await page.waitForTimeout(500);
            }

            for (const formEntry of combo.forms) {
                console.log(`Selecting Form: ${formEntry.type}`);

                const formTypeItem = modal.locator('li.styles__item-list___17b6k')
                    .filter({ has: page.locator('span', { hasText: new RegExp(`^${formEntry.type}$`, 'i') }) });
                await formTypeItem.click();
                await page.waitForTimeout(800);

                for (const sectionName of formEntry.sections) {
                    const checkbox = page.locator(`input[name="${sectionName}"]`);
                    await checkbox.evaluate((node: HTMLInputElement) => {
                        node.checked = true;
                        node.dispatchEvent(new Event('click', { bubbles: true }));
                    });
                    await page.locator('label').filter({ hasText: sectionName }).click();
                }

            }

            await page.locator('label').filter({ hasText: /^Only$/ }).last().click();
            const popupBody = page.locator('div.PopupBody__popup__body___1J_d3.styles__tabs-container___1kNEn');
            const nonMaterialRow = popupBody.locator('div').filter({ has: page.locator('span', { hasText: /^Non-Material Sections$/ }) });
            await nonMaterialRow.locator('span._icon_1jkal_249.Add').first().click({ force: true });

            for (const excludeName of combo.exclude) {
                const row = page.locator('li.styles__check-list-item__container___233d9').filter({ hasText: new RegExp(excludeName) });
                await row.locator('label._checkbox__icon_1xotg_257').click({ force: true });
            }

            await popupBody.getByRole('button', { name: /^OK$/ }).click();

            await sectionFilterBlock.getByRole('button', { name: /^OK$/ }).click();
            //  await page.pause();
            await page.getByRole('button', { name: /^Search$/i }).first().click();
            // await page.pause();
            const statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
            await expect(statusLocator.last()).toBeVisible({ timeout: 60000 });

            const statusText = await statusLocator.innerText();
            //console.log(`[${combo.name}] Status: ${statusText}`);
            if (statusText.toLowerCase().includes("no results found")) {
                console.log(`\n╔${'═'.repeat(BOX_WIDTH)}╗`);
                console.log(`║ ⚠️  SKIPPING: No results found for ${combo.name.padEnd(BOX_WIDTH - 36)} ║`);
                console.log(`╚${'═'.repeat(BOX_WIDTH)}╝\n`);
                continue;
            }

            const docCountMatch = statusText.match(/Docs:\s*([\d,]+)/i);
            let totalAvailableDocs = 0;
            if (docCountMatch) {
                const cleanNumberString = docCountMatch[1].replace(/,/g, '');
                totalAvailableDocs = parseInt(cleanNumberString, 10);
            }
           
            const label = `[${combo.name}]`;
            const countInfo = `Total Documents Found: ${totalAvailableDocs.toLocaleString()}`;

            console.log(`\n╔${'═'.repeat(BOX_WIDTH)}╗`);
            console.log(`║ ${label.padEnd(BOX_WIDTH - 2)} ║`);
            console.log(`╠${'═'.repeat(BOX_WIDTH)}╣`);
            console.log(`║ ${countInfo.padEnd(BOX_WIDTH - 2)} ║`);
            console.log(`╚${'═'.repeat(BOX_WIDTH)}╝\n`);

            let resultsFound = 0;
            const loopLimit = Math.min(TARGET_ROW_COUNT, totalAvailableDocs);
            while (resultsFound < loopLimit) {
                const currentRow = page.locator(`div[data-test="resultRow"][id="${resultsFound}"]`);
                if (!(await currentRow.count() > 0)) {
                    await page.mouse.wheel(0, 600);
                    await page.waitForTimeout(1000);
                    if (resultsFound > 0 && !(await currentRow.count() > 0)) break;
                    continue;
                }

                const allContent = currentRow.locator('a, p');
                const totalItems = await allContent.count();
                const lastAnchorText = (await currentRow.locator('a').last().innerText().catch(() => "")).toLowerCase();
                const shouldTrackReserved = !combo.exclude.includes("Reserved");
                if (lastAnchorText && shouldTrackReserved) {
                    const type = getBoilerplateType(lastAnchorText);
                    console.log(`[${combo.name}] Row ${resultsFound}: ${lastAnchorText}`);
                    console.log('-------------------------------------------------------------');
                    console.log(`╚${type || 'Substantive'} from anchor tag`);
                    console.log('-------------------------------------------------------------');
                    console.log('');
                }
                let startIdx = (totalItems < 4) ? 0 : 2;

                for (let j = startIdx; j < totalItems; j++) {
                    const element = allContent.nth(j);
                    const tagName = await element.evaluate(node => node.tagName.toLowerCase());
                    const text = (await element.innerText()).trim();

                    if (text && tagName === 'p') {
                        const type = getBoilerplateType(text);
                        console.log(`[${combo.name}] Row ${resultsFound}: ${text}`);
                        console.log('-------------------------------------------------------------');
                        console.log(`╚${type || 'Substantive'} from ${tagName} tag`);
                        console.log('-------------------------------------------------------------');
                        console.log('');
                    }
                }
                resultsFound++;
                await currentRow.last().scrollIntoViewIfNeeded();
            }

            if (await page.getByRole('button', { name: /Clear Filters/i }).isVisible()) {
                await page.getByRole('button', { name: /Clear Filters/i }).click();
            }

            //  await page.waitForTimeout(1000);

        } catch (error: any) {
            console.error(`Error processing ${combo}: ${error.message}`);
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
    await page.pause();
});

function getBoilerplateType(text: string): string | null {
    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();
    if (cleanText.length === 0) return "Empty";
    if (cleanText.length >= BOILERPLATE_LENGTH_THRESHOLD) return null;
    if (KEYWORDS_NOT_APPLICABLE.some(kw => lowerText === kw || lowerText === kw + ".")) return "Not Applicable";
    if (KEYWORDS_CROSS_REFERENCE.some(kw => lowerText.includes(kw))) return "Cross-References";
    if (KEYWORDS_RESERVED.some(kw => lowerText.includes(kw))) return "Reserved";
    return "Other";
}