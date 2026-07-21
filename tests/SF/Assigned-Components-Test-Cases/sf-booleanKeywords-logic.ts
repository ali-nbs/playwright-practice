import { expect, Page, test } from "@playwright/test";
import {
  getTabText,
  getRandomIndices,
  parseCount,
  closeAllOpenTabs,
  configureDisplayColumns,
} from "../../utils/helpers";

// ============================================================================
// 1. LOCATOR FACTORIES (Pure functions returning locators)
// ============================================================================
const getUIElements = (page: Page) => {
  const modal = page.locator("div.PopupContainer__container___1-tgp").first();
  return {
    keywordInput: page.getByTestId("keywords-input"),
    keywordPlsBtn: page.getByTestId("keywords-round-btn"),
    modal,
    modalInnerSearch: modal.getByTestId("keywords-search"),
    modalClearBtn: modal.getByRole("button", { name: "Clear" }),
    modalOkBtn: modal.getByRole("button", { name: "OK" }),
    exhibitsToFilingsLabel: page.locator('label[for="-ExhibitsToFilings"]'),
  };
};

const getSearchElements = (page: Page) => ({
  keywordInput: page.getByTestId("keywords-input"),
  booleanTabBtn: page.getByRole("button", { name: /Boolean/i }),
  searchBtn: page.getByRole("button", { name: /^Search$/i }).first(),
  clearBtn: page.getByRole("button", { name: /^Clear Filters$/i }),
  filterBar: page
    .locator(".styles__bread-crumb__wrapper___1Io7c")
    .first()
    .locator("span"),
  gridContainer: page.locator(".ReactVirtualized__Grid").last(),
});

