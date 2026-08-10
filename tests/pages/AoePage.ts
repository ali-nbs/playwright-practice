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
}
