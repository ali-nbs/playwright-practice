import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * SePage - SEC Enforcement.
 *
 * Date and Keywords both come from BasePage - SE's copies were identical to
 * the shared ones (its Keywords box was the same testid query written as a
 * raw attribute selector). Only the results table below is SE's own.
 */
export class SePage extends BasePage {
  async goto() {
    await this.openApp("SEC Enforcement");
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
