import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * NalPage - No-Action Letters.
 */
export class NalPage extends BasePage {
  async goto() {
    await this.page.locator("text=/No-Action Letters/i").first().click();
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
