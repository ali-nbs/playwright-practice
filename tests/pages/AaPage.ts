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
    await this.openApp("Accounting Analytics");
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

  // ---------------------------------------------------------------------
  // Result-grid row lookup that is safe when "Exhibits to Filings" is ON.
  // ---------------------------------------------------------------------
  //
  // LIVE-CONFIRMED (2026-08-06, via playwright-cli headed session against
  // Accounting Analytics with Exhibits to Filings checked): the app renders
  // each filing followed by its own exhibit sub-rows (EX-31.1, EX-31.2,
  // EX-32.1, EX-101, ...) as SEPARATE `div[data-test="resultRow"]` elements
  // interleaved in the same virtualized grid. Exhibit sub-rows reuse the
  // SAME small `id` sequence (0, 1, 2, 3...) independently per filing --
  // they are not globally unique -- so selecting a row by
  // `[data-test="resultRow"][id="N"]` can match an exhibit sub-row instead
  // of the Nth real filing. Exhibit sub-rows have no "View" button, so the
  // resulting failure is a generic, unhelpful `expect(locator).toBeVisible()`
  // timeout on the View button with no indication that the wrong row was
  // ever selected. This was the actual root cause behind AA row-verification
  // scripts reporting "Row 2/Row 3 failed" while Row 1 always passed --
  // Row 1 legitimately is the first `resultRow`, but Row 2/3 by `id` landed
  // on that same filing's own exhibit rows.
  //
  // Fix: identify real filing rows by the presence of a "View" button
  // (`getByRole("button", { name: /View/i })`), not by raw `id`. This is
  // correct whether or not "Exhibits to Filings" is checked, so callers no
  // longer need to remember to uncheck that filter as a workaround.
  //
  // Lives on AaPage rather than BasePage because it scopes to the
  // `:visible` grid, which is AA-specific (see the class comment above).
  async findResultRowByIndex(
    targetIndex: number, // 1-based: 1 = first real filing row, 2 = second, ...
    logToFile: Function = () => {},
  ): Promise<Locator | null> {
    const scroller = this.visibleScroller;
    const MAX_STAGNANT_SCROLLS = 12;
    let stagnantScrolls = 0;
    let lastSeenRowCount = -1;

    const isFilingRow = async (row: Locator): Promise<boolean> =>
      (await row.getByRole("button", { name: /View/i }).count()) > 0;

    while (stagnantScrolls <= MAX_STAGNANT_SCROLLS) {
      const rows = scroller.locator('div[data-test="resultRow"]');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        let filingRowsSeen = 0;
        for (let i = 0; i < rowCount; i++) {
          const row = rows.nth(i);
          if (!(await isFilingRow(row))) continue; // skip exhibit sub-rows
          filingRowsSeen++;
          if (filingRowsSeen === targetIndex) {
            return row;
          }
        }
      }

      stagnantScrolls = rowCount === lastSeenRowCount ? stagnantScrolls + 1 : 0;
      lastSeenRowCount = rowCount;

      if (rowCount === 0) {
        await this.page.waitForTimeout(600);
        continue;
      }

      await rows.last().evaluate((el) => el.scrollIntoView({ block: "end" }));
      await this.page.waitForTimeout(600);
    }

    logToFile(
      `⚠️ Could not find filing row #${targetIndex} (by View button, exhibit-safe) ` +
        `after ${MAX_STAGNANT_SCROLLS} stagnant scroll attempts.`,
    );
    return null;
  }

  // ---------------------------------------------------------------
  // Document viewer - ACCT panel
  // ---------------------------------------------------------------

  get resultsTab(): Locator {
    return this.page.locator("#results").first();
  }
}
