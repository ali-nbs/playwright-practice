import { Page, Locator, expect } from "@playwright/test";

export type ConfigureOptions = {
  enableSnippets?: boolean;
  enableCrossReferenceLinks?: boolean;
  enableRedlinePastVersion?: boolean;
};

/**
 * The background colour the app paints on a keyword highlight.
 *
 * Every app renders the same yellow, so the flows that verify highlighting
 * compare against this one constant instead of repeating the rgb() triple.
 * If a rebuild ever changes the shade, it is edited here once.
 */
export const HIGHLIGHT_BG_COLOR = "rgb(252, 234, 151)";

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

  /**
   * Clears the filter bar, if a Clear Filters button is present.
   *
   * Uses force:true for the same reason sf-fiscalYear, sf-ixbrl, sf-pdee
   * and sf-xbrlParsing already call `clearFiltersBtn.click({ force: true })`
   * directly: the app leaves a hidden options strip
   * (`styles__tabsContainer--hidden___18VdZ`, holding "Share Link") laid
   * over the filter bar, and Playwright's actionability check refuses to
   * click "through" it even though the button is visible, enabled and
   * stable. LIVE-CONFIRMED (2026-08-12, headed run over CDP against SRC):
   * without force this retries for the full 30s and then fails with
   * "<span ...>Share Link</span> ... intercepts pointer events".
   *
   * The one public entry point for this control - no separate locator
   * getter, so there is exactly one way to clear filters. Skips cleanly
   * (rather than throwing) when the button never renders, which is what
   * sf-boilerPlate's old `if (await sf.clearFiltersBtn.isVisible())` guard
   * was for.
   */
  async clearFilters() {
    const btn = this.page.getByRole("button", { name: /^Clear Filters$/i });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
    }
  }

  // ---------------------------------------------------------------
  // Typing into filters
  // ---------------------------------------------------------------

  /**
   * Types into a filter. Presses Enter unless `pressEnter: false`. Clears
   * the field first (click, fill(""), pressSequentially) when `clearFirst`
   * is set - this used to be a second method, `clearAndType`, existing only
   * because the 6-K date picker needs its field emptied before typing and
   * must NOT get an Enter (that closes the picker before it commits). One
   * method, one flag, instead of two near-identical typing methods.
   *
   * `typeValue` used to be a separate method; it had no callers of its own
   * outside this one, so its body is inlined here instead of kept as a
   * second public step.
   */
  async fillAndEnter(
    locator: Locator,
    value: string,
    delay: number = 0,
    options: { pressEnter?: boolean; clearFirst?: boolean } = {},
  ) {
    const { pressEnter = true, clearFirst = false } = options;

    if (clearFirst) {
      await locator.click({ force: true });
      await locator.fill("");
      await locator.pressSequentially(value, { delay });
    } else {
      await locator.focus();
      await this.page.keyboard.type(value, { delay });
    }

    if (pressEnter) {
      await this.page.keyboard.press("Enter");
    }
  }

  // ---------------------------------------------------------------
  // Filters shared by most apps
  // ---------------------------------------------------------------

  /**
   * A filter input found by its label text.
   *
   * NAL, RO, SE and SF all declared this exact XPath separately. It is one
   * getter now, and an app only writes its own when its filter bar really is
   * built differently (SRC's Date, for instance).
   */
  filterInputByLabel(label: string): Locator {
    return this.page.locator(
      `//label[text()="${label}"]/ancestor::div[5]//input`,
    );
  }

  /** The Date filter. Apps whose Date box differs override this. */
  get dateInput(): Locator {
    return this.filterInputByLabel("Date");
  }

  /**
   * The Keywords filter.
   *
   * SF, SE and AOE each declared this separately - SE as a raw
   * `[data-testid="keywords-input"]` string and the others via getByTestId,
   * which are the same query written two ways. NAL, RO and SRC use a
   * genuinely different control and override it.
   */
  get keywordsInput(): Locator {
    return this.page.getByTestId("keywords-input");
  }

  // ---------------------------------------------------------------
  // Result tabs / counts
  // ---------------------------------------------------------------

  /**
   * Builds a results-tab label locator matching any of the given text
   * fragments (e.g. "Docs:", "No Results Found"). The three tab-label
   * getters below used to be three separately hand-written XPaths sharing
   * the same `contains(text(), ...)` shape; now there is exactly one XPath
   * template and they only supply which fragments they care about. Pass
   * `caseInsensitive: true` for the one getter (tabLabels) that also has to
   * match "error" in any casing.
   */
  resultTabsMatching(
    fragments: string[],
    options: { caseInsensitiveFragments?: string[] } = {},
  ): Locator {
    const exact = fragments.map((f) => `contains(text(), "${f}")`);
    const insensitive = (options.caseInsensitiveFragments ?? []).map(
      (f) =>
        `contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${f.toLowerCase()}")`,
    );
    const clauses = [...exact, ...insensitive]
      .join(" or ");
    return this.page.locator(`//span[${clauses}]`);
  }

  /**
   * The results-tab label locator. Matches "Docs: N", "Results: N",
   * "Offerings: N", "No Results Found", or an error state in any casing.
   */
  get tabLabels(): Locator {
    return this.resultTabsMatching(
      ["Docs:", "Results:", "Offerings:", "No Results Found"],
      { caseInsensitiveFragments: ["error"] },
    );
  }

  /** The narrower "Docs:" / "No Results Found" status tab. */
  get statusTabLabels(): Locator {
    return this.resultTabsMatching(["Docs:", "No Results Found"]);
  }

  /** The "Docs:"-only tab label. */
  get docsTabLabels(): Locator {
    return this.resultTabsMatching(["Docs:"]);
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

  /**
   * The "+" icon inside an already-located filter block.
   *
   * Use this when you already hold the block's Locator; use `filterAddIcon`
   * when you only know the block's label. They were separate copies of the
   * same selector until the consolidation - now `filterAddIcon` calls this,
   * so the selector exists once.
   */
  addIconIn(block: Locator): Locator {
    return block.locator("span._icon_1jkal_249.Add").first();
  }

  /**
   * An element matching text, by tag, e.g. elementWithText("span", /^10-K$/)
   * or elementWithText("label", /^Only$/). Replaces what used to be two
   * separate methods (spanWithText, labelWithText) differing only in which
   * tag they searched.
   */
  elementWithText(tag: string, text: RegExp): Locator {
    return this.page.locator(tag, { hasText: text });
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

  /**
   * The confirm button, matched case-insensitively ("OK", "Ok", "ok").
   * One locator for this job - it used to also exist as `okBtnAnyCase`
   * with a stricter, exact-case sibling `okBtn`, but nothing needed the
   * stricter match, so the case-insensitive version is now the only one.
   */
  get okBtn(): Locator {
    return this.page.getByRole("button", { name: /ok/i });
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

  /**
   * The "+" icon that opens a filter block's picker, found by the block's
   * label. The label-free counterpart is `addIconIn`.
   */
  filterAddIcon(labelText: RegExp): Locator {
    return this.addIconIn(this.filterBlock(labelText));
  }

  /**
   * A row in a picker popup's check-list, e.g. the Section picker.
   *
   * Lives here rather than on SfPage: nothing about it is SF-specific, and
   * the popup chrome it targets is the same one every app's filter pickers
   * use. Moved from SfPage.checkListItem.
   */
  pickerListItem(text: RegExp): Locator {
    return this.page
      .locator("li.styles__check-list-item__container___233d9")
      .filter({ hasText: text });
  }

  /**
   * The checkbox icon inside a picker row. Moved from
   * SfPage.pickerRowCheckboxIcon - `_checkbox__icon_1xotg_257` is the same
   * shared class configureDisplayColumns above already uses.
   */
  pickerCheckboxIcon(row: Locator): Locator {
    return row.locator("label._checkbox__icon_1xotg_257");
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

  /**
   * All the text a result row carries, read in one pass.
   *
   * This replaces what used to be six separate methods
   * (rowSpanTextsClean/Raw, rowParagraphTexts, rowHighlightTexts,
   * rowLinkTexts, plus callers hand-rolling the same trim/filter every flow
   * that needed span text already did on its own). One row, one read, every
   * text a flow has ever needed out of it:
   *   spans      - every <span>, trimmed, empties dropped (title, source,
   *                category, accession #, ...)
   *   paragraphs - every <p> (snippet/body text)
   *   highlights - <em> inside a <p> (keyword-highlight matches)
   *   links      - every <a> (anchor text, e.g. boilerplate section links)
   *
   * Locators you need to click/check/count instead of read stay as their
   * own getters below (rowFirstLink, rowCheckboxLabel, rowLabelledSpan,
   * rowViewAllHits) - those are actions, not text, so a batched text read
   * cannot replace them.
   */
  async rowData(row: Locator): Promise<{
    spans: string[];
    paragraphs: string[];
    highlights: string[];
    links: string[];
  }> {
    const [spansRaw, paragraphs, highlights, links] = await Promise.all([
      row.locator("span").allInnerTexts(),
      row.locator("p").allInnerTexts(),
      row.locator("p em").allInnerTexts(),
      row.locator("a").allInnerTexts(),
    ]);

    return {
      spans: spansRaw.map((t) => t.trim()).filter((t) => t.length > 0),
      paragraphs,
      highlights,
      links,
    };
  }

  /** A row's first link. Click target, not text - kept as a locator. */
  rowFirstLink(row: Locator): Locator {
    return row.locator("a").first();
  }

  /**
   * A row's paragraphs as a Locator (not their text - see rowData for
   * that). Kept because sf-crossReferenceLinks chains `.locator(...)` off
   * it to find a link inside a specific paragraph, which a text array
   * cannot express.
   */
  rowParagraphs(row: Locator): Locator {
    return row.locator("p");
  }

  /**
   * A row's anchors and paragraphs, in DOCUMENT ORDER. Kept as a Locator:
   * sf-boilerPlate iterates this element-by-element and checks each one's
   * tag name at runtime, which rowData's separate `links`/`paragraphs`
   * arrays cannot express (they lose the original interleaving).
   */
  rowLinksAndParagraphs(row: Locator): Locator {
    return row.locator("a, p");
  }

  /** A row's select checkbox label. Click target - kept as a locator. */
  rowCheckboxLabel(row: Locator): Locator {
    return row.locator("label").first();
  }

  /** The "View All Hits" / "View More" affordance inside a row. Its .count() is checked, not its text. */
  rowViewAllHits(row: Locator): Locator {
    return row.getByText(/View All Hits|View More/i);
  }

  /**
   * A labelled cell inside a row, e.g. rowLabelledSpan(row, "Accession #").
   * Returns the <span> carrying the label itself - callers walk from it
   * (following-sibling, nested spans) to reach the value, which is why this
   * stays a locator rather than folding into rowData or rowValueByLabel.
   */
  rowLabelledSpan(row: Locator, label: string): Locator {
    return row.locator("span", { hasText: label });
  }

  /**
   * Reads a labelled value out of a row, e.g. labelledValue(row, "File #").
   * Returns null when the row doesn't have that label. Scoped through a
   * `div` wrapper rather than `span` (see rowValueByLabel) - SRC's File #/
   * Release # cells are not built the same way SF's labelled spans are, so
   * this is a genuinely different DOM shape, not a duplicate.
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
   *
   * `maxStagnantScrolls` stops the loop when scrolling stops producing new
   * rows. Without it this loop never exits if the grid holds fewer rows than
   * `targetCount` (e.g. the tab said "Docs: 20" but only 9 rows can ever
   * render), which hangs the whole run rather than reporting what it found.
   * The same guard already exists in forEachRefRow and in
   * AaPage.findResultRowByIndex; this brings the third loop in line.
   */
  async forEachResultRow(
    targetCount: number,
    handleRow: (row: Locator, rowId: string) => Promise<void>,
    options: {
      scrollStyle?: "intoViewStart" | "intoViewIfNeeded";
      logRowId?: boolean;
      maxStagnantScrolls?: number;
    } = {},
  ) {
    const {
      scrollStyle = "intoViewStart",
      logRowId = true,
      maxStagnantScrolls = 12,
    } = options;

    let resultsFound = 0;
    let stagnantScrolls = 0;
    const processedIds = new Set<string>();

    while (resultsFound < targetCount) {
      const rows = this.rows;
      const visibleRowCount = await rows.count();

      if (visibleRowCount === 0) {
        stagnantScrolls++;
        if (stagnantScrolls > maxStagnantScrolls) {
          console.log(
            `forEachResultRow: giving up with ${resultsFound}/${targetCount} rows - the grid rendered no rows for ${maxStagnantScrolls} attempts.`,
          );
          return;
        }
        await this.page.waitForTimeout(500);
        continue;
      }

      const processedBeforeThisPass = processedIds.size;

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
        // A pass that added no new row ids means scrolling is no longer
        // revealing anything, so count it towards giving up.
        stagnantScrolls =
          processedIds.size === processedBeforeThisPass ? stagnantScrolls + 1 : 0;

        if (stagnantScrolls > maxStagnantScrolls) {
          console.log(
            `forEachResultRow: stopping with ${resultsFound}/${targetCount} rows - ${maxStagnantScrolls} scrolls revealed no new rows.`,
          );
          return;
        }

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

  // ---------------------------------------------------------------
  // Search API response
  // ---------------------------------------------------------------

  /**
   * Waits for the /api/search call a search triggers and returns its JSON.
   *
   * The count-driven flows use `TotalRecords` from this payload instead of
   * reading the "Docs: N" tab, because they need the real total before the
   * grid has finished rendering. Throws on a non-2xx so a server error fails
   * the scenario immediately rather than after a 90s tab-text timeout.
   */
  async waitForSearchResponse(timeout = 90000) {
    const response = await this.page.waitForResponse(
      (r) => r.url().includes("/api/search"),
      { timeout },
    );

    if (!response.ok()) {
      throw new Error(`Search API failed with status: ${response.status()}`);
    }

    return response.json();
  }

  /**
   * waitForSearchResponse, but a failed search is returned instead of thrown.
   *
   * Every count-driven flow used to call waitForSearchResponse bare. When the
   * search API errored or never fired (a swallowed Enter, a server hiccup),
   * the throw escaped the flow, so updateGoogleSheet never ran and the sheet
   * got NO row at all - indistinguishable from "this test never ran". With
   * this, the flow carries on with TotalRecords: 0, records the reason as a
   * failure, and still writes an INVALID row.
   *
   * The ANSI strip is inlined rather than importing helpers.cleanErrorMessage
   * because helpers.ts already imports BasePage, and importing it back would
   * make the two modules circular.
   */
  async trySearchResponse(
    timeout = 90000,
  ): Promise<{ body: any; error?: string }> {
    try {
      return { body: await this.waitForSearchResponse(timeout) };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const message =
        // eslint-disable-next-line no-control-regex
        raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").split("\n")[0].trim() ||
        "Unknown error (no message)";

      return { body: { TotalRecords: 0 }, error: message };
    }
  }

  // ---------------------------------------------------------------
  // Result grid - data-ref rows
  // ---------------------------------------------------------------

  /**
   * Result rows addressed by their `data-ref` attribute.
   *
   * This is a DIFFERENT row locator from `rows` above and the two are not
   * interchangeable. `rows` walks whatever the virtualized grid has drawn
   * and de-dupes on the row's `id`, which the grid RE-USES as you scroll.
   * `data-ref` ("search_...") is stable per document, so the flows that
   * must visit every document exactly once key off this one instead.
   */
  get refRows(): Locator {
    return this.page.locator('[data-test="resultRow"][data-ref^="search_"]');
  }

  /** Scrolls the result grid down by one step. */
  async scrollResultGrid(step: number = 600, settleMs: number = 300) {
    await this.scroller.evaluate((el, by) => el.scrollBy(0, by), step);
    await this.page.waitForTimeout(settleMs);
  }

  /**
   * Walks the grid by `data-ref` and runs `handleRow` once per document,
   * scrolling until `targetCount` rows are seen or the grid stops growing.
   *
   * Kept separate from `forEachResultRow` on purpose: this one stops as soon
   * as a scroll yields no new rows (so it finishes on a short result set
   * instead of spinning), and it does not swallow row errors. Flows that
   * need the id-based, skip-and-continue behaviour keep using
   * `forEachResultRow`.
   */
  async forEachRefRow(
    targetCount: number,
    handleRow: (row: Locator, ref: string) => Promise<void>,
  ) {
    const rows = this.refRows;
    const processed = new Set<string>();
    let previousCount = 0;

    while (processed.size < targetCount) {
      const visibleRowCount = await rows.count();

      for (let i = 0; i < visibleRowCount; i++) {
        const row = rows.nth(i);
        const ref = await row.getAttribute("data-ref");
        if (!ref || processed.has(ref)) continue;

        processed.add(ref);
        await handleRow(row, ref);
      }

      if (processed.size === previousCount) break;

      previousCount = processed.size;
      await this.scrollResultGrid();
    }
  }

  // ---------------------------------------------------------------
  // Intelligize ID
  // ---------------------------------------------------------------

  /**
   * The text the document's Info panel is anchored on when looking up the
   * Intelligize ID. AOE labels this block "Filing Info" instead, so it
   * overrides just this string rather than the whole lookup below.
   */
  protected get infoPanelAnchorText(): string {
    return "Filed";
  }

  /**
   * Reads the value sitting next to a label inside a result row, e.g.
   * rowValueByLabel(row, "Accelerated Status").
   *
   * The display column for that label has to be switched on first (see
   * selectInfoOption). SF used to carry four near-identical copies of this
   * lookup - one per label - differing only in the label text and whether
   * the value was wrapped in a <p>.
   *
   * Returns "" when the label is not in the row. The per-label copies threw
   * instead, which meant a missing column surfaced as an unrelated locator
   * timeout rather than as an empty value the flow could report on.
   */
  async rowValueByLabel(
    row: Locator,
    label: string,
    options: { inParagraph?: boolean } = {},
  ): Promise<string> {
    const valuePath = options.inParagraph
      ? "xpath=following-sibling::span/p"
      : "xpath=following-sibling::span";

    const value = row
      .locator(`span:has-text("${label}")`)
      .locator(valuePath)
      .first();

    const text = await value.textContent().catch(() => null);

    return (text ?? "").trim();
  }

  /**
   * Reads a row's Intelligize ID. Requires the "Intelligize ID" display
   * column to have been switched on first (see selectInfoOption).
   */
  async rowIntelligizeId(row: Locator): Promise<string> {
    return this.rowValueByLabel(row, "Intelligize ID");
  }

  /**
   * A row's filing/release date cell.
   *
   * AOE and SF each had their own copy of this with the identical selector.
   */
  async rowDate(row: Locator): Promise<string> {
    const date = await row
      .locator(".styles__filing-date-value-column___2pu1v")
      .textContent();

    return date?.trim() ?? "";
  }

  /** Reads the Intelligize ID from the open document's Info panel. */
  async openDocIntelligizeId(): Promise<string> {
    const panel = this.page
      .locator(`div:has-text("${this.infoPanelAnchorText}")`)
      .locator('xpath=ancestor::div[contains(@class,"info-panel")]');

    const row = panel
      .locator("div")
      .filter({ has: this.page.getByText("Intelligize ID", { exact: true }) })
      .first();

    await row.scrollIntoViewIfNeeded();

    const value = await row.locator("li span").first().innerText();

    return value.trim();
  }

  /**
   * Checks or unchecks a filter-bar checkbox by its input id, e.g.
   * setCheckboxState("-ExhibitsToFilings", false).
   *
   * Clicks only when the box is not already in the wanted state, because
   * these checkboxes toggle and an unconditional click would undo it.
   */
  async setCheckboxState(inputId: string, shouldBeChecked: boolean) {
    const checkbox = this.page.locator(`#${inputId}`);
    const label = this.page.locator(`label[for="${inputId}"]`);

    if ((await checkbox.isChecked()) !== shouldBeChecked) {
      await label.click();
    }

    await expect(checkbox).toBeChecked({ checked: shouldBeChecked });
  }

  // ---------------------------------------------------------------
  // Search type / filter panel
  // ---------------------------------------------------------------

  /** Switches the keyword box between "Boolean" and "Conceptual". */
  async selectSearchType(value: string) {
    await this.page.getByRole("button", { name: value }).click();
  }

  /** Collapses/expands the left filter panel to free up grid width. */
  async toggleFiltersPanel() {
    const filtersToggleBtn = this.page
      .locator('[data-notice="toggle-panel-button"]')
      .first();

    await filtersToggleBtn.waitFor({ state: "visible" });
    await filtersToggleBtn.click();
  }

  // ---------------------------------------------------------------
  // Document viewer - stepping through documents
  // ---------------------------------------------------------------

  /**
   * Opens a row's document by hovering it first.
   *
   * The View button only renders on hover, so scrollIntoViewIfNeeded +
   * hover are both required before the click. This is the count-driven
   * flows' way in; `openDocument` above is the one that also waits for the
   * document body, and they are kept apart because these flows step through
   * documents with Next instead of re-opening from the grid.
   */
  async clickViewForRow(row: Locator) {
    await row.scrollIntoViewIfNeeded();
    await row.hover();

    await row.locator('button:has-text("View")').click();
  }

  /** Steps to the next document via the viewer's own Next control. */
  async clickNextDocument() {
    const nextButton = this.page.locator('button[title="Next"]').first();

    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    await nextButton.click();
    await this.page
      .locator('[data-notice="tab-icon-DOCUMENT"]')
      .waitFor({ state: "visible", timeout: 10000 });
  }

  /** Opens the Info tab of the document currently in the viewer. */
  async openInfoTab() {
    await this.page.getByTitle("Info", { exact: true }).click();
  }

  /**
   * Closes the currently selected tab.
   *
   * `waitForGrid: true` (the old `closeCurrentDocumentTab`) waits for result
   * rows to reappear after the close - use this when the tab underneath is
   * the results grid. `waitForGrid: false` (the old `closeCurrentSearchTab`)
   * skips that wait - use it when a fresh search is about to run and there
   * is no grid left underneath to wait for.
   */
  async closeCurrentTab(options: { waitForGrid?: boolean } = {}) {
    const { waitForGrid = true } = options;

    const selectedTab = this.page.locator('[class*="tab--selected"]');
    const closeButton = selectedTab.locator('span[class*="Close"]');

    await expect(closeButton).toBeVisible();
    await closeButton.click();

    if (waitForGrid) {
      await expect(this.refRows.first()).toBeVisible();
    }
  }

  // ---------------------------------------------------------------
  // Keyword highlighting
  // ---------------------------------------------------------------

  /**
   * True when the open document shows at least one keyword highlight.
   *
   * Scrolls to the bottom up to 10 times because the viewer renders the
   * document lazily and the first highlight can be below the fold. Stops
   * early once the page stops growing.
   *
   * `extraSelectors` exists because the apps do not all mark highlights up
   * the same way - DBM and Insiders use a <customhighlight> tag the others
   * never emit - so each app's page class passes its own additions rather
   * than every app searching for every variant.
   */
  async hasDocumentHighlight(extraSelectors: string[] = []): Promise<boolean> {
    const selector = [
      "em.highlight", // main keyword highlight
      ".Tablehighlight", // table highlight
      ".highlight-terms", // clickable highlight terms
      "em.ixbrl-highlight", // ixbrl highlights
      ...extraSelectors,
    ].join(",");

    const locator = this.page.locator(selector);

    let previousHeight = 0;

    for (let i = 0; i < 10; i++) {
      if ((await locator.count()) > 0) {
        return true;
      }

      const currentHeight = await this.page.evaluate(
        () => document.body.scrollHeight,
      );

      if (currentHeight === previousHeight) break;

      previousHeight = currentHeight;

      await this.page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight),
      );
      await this.page.waitForTimeout(300);
    }

    return (await locator.count()) > 0;
  }

  /**
   * Clicks the first highlighted snippet in the outline panel so the viewer
   * jumps to it. Returns false when the document has no snippet to click.
   *
   * The wait for the highlight inside the iframe is deliberately swallowed:
   * a document that never renders one is exactly what the caller is trying
   * to detect, so it must reach its own check instead of throwing here.
   */
  async clickFirstHighlightedSnippet(): Promise<boolean> {
    const snippets = this.page.locator(
      ".SectionTree-styles__section-tree___1Y7yk em.highlight",
    );

    if ((await snippets.count()) === 0) return false;

    await snippets.first().click();

    await this.page
      .locator(".loading-spinner")
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => {});

    const docFrame = this.page.frameLocator('iframe[id^="document_"]');

    await docFrame
      .locator("em.highlight")
      .first()
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() =>
        console.log(
          "Highlight tag did not appear in the document within the timeout window.",
        ),
      );

    return true;
  }

  /**
   * Checks a row's highlights: whether there are any, and whether they all
   * carry the expected highlight background.
   *
   * `highlightSelector` differs per app (<em class="highlight"> vs
   * <customhighlight>), so each app's page class supplies its own.
   */
  async checkRowHighlights(
    row: Locator,
    highlightSelector: string,
  ): Promise<{ found: boolean; invalidColor: boolean }> {
    const highlights = row.locator(highlightSelector);
    const count = await highlights.count();

    if (count === 0) {
      return { found: false, invalidColor: false };
    }

    let invalidColor = false;

    for (let i = 0; i < count; i++) {
      const color = await highlights
        .nth(i)
        .evaluate((el) => getComputedStyle(el).backgroundColor);

      if (color !== HIGHLIGHT_BG_COLOR) {
        invalidColor = true;
        break;
      }
    }

    return { found: true, invalidColor };
  }

  // ---------------------------------------------------------------
  // Grid date column
  // ---------------------------------------------------------------

  /**
   * Switches the grid's date column from `fromLabel` to `toLabel` (e.g.
   * "Date Filed" -> "Date Released") when it is not already showing it.
   *
   * The dropdown is dismissed by clicking its own backdrop; Escape leaves
   * the column unchanged, so it is not used here.
   */
  async switchDateColumn(fromLabel: string, toLabel: string) {
    if ((await this.page.getByText(toLabel, { exact: true }).count()) > 0) {
      return;
    }

    await this.page.getByText(fromLabel, { exact: true }).last().click();
    await this.page.locator("li", { hasText: toLabel }).click();
    await this.page.locator("div.styles__background___2AkxG").click();
    await this.page.waitForLoadState();
  }

}
