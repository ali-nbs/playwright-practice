import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * AoePage - Agreements & Other Exhibits.
 */
export class AoePage extends BasePage {
  async goto() {
    await this.openApp("Agreements & Other Exhibits");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  get lawFirmInput(): Locator {
    return this.page.getByTestId("lawFirm-input");
  }

  get docTypeInput(): Locator {
    return this.page.getByTestId("documentType-input");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  get dateInput(): Locator {
    return this.page.getByTestId("date-input");
  }

  get keywordsInput(): Locator {
    return this.page.getByTestId("keywords-input");
  }

  /** Section Type filter, e.g. "Preamble". Referred to as the clause. */
  get sectionTypeInput(): Locator {
    return this.page.getByTestId("sectionType-input");
  }

  // ---------------------------------------------------------------
  // Result rows
  // ---------------------------------------------------------------

  /**
   * A row's snippet block.
   *
   * AOE renders snippets as a SIBLING of the result row rather than inside
   * it, so this walks across with xpath instead of scoping under the row.
   * The other apps' row-scoped snippet locators find nothing here.
   */
  rowSnippetContainer(row: Locator): Locator {
    return row.locator(
      'xpath=following-sibling::div[contains(@class,"snippets-container")]',
    );
  }

  /** A row's date cell. */
  async rowDate(row: Locator): Promise<string> {
    const date = await row
      .locator(".styles__filing-date-value-column___2pu1v")
      .textContent();

    return date?.trim() ?? "";
  }

  // ---------------------------------------------------------------
  // Document viewer
  // ---------------------------------------------------------------

  /**
   * Reads the Intelligize ID from the open document's Info panel.
   *
   * Overridden because AOE's panel is anchored on "Filing Info" rather than
   * the "Filed" label BasePage keys off.
   */
  async openDocIntelligizeId(): Promise<string> {
    const panel = this.page
      .locator('div:has-text("Filing Info")')
      .locator('xpath=ancestor::div[contains(@class,"info-panel")]');

    const row = panel
      .locator("div")
      .filter({ has: this.page.getByText("Intelligize ID", { exact: true }) })
      .first();

    await row.scrollIntoViewIfNeeded();

    const value = await row.locator("li span").first().innerText();

    return value.trim();
  }

}
