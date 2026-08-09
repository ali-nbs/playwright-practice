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

  /** The virtualized grid's scroll container. */
  get scroller(): Locator {
    return this.page.locator(".ReactVirtualized__Grid").last();
  }

  /** The rowgroup wrapper some flows scope their row lookups through. */
  get resultsContainer(): Locator {
    return this.scroller.locator('> div[role="rowgroup"]');
  }

  /**
   * One row by its `id` attribute, scoped through the rowgroup.
   *
   * Several flows walk rows by index (`id="0"`, `id="1"`, ...) rather than
   * iterating whatever happens to be rendered, so this is the direct-lookup
   * counterpart to `rows`.
   */
  rowById(id: number | string): Locator {
    return this.resultsContainer
      .locator(`> div > div[data-test="resultRow"][id="${id}"]`)
      .first();
  }

  /**
   * Measures a rendered row's height, falling back to 115 when the grid has
   * not drawn a row yet. Used by flows that scroll by `index * rowHeight`.
   */
  async rowHeight(): Promise<number> {
    return this.scroller.evaluate((el) => {
      const sampleRow = el.querySelector('[data-test="resultRow"]');
      return sampleRow ? sampleRow.getBoundingClientRect().height : 115;
    });
  }

  /** Scrolls the grid so that row `index` is at the top. */
  async scrollToRowIndex(index: number, height: number) {
    await this.scroller.evaluate(
      (el, { i, h }) => {
        el.scrollTop = i * h;
      },
      { i: index, h: height },
    );
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

  /**
   * Reads a labelled value out of a row, e.g. labelledValue(row, "File #").
   * Returns null when the row doesn't have that label.
   */
  async labelledValue(row: Locator, label: string): Promise<string | null> {
    const value = row
      .locator("div")
      .filter({ hasText: label })
      .locator("span")
      .last();

    if (await value.count()) {
      return value.innerText();
    }
    return null;
  }

  /**
   * Walks the result grid and runs `handleRow` for each row, scrolling to
   * load more rows until `targetCount` rows have been processed.
   *
   * This loop (virtualized grid + processedIds + scroll to load more) was
   * copy-pasted in every scraping test. Now it lives here once and each test
   * only writes the part that is actually different: what to do with a row.
   *
   * Rows that throw are logged and skipped, exactly as before.
   *
   * `scrollStyle` covers the two ways the existing flows advance the grid.
   * They are NOT interchangeable, so each caller keeps the one it used:
   *   "intoViewStart"    -> rows.last().evaluate(el => el.scrollIntoView(...))
   *   "intoViewIfNeeded" -> rows.last().scrollIntoViewIfNeeded()
   */
  async forEachResultRow(
    targetCount: number,
    handleRow: (row: Locator, rowId: string) => Promise<void>,
    options: {
      scrollStyle?: "intoViewStart" | "intoViewIfNeeded";
      logRowId?: boolean;
    } = {},
  ) {
    const { scrollStyle = "intoViewStart", logRowId = true } = options;

    let resultsFound = 0;
    const processedIds = new Set<string>();

    while (resultsFound < targetCount) {
      const rows = this.rows;
      const visibleRowCount = await rows.count();

      if (visibleRowCount === 0) {
        await this.page.waitForTimeout(500);
        continue;
      }

      for (let i = 0; i < visibleRowCount; i++) {
        const row = rows.nth(i);
        const rowId = await row.getAttribute("id");
        if (logRowId) console.log("row id ", rowId);

        if (rowId && !processedIds.has(rowId)) {
          try {
            await handleRow(row, rowId);
            processedIds.add(rowId);
            await this.page.waitForTimeout(500);
            resultsFound++;
          } catch (e) {
            console.log("err :", e);
            continue;
          }
        }
        if (resultsFound >= targetCount) break;
      }

      if (resultsFound < targetCount) {
        if (scrollStyle === "intoViewIfNeeded") {
          await rows.last().scrollIntoViewIfNeeded();
        } else {
          await rows
            .last()
            .evaluate((el) => el.scrollIntoView({ block: "start" }));
        }
        await this.page.waitForTimeout(500);
      }
    }
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
   * Clicks a row's "View" button and waits for that document to load.
   *
   * Handles the count-before / click / wait-after sequence so tests don't
   * repeat it. Throws if the document doesn't load, so the caller can record
   * a failure for that row.
   */
  async openDocument(row: Locator, timeout = 30000) {
    const viewBtn = this.viewButton(row);
    await expect(viewBtn).toBeVisible({ timeout: 5000 });

    // Count open docs BEFORE clicking, so waitForDocLoaded knows which
    // viewer is the new one.
    const docsBefore = await this.openDocCount();
    await viewBtn.click();
    await this.waitForDocLoaded(docsBefore, timeout);
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
