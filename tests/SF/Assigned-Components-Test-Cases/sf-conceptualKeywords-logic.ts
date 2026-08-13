import { expect, Page, test } from "@playwright/test";
import {
  getRandomIndices,
  parseCount,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

// ============================================================================
// 1. LOCATOR FACTORIES
// ============================================================================
const getUIElements = (page: Page) => {
  const sf = new SfPage(page);
  return {
    keywordInput: sf.keywordsInput,
    exhibitsToFilingsLabel: sf.exhibitsToFilingsLabel,
    modal: sf.popupContainer,
  };
};

const getSearchElements = (page: Page) => {
  const sf = new SfPage(page);
  return {
    keywordInput: sf.keywordsInput,
    searchBtn: sf.searchBtn,
    gridContainer: sf.scroller,
  };
};

const getConceptualElements = (page: Page) => {
  const sf = new SfPage(page);
  return {
    expandKeywordsBtn: sf.expandKeywordsBtn,
    booleanWarning: sf.booleanWarning,
    relevanceColumnHeader: sf.relevanceColumnHeader,
    filterBar: sf.filterBar,
  };
};

const getDocumentElements = (page: Page) => {
  const sf = new SfPage(page);
  const sectionResultOutline = sf.sectionResultOutline;
  return {
    row: page
      .locator(".ReactVirtualized__Grid")
      .last()
      .locator('> div[role="rowgroup"]')
      .locator(`> div > div[data-test="resultRow"]`)
      .first(),
    sectionResultOutline,
    outlineHighlights: sectionResultOutline.locator("em"),
  };
};

// ============================================================================
// 2. HELPER FUNCTIONS
// ============================================================================
export type RowData = {
  accessionNo?: string;
  fullText: string;
  highlights: string;
  hasViewAllHits: boolean;
};

const scrapeVirtualizedGrid = async (
  page: Page,
  targetCount = 20,
): Promise<RowData[]> => {
  const sf = new SfPage(page);
  const extractedRows: RowData[] = [];

  const { gridContainer } = getSearchElements(page);
  await gridContainer.waitFor({ state: "visible", timeout: 15000 });

  let count = 0;
  await sf.forEachRow(targetCount, async (row) => {
    const data = await sf.rowData(row);
    const fullText = data.paragraphs.join(" ").replace(/\n/g, " ").trim();
    const highlights = data.highlights.join(" ").replace(/\n/g, " ").trim();

    const hasViewAllHits =
      (await row.getByText(/View All Hits|View More/i).count()) > 0;

    const accessionNo =
      data.spans.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) || "N/A";
    count++;
    console.log(
      `Extracted Row ${count}: Acc.No: ${accessionNo} | Highlights: ${highlights} | Has View All Hits: ${hasViewAllHits}`,
    );

    extractedRows.push({ accessionNo, fullText, highlights, hasViewAllHits });
  });

  return extractedRows;
};

