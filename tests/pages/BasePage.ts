import { Page, Locator, expect } from "@playwright/test";

export type ConfigureOptions = {
  enableSnippets?: boolean;
  enableCrossReferenceLinks?: boolean;
  enableRedlinePastVersion?: boolean;
};

/**
 * getTabText throws a plain Error tagged with `.kind` when the result grid
 * shows an error state instead of a count, or when the app's crash screen
 * ("Oops! Something went wrong.") appears instead of the app entirely.
 * Callers check `error.kind` ("error" | "crash") to decide whether to skip
 * to the next scenario or recover + abort.
 */
const throwGridStateError = (kind: "error" | "crash", message: string) => {
  const err: any = new Error(message);
  err.kind = kind;
  throw err;
};

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
  // Typing into filters
  // ---------------------------------------------------------------

  /**
   * Focuses a filter and types into it via the keyboard.
   *
   * Moved verbatim from helpers.typeValue, including the commented-out
   * fill("")/pressSequentially lines that were tried and rejected.
   */
  async typeValue(locator: Locator, value: string, delay: number = 0) {
    await locator.focus();
    // await locator.fill("");
    //await locator.pressSequentially(value, { delay });
    await this.page.keyboard.type(value, { delay });
  }

  /** Types into a filter and presses Enter. Moved from helpers.fillAndEnter. */
  async fillAndEnter(locator: Locator, value: string, delay: number = 0) {
    await this.typeValue(locator, value, delay);
    await this.page.keyboard.press("Enter");
  }

  /**
   * Clears a filter by clicking it, emptying it, then typing character by
   * character. This is NOT the same as fillAndEnter: it uses fill("") plus
   * pressSequentially and does not press Enter, which is what the 6-K flow
   * needs to make the date picker commit.
   */
  async clearAndType(locator: Locator, value: string, delay: number = 100) {
    await locator.click({ force: true });
    await locator.fill("");
    await locator.pressSequentially(value, { delay });
  }

  // ---------------------------------------------------------------
  // Result tabs / counts
  // ---------------------------------------------------------------

  /**
   * The results-tab label locator. Matches "Docs: N", "Results: N",
   * "Offerings: N", "No Results Found", or an error state in any casing.
   */
  get tabLabels(): Locator {
    return this.page.locator(
      '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "Offerings:") or contains(text(), "No Results Found") or contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "error")]',
    );
  }

  /** The narrower "Docs:" / "No Results Found" status tab. */
  get statusTabLabels(): Locator {
    return this.page.locator(
      '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
    );
  }

  /** The "Docs:"-only tab label. */
  get docsTabLabels(): Locator {
    return this.page.locator('//span[contains(text(), "Docs:")]');
  }

  /**
   * Clicks the results tab if it is visible, to switch back to the grid.
   * Several flows do exactly this after opening a document.
   */
  async clickResultsTabIfVisible(tab: Locator) {
    if (await tab.isVisible()) {
      await tab.click();
    }
  }

  /** The "+" icon inside an already-located filter block. */
  addIconIn(block: Locator): Locator {
    return block.locator("span._icon_1jkal_249.Add").first();
  }

  /** A <span> matching an exact label, for use in `filter({ has: ... })`. */
  spanWithText(text: RegExp): Locator {
    return this.page.locator("span", { hasText: text });
  }

  /** A <label> matching text, e.g. the "Only" toggle. */
  labelWithText(text: RegExp): Locator {
    return this.page.locator("label").filter({ hasText: text });
  }

  /** The app's React crash boundary ("Oops! Something went wrong"). */
  get crashScreen(): Locator {
    return this.page.getByText("Oops!", { exact: false }).first();
  }

  /** The "Load more results" link shown on a "Docs: 2,000+" tab. */
  get loadMoreResultsLink(): Locator {
    return this.page.locator('a:has-text("Load more results")');
  }

  /**
   * Reads the text of the results tab at `expectedIndex`.
   *
   * Moved verbatim from helpers.getTabText, including the crash-screen race
   * and the `.kind`-tagged errors that callers switch on.
   */
  async getTabText(
    expectedIndex: number,
    logToFile: Function,
    isNeedLoadMoreResults: boolean = false,
  ) {
    console.log("expected index ", expectedIndex);
    const target = this.tabLabels.nth(expectedIndex);
    const crashLocator = this.crashScreen;

    // Race the normal tab text against the crash screen so a crash is caught
    // within seconds instead of burning the full 240s timeout.
    await Promise.race([
      expect(target).toBeVisible({ timeout: 240000 }).catch(() => {}),
      expect(crashLocator).toBeVisible({ timeout: 240000 }).catch(() => {}),
    ]);

    if (await crashLocator.isVisible().catch(() => false)) {
      throwGridStateError(
        "crash",
        `App crash screen ("Oops! Something went wrong") appeared instead of the results tab (index ${expectedIndex}).`,
      );
    }

    if (!(await target.isVisible().catch(() => false))) {
      throwGridStateError(
        "error",
        `Timed out waiting for results tab (index ${expectedIndex}): neither a results count nor a crash screen appeared within 240s.`,
      );
    }

    let text = await target.innerText();

    if (/error/i.test(text)) {
      throwGridStateError(
        "error",
        `Result grid returned an error state instead of a count: "${text}"`,
      );
    }

    if (text.includes("Docs: 2,000+") && isNeedLoadMoreResults) {
      await this.loadMoreResultsLink.last().click({ force: true });
      text = await this.tabLabels.nth(expectedIndex).innerText();
    }

    return text;
  }

  /** Waits for the results status tab to appear after a search. */
  async waitForResults(timeout = 60000) {
    await expect(this.statusTabLabels.first()).toBeVisible({ timeout });
  }

  // ---------------------------------------------------------------
  // Tab management
  // ---------------------------------------------------------------

  /**
   * Closes every open result tab via the right-click context menu.
   * Moved verbatim from helpers.closeAllOpenTabs.
   */
  async closeAllOpenTabs() {
    const activeTab = this.page.locator(
      '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "No Results Found")]',
    );
    if ((await activeTab.count()) > 0) {
      try {
        await activeTab.first().click({
          button: "right",
          timeout: 10000,
          noWaitAfter: true,
        });
        const closeAllBtn = this.page
          .locator(".react-contextmenu--visible")
          .getByRole("menuitem", { name: /Close all tabs/i });
        if (!expect(closeAllBtn.isVisible({ timeout: 10000 }))) {
          console.log("close all tabs option not available or see");
        }
        await closeAllBtn.click({ noWaitAfter: true, timeout: 10000 });
        await expect(activeTab).toHaveCount(0, { timeout: 15000 });
      } catch (cleanupError) {
        console.error("Error during cleanup (closing tabs):", cleanupError);
        await this.page.reload();
      }
    }
  }

  /**
   * Closes result tabs to the right of the first one.
   * Moved verbatim from helpers.closeTabsToTheRight. NOTE: this uses a
   * NARROWER tab locator than closeAllOpenTabs (no "Results:"), and a 5s
   * right-click timeout rather than 10s. Both differences are preserved.
   */
  async closeTabsToTheRight() {
    const activeTab = this.page.locator(
      '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
    );
    if ((await activeTab.count()) > 0) {
      try {
        await activeTab.first().click({ button: "right", timeout: 5000 });
        const closeTabsToTheRightBtn = this.page
          .locator(".react-contextmenu--visible")
          .getByRole("menuitem", { name: /Close tabs to the right/i });
        await this.page.waitForTimeout(1000);
        await closeTabsToTheRightBtn.click();
        await this.page.waitForTimeout(1000);
        await expect(activeTab).toHaveCount(1, { timeout: 15000 });
      } catch (cleanupError) {
        console.error("Error during cleanup (closing tabs):", cleanupError);
        await this.page.reload();
      }
    }
  }

  // ---------------------------------------------------------------
  // Display columns
  // ---------------------------------------------------------------
  /**
   * Configures the display-columns popup.
   * Moved verbatim from helpers.configureDisplayColumns.
   */
  async configureDisplayColumns(
    selections: Record<string, string[]>,
    options: ConfigureOptions = {},
  ) {
    const page = this.page;

    for (const [category, items] of Object.entries(selections)) {
      console.log(`Configuring category: ${category}`);

      const categoryTrigger = page
        .locator(".styles__popupContainer___36f60")
        .filter({ hasText: category })
        .locator("._checkbox__icon_1xotg_257");

      await categoryTrigger.click();

      const popupBody = page.locator(".PopupBody__popup__body___1J_d3");
      await popupBody.waitFor({ state: "visible" });

      const selectAllCheckbox = popupBody
        .locator("div")
        .filter({ hasText: new RegExp(`^${category}$`) })
        .locator("._checkbox__icon_1xotg_257");

      const isMasterChecked = await selectAllCheckbox.evaluate((el) => {
        const nativeInput = el.querySelector(
          'input[type="checkbox"]',
        ) as HTMLInputElement;
        return nativeInput ? nativeInput.checked : false;
      });

      if (isMasterChecked) {
        await selectAllCheckbox.click();
      } else {
        await selectAllCheckbox.click();
        await page.waitForTimeout(300);
        await selectAllCheckbox.click();
      }
      await page.waitForTimeout(300);

      for (const item of items) {
        console.log(`Selecting item: ${item}`);
        const itemCheckbox = popupBody
          .locator("div")
          .filter({ hasText: new RegExp(`^${item}$`) })
          .locator("._checkbox__icon_1xotg_257")
          .last();

        await itemCheckbox.scrollIntoViewIfNeeded();
        await itemCheckbox.click();
        await page.waitForTimeout(200);
      }
      await this.applyBtn.click();
      await page.waitForTimeout(500);
    }

    const {
      enableSnippets = false,
      enableCrossReferenceLinks = false,
      enableRedlinePastVersion = false,
    } = options;

    if (enableSnippets) {
      const snippetsToggle = page
        .locator("._checkbox_1xotg_249")
        .filter({ hasText: "Snippets" })
        .locator("label")
        .first();
      await snippetsToggle.click();
    }
    if (enableCrossReferenceLinks) {
      const crossReferenceLinksToggle = page
        .locator("._checkbox_1xotg_249")
        .filter({ hasText: "Cross-Reference" })
        .locator("label")
        .first();
      await crossReferenceLinksToggle.click();
      await page
        .locator('a[href*="/SecuritiesRegulationAndCompliance?"]')
        .waitFor({ timeout: 15000 })
        .catch(() =>
          console.log("Toggle clicked but links didn't appear in results yet."),
        );
    }
    if (enableRedlinePastVersion) {
      const redlinePastVersionToggle = page
        .locator("._checkbox_1xotg_249")
        .filter({ hasText: "Redline Past Version" })
        .locator("label")
        .first();
      await redlinePastVersionToggle.click();
    }
  }

  // ---------------------------------------------------------------
  // Filter popups (shared: the same popup chrome is used by AOE, DBM,
  // SF, SRC and BPC, even though each app's filters differ)
  // ---------------------------------------------------------------

  /** The filter popup body. */
  get popupBody(): Locator {
    return this.page.locator("div.PopupBody__popup__body___1J_d3");
  }

  /** The other popup wrapper, used by the keyword popups. */
  get popupContainer(): Locator {
    return this.page.locator("div.PopupContainer__container___1-tgp").first();
  }

  /** Popup confirm button. */
  get okBtn(): Locator {
    return this.page.getByRole("button", { name: /^OK$/ });
  }

  /** Display-columns popup apply button. */
  get applyBtn(): Locator {
    return this.page.getByRole("button", { name: "Apply" });
  }

  /**
   * A filter block in the filter bar, found by its label text.
   *
   * e.g. filterBlock(/^Forms$/), filterBlock(/^Company Type\/Status$/)
   */
  filterBlock(labelText: RegExp): Locator {
    return this.page
      .locator("div.styles__focusContainer___13rFy")
      .filter({ has: this.page.locator("label", { hasText: labelText }) });
  }

  /** The "+" icon that opens a filter block's picker. */
  filterAddIcon(labelText: RegExp): Locator {
    return this.filterBlock(labelText).locator("span._icon_1jkal_249.Add").first();
  }

  // ---------------------------------------------------------------
  // Document iframe
  // ---------------------------------------------------------------

  /** The document iframe (AA, AOE and SF all read the doc body this way). */
  get documentFrame() {
    return this.page.frameLocator("iframe").first();
  }

  // ---------------------------------------------------------------
  // Toolbar
  // ---------------------------------------------------------------

  /** Download button in the results toolbar. Used by DBM, RO, SE and SF. */
  get downloadBtn(): Locator {
    return this.page.locator('button[title*="Download"]');
  }

  // ---------------------------------------------------------------
  // Left-nav
  // ---------------------------------------------------------------

  /**
   * Opens an app from the left navigation by its link text.
   *
   * Each app page class has its own `goto()` that calls this, so flows should
   * prefer `new SfPage(page).goto()` over calling this directly.
   */
  async openApp(linkText: string) {
    await this.page.locator(`text=/${linkText}/i`).first().click();
  }

  /**
   * Hops from one app to another via the left-nav, making sure the result
   * opens in the SAME window rather than a new browser tab.
   *
   * Moved verbatim from helpers.navigateToSourceToTargetApp, including the
   * force:true clicks and the 200ms settle wait.
   */
  async navigateFromTo(sourcePage: String, targetPage: String) {
    await this.page
      .locator(`text=/${sourcePage}/i`)
      .first()
      .click({ force: true });
    const isChecked = await this.page.locator("input#sameWindow").isChecked();

    // 2. If it is checked, click the visible text label to cleanly turn it off
    if (isChecked) {
      await this.page.getByText("Open in a New Browser Tab").click();
      await this.page.waitForTimeout(200); // Small buffer for framework state to complete
    }
    await this.page
      .locator(`text=/${targetPage}/i`)
      .first()
      .click({ force: true });
  }

  /** Excel List export button. */
  get excelListBtn(): Locator {
    return this.page.locator('button:has-text("Excel List")');
  }

  /** Email export button. */
  get emailBtn(): Locator {
    return this.page.locator(
      'span[title="Email the selected items from the list below"]',
    );
  }

  /** The lowercase "ok" confirm button used by the export dialogs. */
  get okBtnLoose(): Locator {
    return this.page.getByRole("button", { name: /ok/i });
  }

  /** A checkbox label in an export dialog, e.g. "coverPage". */
  dialogCheckboxLabel(forAttr: string): Locator {
    return this.page.locator(`label[for="${forAttr}"]`);
  }

  /** A download-format option in the export dialog. */
  get downloadFormatOptions(): Locator {
    return this.page.locator('div[name="formats"]');
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

  /** Raw (untrimmed) span texts of a row. */
  async rowSpanTexts(row: Locator): Promise<string[]> {
    return row.locator("span").allInnerTexts();
  }

  /** A row's <p> texts. */
  async rowParagraphTexts(row: Locator): Promise<string[]> {
    return row.locator("p").allInnerTexts();
  }

  /** A row's keyword-highlight texts (<em> inside <p>). */
  async rowHighlightTexts(row: Locator): Promise<string[]> {
    return row.locator("p em").allInnerTexts();
  }

  /** A row's link texts. */
  async rowLinkTexts(row: Locator): Promise<string[]> {
    return row.locator("a").allInnerTexts();
  }

  /** A row's first link. */
  rowFirstLink(row: Locator): Locator {
    return row.locator("a").first();
  }

  /** A row's anchors and paragraphs, in document order. */
  rowLinksAndParagraphs(row: Locator): Locator {
    return row.locator("a, p");
  }

  /** A row's paragraphs as a locator (not their text). */
  rowParagraphs(row: Locator): Locator {
    return row.locator("p");
  }

  /** A row's select checkbox label. */
  rowCheckboxLabel(row: Locator): Locator {
    return row.locator("label").first();
  }

  /** The "View All Hits" / "View More" affordance inside a row. */
  rowViewAllHits(row: Locator): Locator {
    return row.getByText(/View All Hits|View More/i);
  }

  /**
   * A labelled cell inside a row, e.g. rowLabelledSpan(row, "Accession #").
   * Returns the <span> carrying the label itself.
   */
  rowLabelledSpan(row: Locator, label: string): Locator {
    return row.locator("span", { hasText: label });
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
