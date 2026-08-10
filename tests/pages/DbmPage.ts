import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * DbmPage - Disclosure Benchmarking.
 */
export class DbmPage extends BasePage {
  async goto() {
    await this.openApp("Disclosure Benchmarking");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  get dateInput(): Locator {
    return this.page.getByTestId("date-input");
  }

  get sectionTypeInput(): Locator {
    return this.page.getByTestId("sectionType-input");
  }
}
