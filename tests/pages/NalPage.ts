import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * NalPage - No-Action Letters.
 */
export class NalPage extends BasePage {
  async goto() {
    await this.openApp("No-Action Letters");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  get dateInput(): Locator {
    return this.page.locator('//label[text()="Date"]/ancestor::div[5]//input');
  }

  get keywordsInput(): Locator {
    return this.page.locator(
      '//label[text()="Keywords"]/following::textarea[1]',
    );
  }
}
