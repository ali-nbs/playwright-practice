import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * RoPage - Registered Offerings.
 *
 * Date comes from BasePage. Only the Keywords box differs.
 */
export class RoPage extends BasePage {
  async goto() {
    await this.openApp("Registered Offerings");
  }

  /** RO's Keywords box is a <textarea> next to the label, not a testid input. */
  get keywordsInput(): Locator {
    return this.page.locator(
      '//label[text()="Keywords"]/following::textarea[1]',
    );
  }
}
