import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * SePage - SEC Enforcement.
 *
 * Only what is specific to SE. Search and Clear Filters come from BasePage.
 */
export class SePage extends BasePage {
  async goto() {
    await this.openApp("SEC Enforcement");
  }

  // ---------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------

  /**
   * SE's Date filter.
   *
   * Note this is a different selector from SRC's Date filter. Each app's
   * filter bar is built differently, so each app keeps its own locator
   * rather than sharing one that only happens to work in some apps.
   */
  get dateInput(): Locator {
    return this.page.locator('//label[text()="Date"]/ancestor::div[5]//input');
  }

  get keywordsInput(): Locator {
    return this.page.locator('[data-testid="keywords-input"]');
  }

  // ---------------------------------------------------------------
  // Result table
  // ---------------------------------------------------------------

  /**
   * Keyword highlights in the results table.
   *
   * SE renders results as a document table and marks highlights with a
   * <customhighlight> tag that is not scoped to an individual row, so this
   * matches across the whole table rather than per row.
   */
  get tableHighlights(): Locator {
    return this.page.locator('[class*="DocumentTable"] customhighlight');
  }

}
