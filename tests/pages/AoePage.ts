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

  /**
   * AOE's Date box is a testid input rather than the label-anchored one
   * BasePage uses.
   */
  get dateInput(): Locator {
    return this.page.getByTestId("date-input");
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

  // ---------------------------------------------------------------
  // Document viewer
  // ---------------------------------------------------------------

  /**
   * AOE's Info panel is anchored on "Filing Info" rather than the "Filed"
   * label the other apps use.
   *
   * This used to be a full override of openDocIntelligizeId that duplicated
   * all 13 lines of the base version just to change this one string.
   */
  protected get infoPanelAnchorText(): string {
    return "Filing Info";
  }

}
