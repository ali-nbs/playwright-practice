import { Page, Locator, expect } from "@playwright/test";

export type ConfigureOptions = {
  enableSnippets?: boolean;
  enableCrossReferenceLinks?: boolean;
  enableRedlinePastVersion?: boolean;
};

export const HIGHLIGHT_BG_COLOR = "rgb(252, 234, 151)";

const throwGridStateError = (kind: "error" | "crash", message: string) => {
  const err: any = new Error(message);
  err.kind = kind;
  throw err;
};

export class BasePage {
  constructor(protected readonly page: Page) {}

  // ---------------------------------------------------------------
  // App Navigations
  // ---------------------------------------------------------------

  async openApp(linkText: string) {
    await this.page.locator(`text=/${linkText}/i`).first().click();
  }

  async navigateFromTo(sourcePage: String, targetPage: String) {
    await this.page
      .locator(`text=/${sourcePage}/i`)
      .first()
      .click({ force: true });
    const isChecked = await this.page.locator("input#sameWindow").isChecked();

    if (isChecked) {
      await this.page.getByText("Open in a New Browser Tab").click();
      await this.page.waitForTimeout(200);
    }
    await this.page
      .locator(`text=/${targetPage}/i`)
      .first()
      .click({ force: true });
  }

  // ---------------------------------------------------------------
  // Filters shared by most apps
  // ---------------------------------------------------------------

  get searchBtn(): Locator {
    return this.page.getByRole("button", { name: /^Search$/i }).first();
  }

