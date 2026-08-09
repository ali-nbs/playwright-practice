import { Page, Locator, expect } from "@playwright/test";

/**
 * BasePage - the parts of the UI that every app shares.
 *
 * Every app (SF, SE, BPC, AA, SRC, ...) has the same shell: a Search button,
 * a Clear Filters button, result tabs, and a document viewer. Those live here
 * so they are written once.
 *
 * Anything specific to ONE app (SRC's Laws & Regs filter, SF's Forms filter)
 * does NOT belong here - it goes in that app's own page file, e.g. SrcPage.ts.
 *
 * Note: selectors are written inline, exactly as they appear in the tests, so
 * you can see what they match without opening another file.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  // ---------------------------------------------------------------
  // Filter bar (shared by ~all apps)
  // ---------------------------------------------------------------

  get searchBtn(): Locator {
    return this.page.getByRole("button", { name: /^Search$/i }).first();
  }

  get clearFiltersBtn(): Locator {
    return this.page.getByRole("button", { name: /^Clear Filters$/i });
  }

  async search() {
    await this.searchBtn.click();
  }

  async clearFilters() {
    await this.clearFiltersBtn.click();
  }

  // ---------------------------------------------------------------
  // Result grid
  // ---------------------------------------------------------------

  /** All result rows currently rendered by the virtualized grid. */
  get rows(): Locator {
    return this.page
      .locator(".ReactVirtualized__Grid")
      .last()
      .locator('div[data-test="resultRow"]');
  }

  /** The "View" button inside a result row. */
  viewButton(row: Locator): Locator {
    return row.getByRole("button", { name: /View/i });
  }

  /** A row's trimmed, non-empty span texts (title, source, category, ...). */
  async rowTexts(row: Locator): Promise<string[]> {
    const texts = await row.locator("span").allInnerTexts();
    return texts.map((t) => t.trim()).filter((t) => t.length > 0);
  }

  // ---------------------------------------------------------------
  // Result tabs
  // ---------------------------------------------------------------

  /** The "Docs: N" tab. */
  get docsTab(): Locator {
    return this.page.locator('span[title^="Docs:"]').first();
  }

  /**
   * Go back to the results grid after opening a document.
   *
   * Uses a raw DOM click on purpose - Playwright's .click() was tried and
   * did not work reliably here. Please don't "simplify" this.
   */
  async backToResults() {
    await this.docsTab.evaluate((el) => (el as HTMLElement).click());
  }

  // ---------------------------------------------------------------
  // Document viewer
  // ---------------------------------------------------------------

  /**
   * How many documents are currently open in the viewer.
   *
   * Call this BEFORE clicking "View", then pass the result to
   * waitForDocLoaded(). See that method for why.
   */
  async openDocCount(): Promise<number> {
    return this.page.locator('div[id="DocViewContainer"]').count();
  }

  /**
   * Wait for the document you just opened to finish loading.
   *
   * Why it works this way (confirmed live on 2026-08-09):
   *
   * The app never closes old documents. Each "View" click adds ANOTHER
   * div#DocViewContainer (yes, duplicate ids) and the old ones stay visible
   * forever. Only the FOCUSED one has tabindex="0", and after you click back
   * to the results tab, none of them do.
   *
   * The old code waited for tabindex="0", i.e. it waited for the document to
   * be focused, not loaded. Row 1 happened to keep focus so it passed in ~6s;
   * later rows lost focus, matched nothing, and timed out after the full 30s
   * even though the document had actually loaded in seconds.
   *
   * So instead we wait for a NEW viewer to appear and for it to have real
   * text in it. Real documents render 150k-1.6M characters.
   */
  async waitForDocLoaded(docCountBeforeClick: number, timeout = 30000) {
    const containers = this.page.locator('div[id="DocViewContainer"]');
    const deadline = Date.now() + timeout;

    // Wait for the new document's viewer to be added.
    while (Date.now() < deadline) {
      if ((await containers.count()) > docCountBeforeClick) break;
      await this.page.waitForTimeout(200);
    }

    // The newest viewer is the one we just opened, since the app appends.
    const newest = containers.last();

    // Give each of the two checks below its own full budget rather than
    // sharing one deadline. Sharing it meant that when the viewer took a
    // while to appear above, the text check could be left with as little as
    // the 1000ms floor and fail with "Timeout 1000ms exceeded" on a document
    // that was loading perfectly normally, just slowly.
    await expect(newest).toBeVisible({ timeout });

    await expect(async () => {
      const textLength = await newest.evaluate(
        (el) => (el.textContent || "").trim().length,
      );
      expect(textLength).toBeGreaterThan(200);
    }).toPass({ timeout });
  }
}