const validateRandomConceptualDocs = async (
  page: Page,
  sampleQuery: string,
  logToFile: Function,
  totalResultsAvailable: number,
  docsToTest: number,
  gridTabIndex: number,
) => {
  const sf = new SfPage(page);
  logToFile(
    `\n--- PHASE 3: Testing ${docsToTest} Random Documents for "${sampleQuery}" ---`,
  );

  const randomRowIds = getRandomIndices(totalResultsAvailable, docsToTest);
  randomRowIds.sort((a, b) => a - b);
  logToFile(`Random Rows Selected for Testing: ${randomRowIds.join(", ")}`);

  const { gridContainer } = getSearchElements(page);

  for (const targetId of randomRowIds) {
    logToFile(`\n➡️ Navigating to Row ID: ${targetId}`);

    const resultsContainer = gridContainer.locator('> div[role="rowgroup"]');
    let emptyAttempts = 0;
    let foundRow = false;

    // STEP A: SCROLL UNTIL WE FIND THE TARGET ROW
    while (!foundRow) {
      const currentRow = resultsContainer
        .locator(`> div > div[data-test="resultRow"][id="${targetId}"]`)
        .first();

      if ((await currentRow.count()) > 0) {
        await currentRow.evaluate((el) =>
          el.scrollIntoView({ block: "center" }),
        );
        await page.waitForTimeout(500);

        const viewBtn = currentRow
          .getByRole("button", { name: /View/i })
          .last();
        await viewBtn.click();
        foundRow = true;
      } else {
        emptyAttempts++;
        if (emptyAttempts > 50) {
          throw new Error(
            `Failed to find row ID ${targetId} after heavy scrolling.`,
          );
        }
        await gridContainer.evaluate((el) =>
          el.scrollBy({ top: 400, behavior: "instant" }),
        );
        await page.waitForTimeout(500);
      }
    }

    // STEP B: PERFORM PHASE 3 LOGIC INSIDE DOC (CONCEPTUAL SPECIFIC)
    await page.waitForTimeout(10000); // Wait for document to load
    logToFile(`Row ${targetId} Opened. Executing Phase 3 Logic...`);
    const docs = getDocumentElements(page);

    const keywordsHeader = page
      .locator(".snippetsPanel__panel-header__keywords___3M1-s span")
      .first();
    console.log(`Keywords Header Text: "${await keywordsHeader.innerText()}"`);
    // await expect(keywordsHeader).toHaveText(
    //   new RegExp(`Keywords:\\s*${sampleQuery}`, "i"),
    //   { timeout: 10000 },
    // );

    const outlineCount = await docs.outlineHighlights.count();
    console.log(
      `Found ${outlineCount} semantic highlights in the document outline.`,
    );
    if (outlineCount > 0) {
      //   await docs.outlineHighlights
      //     .nth(outlineCount - 1)
      //     .scrollIntoViewIfNeeded();
      await page
        .locator(".SectionTree-styles__section-tree___1Y7yk")
        .nth(outlineCount - 1)
        .locator("span")
        .last()
        .click();
    }

    // IN CONCEPTUAL MODE: We just verify that semantic highlights rendered (em tags exist), we don't regex match specific terms.
    const highlights = sf.documentFrame.locator("em");

    const isHighlightVisible = await highlights
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false);

    if (isHighlightVisible) {
      logToFile(
        `✅ Semantic highlights successfully rendered in iframe for Row ${targetId}`,
      );
    } else {
      logToFile(
        `❌ FAILED: No highlights rendered in iframe for Row ${targetId}`,
      );
      expect
        .soft(false, `No iframe highlights found for Row ${targetId}`)
        .toBeTruthy();
    }

    // STEP C: JUMP BACK TO RESULTS GRID TAB
    logToFile(`Jumping back to Results Grid (Tab Index: ${gridTabIndex})...`);
    const resultsTab = sf.resultTabsMatching(["Docs:", "No Results Found"]).nth(gridTabIndex - 1);
    await resultsTab.click();

    await gridContainer.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
  }
  logToFile(`\n--- PHASE 3: Random Document Testing Complete ---`);
};

