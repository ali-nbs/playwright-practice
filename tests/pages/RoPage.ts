import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * RoPage - Registered Offerings.
 */
export class RoPage extends BasePage {
  async goto() {
    await this.openApp("Registered Offerings");
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
