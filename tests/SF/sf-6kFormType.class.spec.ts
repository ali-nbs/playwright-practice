import { Page, Locator, expect } from "@playwright/test";

export class SECFilingsPage {
    readonly page: Page;
    readonly modal: Locator;
    readonly formsInput: Locator;
    readonly statusLocator: Locator;

    constructor(page: Page) {
        this.page = page;
        this.modal = page.locator('div.PopupBody__popup__body___1J_d3');
        this.formsInput = this.modal.getByTestId('forms-input');
        this.statusLocator = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
    }

    async login() {
        const userField = this.page.locator('#userid');
        if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
            await userField.fill(process.env.APP_USERNAME!);
            await this.page.getByRole('button', { name: 'Next' }).click();
            await this.page.locator('#password').fill(process.env.APP_PASSWORD!);
            await this.page.getByRole('button', { name: 'Sign in' }).click();
            await this.page.waitForURL(/.*apps.intelligize.com/, { timeout: 60000 });
        }
    }

    async selectFormType(formType: string) {
        await this.page.locator('text=/SEC Filings/i').first().click();

        const sectionFilterBlock = this.page.locator('div.styles__focusContainer___13rFy')
            .filter({ has: this.page.locator('label', { hasText: /^Forms$/ }) });

        const sectionPlusBtn = sectionFilterBlock.locator('span._icon_1jkal_249.Add').first();

        while (!(await this.modal.isVisible())) {
            await sectionPlusBtn.click({ force: true }).catch(() => { });
            await this.page.waitForTimeout(500);
        }

        await this.formsInput.last().fill(formType);
        const targetLabel = this.modal.locator('label').filter({ hasText: new RegExp(`^${formType}`, 'i') }).first();
        await targetLabel.click();
        await this.page.getByRole('button', { name: /^OK$/ }).click();
    }

    // async runSearch(dateValue: string): Promise<boolean> {
    //     let dateInput = this.page.locator('//label[text()="Date"]/ancestor::div[5]//input');
    //     await dateInput.click({ force: true });
    //     await dateInput.pressSequentially(dateValue, { delay: 100 });
    //     await this.page.getByRole('button', { name: /^Search$/i }).click();
    //     await expect(this.statusLocator.first()).toBeVisible({ timeout: 60000 });
    //     const statusText = await this.statusLocator.first().innerText();
    //     if (statusText.includes("No Results Found")) {
    //         console.log(`Skipping scrape: No documents found for ${dateValue}`);
    //         return false;
    //     }
    //     return true;
    // }
    async executeSearch(dateValue: string): Promise<void> {
        const dateInput = this.page.locator('//label[text()="Date"]/ancestor::div[5]//input');

        await dateInput.click({ force: true });
        await dateInput.fill(''); 
        await dateInput.pressSequentially(dateValue, { delay: 100 });

        await this.page.getByRole('button', { name: /^Search$/i }).click();
        await expect(this.statusLocator.first()).toBeVisible({ timeout: 60000 });
    }

    async getAvailableDocCount(comboName: string, dateValue: string): Promise<number> {
        const statusText = await this.statusLocator.first().innerText();

        if (statusText.includes("No Results Found")) {
            console.log(`[${comboName}] Skipping scrape: No documents found for ${dateValue}`);
            return 0;
        }

        const docCountMatch = statusText.match(/Docs:\s*([\d,]+)/i);
        let totalAvailableDocs = 0;

        if (docCountMatch) {
            const cleanNumberString = docCountMatch[1].replace(/,/g, '');
            totalAvailableDocs = parseInt(cleanNumberString, 10);
        }

        console.log(`[${comboName}] Total Documents Found: ${totalAvailableDocs.toLocaleString()}`);
        return totalAvailableDocs;
    }

    async scrapeResults(targetCount: number, formType: string) {
        let resultsFound = 0;
        while (resultsFound < targetCount) {
            const currentRow = this.page.locator(`div[data-test="resultRow"][id="${resultsFound}"]`);
            if (await currentRow.count() === 0) {
                await currentRow.last().scrollIntoViewIfNeeded();
                await this.page.waitForTimeout(1000);
                continue;
            }
            const allContent = currentRow.locator('span').filter({ hasText: new RegExp(`^${formType}`, 'i') }).last();
            try {
                await allContent.waitFor({ state: 'attached', timeout: 3000 });
                console.log(`Row ${resultsFound}:`, await allContent.innerText());
            } catch (e) {
                console.log(`Note: Row ${resultsFound} has limited content.`);
            }

            resultsFound++;
            await currentRow.last().scrollIntoViewIfNeeded();
        }
    }
}