  async clearFilters() {
    const btn = this.page.getByRole("button", { name: /^Clear Filters$/i });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
    }
  }

  get okBtn(): Locator {
    return this.page.getByRole("button", { name: /ok/i });
  }

  get applyBtn(): Locator {
    return this.page.getByRole("button", { name: "Apply" });
  }

  /** The Date filter. Apps whose Date box differs override this. */
  get dateInput(): Locator {
    return this.page.locator(
      `//label[text()="Date"]/ancestor::div[5]//input`,
    );;
  }

   get keywordsInput(): Locator {
    return this.page.getByTestId("keywords-input");
  }

  filterBlock(labelText: RegExp): Locator {
    return this.page
      .locator("div.styles__focusContainer___13rFy")
      .filter({ has: this.page.locator("label", { hasText: labelText }) });
  }

  addIconIn(block: Locator): Locator {
    return block.locator("span._icon_1jkal_249.Add").first();
  }

  filterAddIcon(labelText: RegExp): Locator {
    return this.addIconIn(this.filterBlock(labelText));
  }

  /** Any button by role currently only using as to toggle between Bolean and Comnceptual search type **/
  // async selectSearchType(value: string) {
  //   await this.page.getByRole("button", { name: value }).click();
  // }

  get booleanTabBtn(): Locator {
    return this.page.getByRole("button", { name: /Boolean/i });
  }

  get conceptualTabBtn(): Locator {
    return this.page.getByRole("button", { name: /^Conceptual$/i });
  }

  async toggleFiltersPanel() {
    const filtersToggleBtn = this.page
      .locator('[data-notice="toggle-panel-button"]')
      .first();

    await filtersToggleBtn.waitFor({ state: "visible" });
    await filtersToggleBtn.click();
  }

  get popupBody(): Locator {
    return this.page.locator("div.PopupBody__popup__body___1J_d3");
  }

  get popupContainer(): Locator {
    return this.page.locator("div.PopupContainer__container___1-tgp").first();
  }

  pickerListItem(text: RegExp): Locator {
    return this.page
      .locator("li.styles__check-list-item__container___233d9")
      .filter({ hasText: text });
  }

  pickerCheckboxIcon(row: Locator): Locator {
    return row.locator("label._checkbox__icon_1xotg_257");
  }

  // ---------------------------------------------------------------
  // Typing into filters
  // ---------------------------------------------------------------

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
  // Result tabs and Grid
  // ---------------------------------------------------------------

  get crashScreen(): Locator {
    return this.page.getByText("Oops!", { exact: false }).first();
  }

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

  get loadMoreResultsLink(): Locator {
    return this.page.locator('a:has-text("Load more results")');
  }

  elementWithText(
    tag: string,
    text: string | RegExp,
    root: Locator | Page = this.page,
  ): Locator {
    return root.locator(tag, { hasText: text });
  }

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

  async getTabText(
    expectedIndex: number,
    logToFile: Function,
    isNeedLoadMoreResults: boolean = false,
  ) {
    console.log("expected index ", expectedIndex);
    const tabLabels = this.resultTabsMatching(
      ["Docs:", "Results:", "Offerings:", "No Results Found"],
      { caseInsensitiveFragments: ["error"] },
    );
    const target = tabLabels.nth(expectedIndex);
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
      text = await tabLabels.nth(expectedIndex).innerText();
    }

    return text;
  }

  get rows(): Locator {
    return this.page
      .locator(".ReactVirtualized__Grid")
      .last()
      .locator('div[data-test="resultRow"]');
  }
  
  rowById(id: number | string): Locator {
    return this.resultsContainer
      .locator(`> div > div[data-test="resultRow"][id="${id}"]`)
      .first();
  }

  /**
   * All the text a result row carries, read in one pass.
   *
   *   spans      - every <span>, trimmed, empties dropped (title, source,
   *                category, accession #, ...)
   *   paragraphs - every <p> (snippet/body text)
   *   highlights - <em> inside a <p> (keyword-highlight matches)
   *   links      - every <a> (anchor text, e.g. boilerplate section links)
   *
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

  async rowValueByLabel(
    row: Locator,
    label: string,
    options: { inParagraph?: boolean; containerTag?: "span" | "div" } = {},
  ): Promise<string> {
    const { inParagraph = false, containerTag = "span" } = options;

    if (containerTag === "div") {
      const value = row
        .locator("div")
        .filter({ hasText: label })
        .locator("span")
        .last();

      if (!(await value.count())) return "";
      return (await value.innerText()).trim();
    }

    const valuePath = inParagraph
      ? "xpath=following-sibling::span/p"
      : "xpath=following-sibling::span";

    const value = row
      .locator(`span:has-text("${label}")`)
      .locator(valuePath)
      .first();

    const text = await value.textContent().catch(() => null);

    return (text ?? "").trim();
  }

  get scroller(): Locator {
    return this.page.locator(".ReactVirtualized__Grid").last();
  }

  get resultsContainer(): Locator {
    return this.scroller.locator('> div[role="rowgroup"]');
  }

  /**
   * Walks the result grid and runs `handleRow` for each row, scrolling to
   * load more rows until `targetCount` rows have been processed.
  **/

  async forEachRow(
    targetCount: number,
    handleRow: (row: Locator, key: string) => Promise<void>,
    options: {
      keyAttr?: "id" | "data-ref";
      swallowRowErrors?: boolean;
      scrollStyle?: "intoViewStart" | "intoViewIfNeeded" | "scrollBy";
      logRowId?: boolean;
      maxStagnantScrolls?: number;
    } = {},
  ) {
    const {
      keyAttr = "id",
      swallowRowErrors = false,
      scrollStyle = keyAttr === "data-ref" ? "scrollBy" : "intoViewStart",
      logRowId = true,
      maxStagnantScrolls = 12,
    } = options;

    const rowsLocator =
      keyAttr === "data-ref"
        ? this.page.locator('[data-test="resultRow"][data-ref^="search_"]')
        : this.rows;

    let resultsFound = 0;
    let stagnantScrolls = 0;
    const processed = new Set<string>();

    while (resultsFound < targetCount) {
      const visibleRowCount = await rowsLocator.count();

      if (visibleRowCount === 0) {
        stagnantScrolls++;
        if (stagnantScrolls > maxStagnantScrolls) {
          console.log(
            `forEachRow: giving up with ${resultsFound}/${targetCount} rows - the grid rendered no rows for ${maxStagnantScrolls} attempts.`,
          );
          return;
        }
        await this.page.waitForTimeout(500);
        continue;
      }

      const processedBeforeThisPass = processed.size;

      for (let i = 0; i < visibleRowCount; i++) {
        const row = rowsLocator.nth(i);
        const key = await row.getAttribute(keyAttr);
        if (logRowId) console.log(`row ${keyAttr}`, key);

        if (!key || processed.has(key)) continue;

        if (swallowRowErrors) {
          try {
            await handleRow(row, key);
            processed.add(key);
            await this.page.waitForTimeout(500);
            resultsFound++;
          } catch (e) {
            console.log("err :", e);
            continue;
          }
        } else {
          await handleRow(row, key);
          processed.add(key);
          resultsFound++;
        }

        if (resultsFound >= targetCount) break;
      }

      if (resultsFound < targetCount) {
        stagnantScrolls =
          processed.size === processedBeforeThisPass ? stagnantScrolls + 1 : 0;

        if (stagnantScrolls > maxStagnantScrolls) {
          console.log(
            `forEachRow: stopping with ${resultsFound}/${targetCount} rows - ${maxStagnantScrolls} scrolls revealed no new rows.`,
          );
          return;
        }

        if (scrollStyle === "intoViewIfNeeded") {
          await rowsLocator.last().scrollIntoViewIfNeeded();
        } else if (scrollStyle === "scrollBy") {
          await this.scroller.evaluate((el, by) => el.scrollBy(0, by), 600);
        } else {
          await rowsLocator
            .last()
            .evaluate((el) => el.scrollIntoView({ block: "start" }));
        }
        await this.page.waitForTimeout(500);
      }
    }
  }

  async switchDateColumn(fromLabel: string, toLabel: string) {
    if ((await this.page.getByText(toLabel, { exact: true }).count()) > 0) {
      return;
    }

    await this.page.getByText(fromLabel, { exact: true }).last().click();
    await this.page.locator("li", { hasText: toLabel }).click();
    await this.page.locator("div.styles__background___2AkxG").click();
    await this.page.waitForLoadState();
  }


  // ---------------------------------------------------------------
  // Tab management
  // ---------------------------------------------------------------
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

  async backToResults() {
    const docsTab = this.resultTabsMatching(["Docs:"]).last();
    await docsTab.evaluate((el) => (el as HTMLElement).click());
  }

  async closeCurrentTab(options: { waitForGrid?: boolean } = {}) {
    const { waitForGrid = true } = options;

    const selectedTab = this.page.locator('[class*="tab--selected"]');
    const closeButton = selectedTab.locator('span[class*="Close"]');

    await expect(closeButton).toBeVisible();
    await closeButton.click();

    if (waitForGrid) {
      await expect(
        this.page
          .locator('[data-test="resultRow"][data-ref^="search_"]')
          .first(),
      ).toBeVisible();
    }
  }

  // ---------------------------------------------------------------
  // Toolbar
  // ---------------------------------------------------------------

  get downloadBtn(): Locator {
    return this.page.locator('button[title*="Download"]');
  }

  get excelListBtn(): Locator {
    return this.page.locator('button:has-text("Excel List")');
  }

  get emailBtn(): Locator {
    return this.page.locator(
      'span[title="Email the selected items from the list below"]',
    );
  }

  dialogCheckboxLabel(forAttr: string): Locator {
    return this.page.locator(`label[for="${forAttr}"]`);
  }

  get downloadFormatOptions(): Locator {
    return this.page.locator('div[name="formats"]');
  }

  // async scrollToRow(index: number): Promise<Locator> {
  //   const height = await this.scroller.evaluate((el) => {
  //     const sampleRow = el.querySelector('[data-test="resultRow"]');
  //     return sampleRow ? sampleRow.getBoundingClientRect().height : 115;
  //   });

  //   await this.scroller.evaluate(
  //     (el, { i, h }) => {
  //       el.scrollTop = i * h;
  //     },
  //     { i: index, h: height },
  //   );

  //   return this.rowById(index);
  // }

  viewButton(row: Locator): Locator {
    return row.getByRole("button", { name: /View/i });
  }

  // ---------------------------------------------------------------
  // Document View
  // ---------------------------------------------------------------

  get documentFrame() {
    return this.page.frameLocator("iframe").first();
  }

  async openDocCount(): Promise<number> {
    return this.page.locator('div[id="DocViewContainer"]').count();
  }

  async openDocument(row: Locator, timeout = 30000) {
    const viewBtn = this.viewButton(row);
    await expect(viewBtn).toBeVisible({ timeout: 5000 });
    const docsBefore = await this.openDocCount();
    await viewBtn.click();
    await this.waitForDocLoaded(docsBefore, timeout);
  }

  async waitForDocLoaded(docCountBeforeClick: number, timeout = 30000) {
    const containers = this.page.locator('div[id="DocViewContainer"]');
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if ((await containers.count()) > docCountBeforeClick) break;
      await this.page.waitForTimeout(200);
    }

    const newest = containers.last();
    await expect(newest).toBeVisible({ timeout });

    await expect(async () => {
      const textLength = await newest.evaluate(
        (el) => (el.textContent || "").trim().length,
      );
      expect(textLength).toBeGreaterThan(200);
    }).toPass({ timeout });
  }

  protected get infoPanelAnchorText(): string {
    return "Filed";
  }


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

  async clickNextDocument() {
    const nextButton = this.page.locator('button[title="Next"]').first();

    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    await nextButton.click();
    await this.page
      .locator('[data-notice="tab-icon-DOCUMENT"]')
      .waitFor({ state: "visible", timeout: 10000 });
  }

  async openInfoTab() {
    await this.page.getByTitle("Info", { exact: true }).click();
  }
  
  // ---------------------------------------------------------------
  // Search API response
  // ---------------------------------------------------------------

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
  // Keyword highlighting
  // ---------------------------------------------------------------

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
}