const getDocumentElements = (page: Page) => {
  const sectionResultOutline = page.locator(".styles__root___17wXu").first();
  return {
    row: page
      .locator(".ReactVirtualized__Grid")
      .last()
      .locator('> div[role="rowgroup"]')
      .locator(`> div > div[data-test="resultRow"]`)
      .first(),
    sectionResultOutline,
    outlineHighlights: sectionResultOutline.locator("em"),
    bodyHighlights: page
      .locator(".document-body")
      .locator('mark, [style*="background-color: yellow"]'),
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
  const extractedRows: RowData[] = [];
  let processedCount = 0;
  let emptyAttempts = 0;

  const { gridContainer } = getSearchElements(page);
  await gridContainer.waitFor({ state: "visible", timeout: 15000 });
  const resultsContainer = gridContainer.locator('> div[role="rowgroup"]');

  while (processedCount < targetCount) {
    const currentRow = resultsContainer
      .locator(`> div > div[data-test="resultRow"][id="${processedCount}"]`)
      .first();

    if ((await currentRow.count()) > 0) {
      await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(400);

      // Extract full text (for proximity & NOT rules)
      const pTexts = await currentRow.locator("p").allInnerTexts();
      const fullText = pTexts.join(" ").replace(/\n/g, " ").trim();

      // Extract ONLY highlighted words (for AND/OR rules)
      const emTextsArray = await currentRow.locator("p em").allInnerTexts();
      const highlights = emTextsArray.join(" ").replace(/\n/g, " ").trim();

      // Check if this row hides some snippets behind a button
      const hasViewAllHits =
        (await currentRow.getByText(/View All Hits|View More/i).count()) > 0;

      const texts = await currentRow.locator("span").allInnerTexts();
      const cleanContent = texts
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const accessionNo =
        cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
        "N/A";
      console.log(`Accessible Name for Row ${processedCount}:`, accessionNo);

      extractedRows.push({ accessionNo, fullText, highlights, hasViewAllHits });

      processedCount++;
      emptyAttempts = 0; // Reset failsafe
    } else {
      emptyAttempts++;
      if (emptyAttempts > 10) {
        console.log(`⚠️ Reached end of grid. Stopped at ${processedCount}`);
        break;
      }
      // Nudge the scroller
      await gridContainer.evaluate((el) => {
        el.scrollBy({ top: 150, behavior: "instant" });
      });
      await page.waitForTimeout(500);
    }
  }

  return extractedRows;
};

const validateRandomDocuments = async (
  page: Page,
  sampleQuery: string,
  logToFile: Function,
  totalResultsAvailable: number,
  docsToTest: number,
  gridTabIndex: number,
) => {
  logToFile(
    `\n--- PHASE 3: Testing ${docsToTest} Random Documents for "${sampleQuery}" ---`,
  );

  const randomRowIds = getRandomIndices(totalResultsAvailable, docsToTest);
  logToFile(`Random Rows Selected for Testing: ${randomRowIds.join(", ")}`);

  const { gridContainer } = getSearchElements(page);

  for (const targetId of randomRowIds) {
    logToFile(`\n➡️ Navigating to Row ID: ${targetId}`);

    // ==========================================
    // STEP A: SCROLL UNTIL WE FIND THE TARGET ROW
    // ==========================================
    // await gridContainer.waitFor({ state: "visible", timeout: 15000 });
    const resultsContainer = gridContainer.locator('> div[role="rowgroup"]');

    let emptyAttempts = 0;
    let foundRow = false;

    while (!foundRow) {
      const currentRow = resultsContainer
        .locator(`> div > div[data-test="resultRow"][id="${targetId}"]`)
        .first();

      if ((await currentRow.count()) > 0) {
        await currentRow.evaluate((el) =>
          el.scrollIntoView({ block: "center" }),
        );
        await page.waitForTimeout(500);

        const texts = await currentRow.locator("span").allInnerTexts();
        const cleanContent = texts
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        const accessionNo =
          cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
          "N/A";
        logToFile(`Found Row ${targetId} with aria-label: ${accessionNo}`);
        console.log(`Accessible Name for Row ${targetId}:`, accessionNo);

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
        await gridContainer.evaluate((el) => {
          el.scrollBy({ top: 400, behavior: "instant" });
        });
        await page.waitForTimeout(500);
      }
    }

    // ==========================================
    // STEP B: PERFORM PHASE 3 LOGIC INSIDE DOC
    // ==========================================
    await page.waitForTimeout(10000); // Wait for document to load
    logToFile(`Row ${targetId} Opened. Executing Phase 3 Logic...`);
    const docs = getDocumentElements(page);

    const keywordsHeader = page
      .locator(".snippetsPanel__panel-header__keywords___3M1-s span")
      .first();
    await expect(keywordsHeader).toHaveText(
      new RegExp(`Keywords:\\s*${sampleQuery}`, "i"),
      { timeout: 10000 },
    );

    const outlineCount = await docs.outlineHighlights.count();
    if (outlineCount > 0) {
      await docs.outlineHighlights
        .nth(outlineCount - 1)
        .scrollIntoViewIfNeeded();
      await page
        .locator(".SectionTree-styles__section-tree___1Y7yk")
        .nth(outlineCount - 1)
        .locator("span")
        .last()
        .click();
    }

    const documentFrame = page.frameLocator("iframe").first();
    const highlights = documentFrame.locator("em");

    const isHighlightVisible = await highlights
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (isHighlightVisible) {
      logToFile(
        `✅ Highlights successfully rendered in iframe for Row ${targetId}`,
      );
    } else {
      logToFile(
        `❌ FAILED: No highlights rendered in iframe for Row ${targetId}`,
      );
      expect
        .soft(false, `No iframe highlights found for Row ${targetId}`)
        .toBeTruthy();
    }

    // ==========================================
    // STEP C: JUMP BACK TO RESULTS GRID TAB
    // ==========================================
    logToFile(`Jumping back to Results Grid (Tab Index: ${gridTabIndex})...`);

    // Locate the exact tab that holds the grid using the index we stored
    const resultsTab = page
      .locator(
        '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
      )
      .nth(gridTabIndex - 1);

    // Click it to switch the view back to the grid
    await resultsTab.click();

    // Wait for the grid container to reappear before the loop restarts
    await gridContainer.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
  }

  logToFile(`\n--- PHASE 3: Random Document Testing Complete ---`);
};

// ============================================================================
// 3. EXPORTED TEST LOGIC (Called by your runner)
// ============================================================================
export const runBooleanKeywordsTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Boolean Keywords Report ---");
  let index = 0;
  // --- PHASE 1: UI VALIDATION ---
  await test.step("PHASE 1: Validate UI Components", async () => {
    logToFile("\n--- PHASE 1: Testing UI Functionality ---");
    const ui = getUIElements(page);

    await ui.keywordInput.fill("Test input");
    await expect(ui.keywordInput).toHaveValue("Test input");
    logToFile("✅ Base Keyword input works.");

    await ui.keywordPlsBtn.click();
    await expect(ui.modal).toBeVisible();
    logToFile("✅ Keyword Plus button opens modal.");

    await ui.modalInnerSearch.focus();
    await page.keyboard.press("Enter");
    await ui.modalInnerSearch.pressSequentially("Modal Test", { delay: 100 });
    await expect(ui.modalInnerSearch).toHaveValue(/Test input.*Modal Test/is);
    await ui.modalOkBtn.click();
    await expect(ui.modal).toBeHidden();
    logToFile("✅ Modal input accepts text and OK button closes modal.");

    await ui.keywordPlsBtn.click();
    await ui.modalClearBtn.click();
    await expect(ui.modalInnerSearch).toBeEmpty();
    await ui.modalOkBtn.click();
    logToFile("✅ Modal Clear button clears input.");

    const expandKeywordsBtn = page.getByRole("button", {
      name: /Expand Keywords/i,
    });

    if (await expandKeywordsBtn.isVisible({ timeout: 15000 })) {
      await expandKeywordsBtn.click();
      await page.waitForTimeout(3000);
      logToFile("Clicked 'Expand Keywords' button.");

      // Locators for the potential outcomes
      const noSuggestionsMsg = page.getByText(
        /It looks like we don't have any suggestions/i,
      );
      const okBtn = page.getByRole("button", { name: /^OK$/i });
      const applyChangesBtn = page.getByRole("button", {
        name: /Accept Changes/i,
      });

      // Check which UI state appears
      try {
        // We wait a moment to see which one pops up
        const isNoSuggestions = await noSuggestionsMsg.isVisible({
          timeout: 5000,
        });

        if (isNoSuggestions) {
          logToFile("ℹ️ Expand Keywords: No suggestions found. Clicking OK.");
          await okBtn.click();
        } else if (await applyChangesBtn.isVisible({ timeout: 2000 })) {
          logToFile(
            "✅ Expand Keywords: Suggestions found. Clicking Apply Changes.",
          );
          await applyChangesBtn.click();
        } else {
          logToFile(
            "⚠️ Expand Keywords: Clicked, but neither 'No suggestions' nor 'Apply changes' appeared.",
          );
        }
      } catch (e) {
        logToFile(
          "⚠️ Error or timeout while waiting for Expand Keywords response.",
        );
      }
    } else {
      logToFile("ℹ️ Expand Keywords button not visible.");
    }
  });

  // --- PHASE 2: GRID RESULTS ---
  await test.step("PHASE 2: Validating Boolean Grid Results", async () => {
    logToFile("\n--- PHASE 2: Testing Grid Data & Boolean Logic ---");
    const search = getSearchElements(page);

    const testCases = [
      {
        id: "TC1_AND",
        query: "cybersecurity AND breach",
        validate: (r: RowData) => {
          const hasBoth =
            /cybersecurity/i.test(r.highlights) && /breach/i.test(r.highlights);
          return hasBoth || r.hasViewAllHits; // Escape hatch for hidden hits
        },
        errorMsg: "Missing AND terms (and no 'View All Hits' link).",
      },
      {
        id: "TC2_OR",
        query: "litigation OR arbitration",
        validate: (r: RowData) => {
          const hasEither =
            /litigation/i.test(r.highlights) ||
            /arbitration/i.test(r.highlights);
          return hasEither || r.hasViewAllHits; // Escape hatch for hidden hits
        },
        errorMsg: "Neither OR term found, and no 'View All Hits' link present.",
      },
      {
        id: "TC3_NOT",
        query: "compensation NOT equity",
        validate: (r: RowData) => {
          if (/equity/i.test(r.fullText)) return false; // STRICT: Instant fail if equity is anywhere
          const hasComp = /compensation/i.test(r.highlights);
          return hasComp || r.hasViewAllHits;
        },
        errorMsg: "Excluded term (equity) found, or primary term missing.",
      },
      {
        id: "TC4_GROUPING",
        query:
          '(("material weakness" W/15 "internal control") AND NOT "SOX 404")',
        validate: (r: RowData) => {
          if (/SOX 404/i.test(r.fullText)) return false; // STRICT: Instant fail
          return (
            /material weakness(?:\W+\w+){0,15}\W+internal control/i.test(
              r.fullText,
            ) ||
            /internal control(?:\W+\w+){0,15}\W+material weakness/i.test(
              r.fullText,
            )
          ); // STRICT: Proximity must pass, no escape hatch
        },
        errorMsg:
          "Grouping failed: SOX 404 present, or strict proximity failed.",
      },
      {
        id: "TC5_PROXIMITY_W",
        query: "revenue W/10 recognition",
        validate: (r: RowData) =>
          /revenue(?:\W+\w+){0,10}\W+recognition/i.test(r.fullText) ||
          /recognition(?:\W+\w+){0,10}\W+revenue/i.test(r.fullText),
        errorMsg: "Words not found within specified proximity in the text.",
      },
      {
        id: "TC6_EXACT",
        query: '"material adverse effect"',
        validate: (r: RowData) => /material adverse effect/i.test(r.fullText),
        errorMsg: "Exact phrase not found as a cohesive unit.",
      },
      {
        id: "TC7_WILDCARD",
        query: "audit*",
        validate: (r: RowData) => /audit\w*/i.test(r.highlights),
        errorMsg: "Wildcard variant not found in highlights.",
      },
      {
        id: "TC8_NUMBER",
        query: "revenue W/3 #",
        validate: (r: RowData) =>
          /revenue(?:\W+\w+){0,3}\W+(?:\$|€|£)?\d+(?:[.,]\d+)?/i.test(
            r.fullText,
          ) ||
          /(?:\$|€|£)?\d+(?:[.,]\d+)?(?:\W+\w+){0,3}\W+revenue/i.test(
            r.fullText,
          ),
        errorMsg: "Term not found within 3 words of a number.",
      },
    ];

    let isDisplayColumnConfigured = false;
    // Wait for filter to apply before searching
    for (const tc of testCases) {
      // Nested test steps keep the HTML report highly organized
      await test.step(`Executing ${tc.id}`, async () => {
        logToFile(`\nExecuting ${tc.id}: ${tc.query}`);

        await search.clearBtn.click();
        getUIElements(page).exhibitsToFilingsLabel.click();
        await page.waitForTimeout(1000);
        await search.keywordInput.fill(tc.query);
        await search.booleanTabBtn.click();
        await search.searchBtn.click();
        const tabText = await getTabText(page, index++, logToFile, false);
        console.log(`Tab Text for ${tc.id}:`, tabText);
        if (
          tabText.includes("No Results Found") ||
          tabText.includes("Invalid Query")
        ) {
          logToFile(`⚠️ ${tc.id} : ${tc.query} returned -> ${tabText.trim()}`);
          expect
            .soft(false, `${tc.id} failed with message: ${tabText.trim()}`)
            .toBeTruthy();
          // return;
        }
        let failedRows: {
          accessionNo: string;
          text: string;
          highlights: string;
        }[] = [];
        if (!isDisplayColumnConfigured) {
          await configureDisplayColumns(page, {
            "Filing Info": ["Accession #"],
            "Company Info": [],
          });
          isDisplayColumnConfigured = true;
        }
        const extractedRows = await scrapeVirtualizedGrid(page, 20);
        extractedRows.forEach((row, index) => {
          const isRowValid = tc.validate(row);
          if (!isRowValid) {
            failedRows.push({
              accessionNo: row.accessionNo || "N/A",
              text: row.fullText,
              highlights: row.highlights,
            });
          }
        });

        // 4. Evaluate overall success
        const isValid = extractedRows.length > 0 && failedRows.length === 0;

        logToFile(`Rows Analyzed: ${extractedRows.length}`);
        if (isValid) {
          logToFile(`Validation Status: VALID ✅`);
        } else {
          logToFile(`Validation Status: INVALID ❌ (${tc.errorMsg})`);

          // Log exactly which rows broke the regex
          logToFile(`\n--- FAILED ROWS DETAIL ---`);
          failedRows.forEach((fail) => {
            logToFile(`Row ${fail.accessionNo} FAILED:`);
            logToFile(`Extracted Highlights: ${fail.highlights || "None"}`);
            logToFile(`Full Text: ${fail.text}\n`);
          });
          logToFile(`--------------------------\n`);

          // Fail the Playwright step but keep the loop running
          expect
            .soft(
              false,
              `${tc.id} failed on ${failedRows.length} rows. Check logs for detail.`,
            )
            .toBeTruthy();
          // return; // Exit this specific step early so we move to the next test case
        }

        //  await page.pause();
      });
    }
    await closeAllOpenTabs(page);
  });

  // --- PHASE 3: DOCUMENT HIGHLIGHTING ---
  // await test.step("PHASE 3: Document View Highlighting", async () => {
  //   logToFile("\n--- PHASE 3: Testing Document Level Highlighting ---");
  //   const search = getSearchElements(page);
  //   const sampleQuery = "cybersecurity AND breach";

  //   await search.clearBtn.click();
  //   getUIElements(page).exhibitsToFilingsLabel.click();
  //   await page.waitForTimeout(1000);
  //   await search.keywordInput.fill(sampleQuery);
  //   await search.searchBtn.click();
  //   const tabText = await getTabText(page, 0, logToFile, false);
  //   console.log(`Tab Text for ${sampleQuery}:`, tabText);
  //   if (
  //     tabText.includes("No Results Found") ||
  //     tabText.includes("Invalid Query")
  //   ) {
  //     logToFile(`${sampleQuery} returned -> ${tabText.trim()}`);
  //     expect
  //       .soft(false, `${sampleQuery} failed with message: ${tabText.trim()}`)
  //       .toBeTruthy();
  //     return;
  //   }

  //   const docsCount = parseCount(tabText);
  //   const availableDocsForTesting = Math.min(docsCount, 20);
  //   const currentTabIndex = index;
  //   console.log(`currentTabIndex for ${sampleQuery}:`, currentTabIndex);
  //   await validateRandomDocuments(
  //     page,
  //     sampleQuery,
  //     logToFile,
  //     availableDocsForTesting,
  //     5,
  //     0,
  //   );
  //   await page.pause();
  // });

  logToFile("\n--- End of Report ---");
};
