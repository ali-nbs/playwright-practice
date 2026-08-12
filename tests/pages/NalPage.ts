import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * NalPage - No-Action Letters.
 *
 * Date comes from BasePage. Only the Keywords box differs.
 */
export class NalPage extends BasePage {
  async goto() {
    await this.openApp("No-Action Letters");
  }

  /** NAL's Keywords box is a <textarea> next to the label, not a testid input. */
  get keywordsInput(): Locator {
    return this.page.locator(
      '//label[text()="Keywords"]/following::textarea[1]',
    );
  }
}
