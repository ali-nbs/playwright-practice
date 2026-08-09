import { Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * AaPage - Accounting Analytics.
 *
 * NOTE ON THE GRID: the AA flows scope the grid with
 * `.ReactVirtualized__Grid:visible`, NOT the plain `.ReactVirtualized__Grid`
 * that BasePage uses. That `:visible` filter was added deliberately (AA keeps
 * previously-opened documents mounted, so an offscreen stale grid can match
 * first), so AA keeps its own `visibleRows` rather than reusing BasePage.rows.
 */
export class AaPage extends BasePage {
  async goto() {
    await this.page.locator("text=/Accounting Analytics/i").first().click();
  }

  // ---------------------------------------------------------------
  // Result grid (AA-specific: :visible matters, see class comment)
  // ---------------------------------------------------------------

  get visibleScroller(): Locator {
    return this.page.locator(".ReactVirtualized__Grid:visible").last();
  }

  get visibleRows(): Locator {
    return this.visibleScroller.locator('div[data-test="resultRow"]');
  }

  // ---------------------------------------------------------------
  // Document viewer - ACCT panel
  // ---------------------------------------------------------------

  get resultsTab(): Locator {
    return this.page.locator("#results").first();
  }
}
