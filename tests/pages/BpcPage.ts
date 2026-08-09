import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * BpcPage - Board Profiles & Compensation.
 *
 * BPC's result rows are NOT inside the standard `.ReactVirtualized__Grid`
 * wrapper that other apps use, and its row lookups accept either
 * `[data-test="resultRow"][id="N"]` or a bare `[id="N"]`. Those selectors are
 * kept here as-is rather than reusing BasePage's `rows`, because they are not
 * the same query.
 */
export class BpcPage extends BasePage {
  async goto() {
    await this.page
      .locator("text=/Board Profiles & Compensation/i")
      .first()
      .click();
  }

  // ---------------------------------------------------------------
  // Company picker
  // ---------------------------------------------------------------

  get companyBatchAddTextarea(): Locator {
    return this.page.getByTestId("company-popup-batch-add-textarea");
  }

  get companyPopupOkBtn(): Locator {
    return this.page.getByTestId("company-popup-footer-ok");
  }
}