// ============================================================================
// 3. EXPORTED TEST LOGIC
// ============================================================================
export const runConceptualSearchTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Conceptual Search Report ---");
  const sf = new SfPage(page);
  const search = getSearchElements(page);
  const conceptualUI = getConceptualElements(page);
  let index = 0;

  // --- PHASE 1: UI VALIDATION ---
  await test.step("PHASE 1: Validate Conceptual UI Modes and Warnings", async () => {
    logToFile("\n--- PHASE 1: UI Validation ---");

    await sf.clearFilters();
    getUIElements(page).exhibitsToFilingsLabel.click();
    await page.waitForTimeout(1000);

    await search.keywordInput.fill("cybersecurity AND breach");
    logToFile(`Typed Boolean query: "cybersecurity AND breach"`);

    await sf.conceptualTabBtn.click();

    await expect(conceptualUI.booleanWarning).toBeVisible({ timeout: 15000 });
    logToFile(
      "✅ Warning message correctly appeared for Boolean terms in Conceptual mode.",
    );

    await expect(conceptualUI.expandKeywordsBtn).toBeDisabled();
    logToFile(
      "✅ 'Expand Keywords' button is correctly DISABLED in Conceptual mode.",
    );

    await sf.booleanTabBtn.click();

    await expect(conceptualUI.booleanWarning).toBeHidden();
    logToFile("✅ Warning message correctly disappeared in Boolean mode.");

    await expect(conceptualUI.expandKeywordsBtn).toBeEnabled();
    logToFile(
      "✅ 'Expand Keywords' button is correctly ENABLED in Boolean mode.",
    );
  });

  // --- PHASE 2: GRID RESULTS ---
  await test.step("PHASE 2: Validating Conceptual Grid Results", async () => {
    logToFile("\n--- PHASE 2: Testing Conceptual Data Grid ---");

    const conceptualQuery = "geopolitical instability";

    await sf.clearFilters();
    getUIElements(page).exhibitsToFilingsLabel.click();
    await page.waitForTimeout(1000);

    await search.keywordInput.fill(conceptualQuery);
    await sf.conceptualTabBtn.click();
    await search.searchBtn.click();

    const tabText = await sf.getTabText(index++, logToFile, false);
    if (
      tabText.includes("No Results Found") ||
      tabText.includes("Invalid Query")
    ) {
      logToFile(`⚠️ Query returned -> ${tabText.trim()}`);
      expect
        .soft(false, `Conceptual search failed with message: ${tabText.trim()}`)
        .toBeTruthy();
      // return;
    }

    await expect(conceptualUI.filterBar).toContainText(
      /Keyword Type:\s*Conceptual/i,
      { timeout: 10000 },
    );
    logToFile("✅ Filter bar correctly shows 'Keyword Type: Conceptual'.");

    await expect(conceptualUI.relevanceColumnHeader).toBeVisible({
      timeout: 10000,
    });
    logToFile(
      "✅ 'Relevance' sort column successfully appeared in the grid header.",
    );

    logToFile(`\nScraping results for highlight validation...`);
    await sf.configureDisplayColumns({
      "Filing Info": ["Accession #"],
      "Company Info": [],
    });
    const extractedRows = await scrapeVirtualizedGrid(page, 20);
    let failedRows = 0;

    extractedRows.forEach((row, i) => {
      if (!row.highlights || row.highlights.length === 0) {
        logToFile(
          `❌ Row ${i + 1} FAILED: No semantic highlights found in the snippet.`,
        );
        failedRows++;
      }
    });

    const isValid = extractedRows.length > 0 && failedRows === 0;

    if (isValid) {
      logToFile(
        `Validation Status: VALID ✅ (All ${extractedRows.length} snippets contained semantic highlights)`,
      );
    } else {
      logToFile(
        `Validation Status: INVALID ❌ (${failedRows} rows were missing highlights)`,
      );
      expect
        .soft(
          false,
          `Conceptual Search failed on ${failedRows} rows missing highlights.`,
        )
        .toBeTruthy();
    }
    await sf.closeAllOpenTabs();
  });

  //   // --- PHASE 3: DOCUMENT HIGHLIGHTING ---
  //   await test.step("PHASE 3: Document View Highlighting", async () => {
  //     logToFile("\n--- PHASE 3: Testing Document Level Highlighting ---");

  //     const conceptualQuery = "risk factor";

  //     await sf.clearFilters();
  //     getUIElements(page).exhibitsToFilingsLabel.click();
  //     await page.waitForTimeout(1000);
  //     await search.keywordInput.fill(conceptualQuery);
  //     await sf.conceptualTabBtn.click();
  //     await search.searchBtn.click();

  //     const tabText = await getTabText(page, 0, logToFile, false);
  //     const docsCount = parseCount(tabText);
  //     const availableDocsForTesting = Math.min(docsCount, 20);
  //     await validateRandomConceptualDocs(
  //       page,
  //       conceptualQuery,
  //       logToFile,
  //       availableDocsForTesting,
  //       5,
  //       0,
  //     );
  //   });

  logToFile("\n--- End of Conceptual Search Report ---");
};
