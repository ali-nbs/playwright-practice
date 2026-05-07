import { Page, Locator, expect } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

export class SECFilingsPage {
  readonly page: Page;
  readonly modal: Locator;
  readonly formsInput: Locator;
  readonly statusLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator("div.PopupBody__popup__body___1J_d3");
    this.formsInput = this.modal.getByTestId("forms-searchInput");
    this.statusLocator = page.locator(
      '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
    );
  }

  async login(authPath: string) {
    const userField = this.page.locator("#userid");

    if (await userField.isVisible({ timeout: 8000 }).catch(() => false)) {
      await userField.fill(process.env.APP_USERNAME!);
      await this.page.getByRole("button", { name: "Next" }).click();

      await this.page.locator("#password").fill(process.env.APP_PASSWORD!);
      await this.page.getByRole("button", { name: "Sign in" }).click();

      await this.page.waitForURL(/.*apps.intelligize.com/, {
        timeout: 60000,
        waitUntil: "networkidle",
      });
      await this.page.context().storageState({ path: authPath });
    }
  }

  async selectFormType(formType: string) {
    await this.page.locator("text=/SEC Filings/i").first().click();

    const sectionFilterBlock = this.page
      .locator("div.styles__focusContainer___13rFy")
      .filter({ has: this.page.locator("label", { hasText: /^Forms$/ }) });

    const sectionPlusBtn = sectionFilterBlock
      .locator("span._icon_1jkal_249.Add")
      .first();

    while (!(await this.modal.isVisible())) {
      await sectionPlusBtn.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500);
    }

    await this.formsInput.first().fill(formType);
    const targetLabel = this.modal
      .locator("label")
      .filter({ hasText: new RegExp(`^${formType}`, "i") })
      .first();
    await targetLabel.click();
    await this.page.getByRole("button", { name: /^OK$/ }).click();
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
    const dateInput = this.page.locator(
      '//label[text()="Date"]/ancestor::div[5]//input',
    );

    await dateInput.click({ force: true });
    await dateInput.fill("");
    await dateInput.pressSequentially(dateValue, { delay: 100 });

    await this.page.getByRole("button", { name: /^Search$/i }).click();
    await expect(this.statusLocator.first()).toBeVisible({ timeout: 60000 });
  }

  async getAvailableDocCount(
    comboName: string,
    dateValue: string,
  ): Promise<number> {
    const statusText = await this.statusLocator.first().innerText();

    if (statusText.includes("No Results Found")) {
      console.log(
        `[${comboName}] Skipping scrape: No documents found for ${dateValue}`,
      );
      return 0;
    }

    const docCountMatch = statusText.match(/Docs:\s*([\d,]+)/i);
    let totalAvailableDocs = 0;

    if (docCountMatch) {
      const cleanNumberString = docCountMatch[1].replace(/,/g, "");
      totalAvailableDocs = parseInt(cleanNumberString, 10);
    }

    console.log(
      `[${comboName}] Total Documents Found: ${totalAvailableDocs.toLocaleString()}`,
    );
    return totalAvailableDocs;
  }

  async configureDisplayColumns() {
    const filingInfoPopupCheckbox = this.page
      .locator(".styles__popupContainer___36f60")
      .filter({ hasText: "Filing Info" })
      .locator("._checkbox__icon_1xotg_257");

    await filingInfoPopupCheckbox.click();
    await this.page.waitForTimeout(500);

    const filingInfoCheckbox = this.page
      .locator(".PopupBody__popup__body___1J_d3")
      .locator("div")
      .filter({ hasText: /^Filing Info$/ })
      .locator("._checkbox__icon_1xotg_257");

    await filingInfoCheckbox.click();
    await this.page.waitForTimeout(500);
    await filingInfoCheckbox.click();
    await this.page.waitForTimeout(500);

    const accessionCheckbox = this.page
      .locator(".PopupBody__popup__body___1J_d3")
      .locator("div")
      .filter({ hasText: /^Accession #$/ })
      .locator("._checkbox__icon_1xotg_257");

    await accessionCheckbox.click();
    await this.page.waitForTimeout(500);
    await this.page.getByRole("button", { name: "Apply" }).click();

    const companyInfoPopupCheckbox = this.page
      .locator(".styles__popupContainer___36f60")
      .filter({ hasText: "Company Info" })
      .locator("._checkbox__icon_1xotg_257");

    await companyInfoPopupCheckbox.click();

    const companyInfoCheckbox = this.page
      .locator(".PopupBody__popup__body___1J_d3")
      .locator("div")
      .filter({ hasText: /^Company Info$/ })
      .locator("._checkbox__icon_1xotg_257");

    await this.page.waitForTimeout(500);
    await companyInfoCheckbox.click();
    await this.page.waitForTimeout(500);
    await companyInfoCheckbox.click();

    await this.page.getByRole("button", { name: "Apply" }).click();
  }

  async scrapeResults(targetCount: number, formType: string) {
    let resultsFound = 0;
    let isTestCaseFailed = false;
    let failurelogs: string[] = [];

    while (resultsFound < targetCount) {
      const currentRow = this.page.locator(
        `div[data-test="resultRow"][id="${resultsFound}"]`,
      );

      if ((await currentRow.count()) === 0) {
        await currentRow.last().scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(1000);
        continue;
      }

      try {
        // 1. Locate the Form Type cell (e.g., "6-K (Content)")
        const formTypeCell = currentRow
          .locator("span")
          .filter({ hasText: new RegExp(`^${formType}`, "i") })
          .last();
        await formTypeCell.waitFor({ state: "attached", timeout: 3000 });
        const rowText = await formTypeCell.innerText();

        // 2. Locate the Accession # cell (usually a specific column class)
        // Adjust the selector if your grid uses a different class for the accession number

        const texts = await currentRow.locator("span").allInnerTexts();
        const cleanContent = texts
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        //  console.log(`Row ${rowId}:`, cleanContent.join(' | '));
        //  console.log('```````````````````````````````````````');
        // console.log('```````````````````````````````````````');
        console.log("```````````````````````````````````````");
        const accessionNo =
          cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
          "N/A";
        const accessionCell = currentRow
          .locator('div[data-test="resultCell"]')
          .filter({ hasText: /^\d{10}-\d{2}-\d{6}$/ })
          .first();
        const accessionNumber =
          (await accessionCell.count()) > 0
            ? await accessionCell.innerText()
            : `Unknown_Row_${resultsFound}`;

        // 3. Validation Logic: Extract content inside parentheses
        // This regex checks for "Form (Anything)" and ensures "Anything" isn't just whitespace
        const parenRegex = /\(([^)]+)\)/;
        const match = rowText.match(parenRegex);

        if (!match || match[1].trim().length === 0) {
          console.log(
            `❌ Validation Failed for Row ${resultsFound}: Empty parentheses or no description.`,
          );
          isTestCaseFailed = true;
          failurelogs.push(accessionNo.trim());
        } else {
          console.log(`   Accession #: ${accessionNo.trim()}`);
          console.log(`✅ Row ${resultsFound} Passed: ${rowText}`);
          console.log(`----------------------------`);
        }
      } catch (e: any) {
        console.log(
          `Note: Row ${resultsFound} could not be fully validated. ${e.message}`,
        );
      }

      resultsFound++;
      await currentRow.last().scrollIntoViewIfNeeded();
    }

    const resultSummary = [
      `Status: ${!isTestCaseFailed ? "Passed ✅" : "Failed ❌"}`,
      ``,
      `Filters Used:`,
      `Form Type: ${formType}`,
      `Search For: Filings`,
      ``,
      `Failure Accession IDs:`,
      `${!isTestCaseFailed ? "None" : failurelogs.join("\n")}`,
    ].join("\n");

    await updateGoogleSheet(resultSummary, "sf_6k_subformType", failurelogs);
  }
}
