// import { expect, Page } from "@playwright/test";
// import * as fs from "fs";
// import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
// import {
//   closeAllOpenTabs,
//   fillAndEnter,
//   getTabText,
//   parseCount,
// } from "../utils/helpers";

// const IDENTIFIER = "aa_indexingAndDocView";
// const RESULT_GRID_VERIFICATION_LIMIT = 20;

// const parseOrKeywordTerms = (keywordQuery: string): string[] =>
//   keywordQuery
//     .split(/\s+OR\s+/i)
//     .map((term) => term.trim())
//     .filter(Boolean);

// const hasKeywordHighlight = (
//   highlights: string,
//   hasViewAllHits: boolean,
//   orTerms: string[],
// ): boolean => {
//   return orTerms.some((term) => {
//     const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//     return new RegExp(`\\b${escaped}\\b`, "i").test(highlights);
//   });
// };

// const switchToResultsGridTab = async (page: Page, tabIndex: number) => {
//   const resultsTab = page
//     .locator(
//       '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "No Results Found")]',
//     )
//     .nth(tabIndex);

//   if (await resultsTab.isVisible()) {
//     await resultsTab.click();
//   }

//   await page
//     .locator(".ReactVirtualized__Grid")
//     .last()
//     .waitFor({ state: "visible", timeout: 15000 });
//   await page.waitForTimeout(500);
// };

// const verifyDocViewResultsTab = async (
//   page: Page,
//   logToFile: Function,
// ) => {

//   const resultsTab = page.locator("#results").first();
//   await expect(resultsTab).toBeVisible({ timeout: 10000 });

//   await expect(resultsTab).not.toHaveClass(/disabled/);
//   await resultsTab.click();

//   await page
//     .locator(".snippetsPanel__panel-tree___2OvKF")
//     .locator(".SectionTree-styles__section-tree___1Y7yk").first()
//     .waitFor({ state: "visible", timeout: 15000 });
//   const resultTabSectionCount = await page
//     .locator(".snippetsPanel__panel-tree___2OvKF")
//     .locator(".SectionTree-styles__section-tree___1Y7yk")
//     .count();

//   if (resultTabSectionCount < 1) {
//     console.log("no section found");
//   }

//   const outlineHighlights = page
//     .locator(".snippetsPanel__panel-tree___2OvKF")
//     .locator(".SectionTree-styles__section-tree___1Y7yk")
//     .first()
//     .locator("em");

//   await expect(async () => {
//     const count = await outlineHighlights.count();
//     expect(count).toBeGreaterThan(0);
//   }).toPass({ timeout: 10000 });

//   const documentFrame = page.frameLocator("iframe").first();
//   const iframeHighlight = documentFrame.locator("em").last();

//   await expect(iframeHighlight).toBeVisible({ timeout: 15000 });

//   logToFile("✅ Results tab enabled with highlights in panel and document");
// };

// const verifyKeywordGridAndDocView = async (
//   page: Page,
//   keyword: string,
//   keywordTabIndex: number,
//   targetCount: number,
//   logToFile: Function,
// ) => {
//   if (targetCount <= 0) {
//     return {
//       text: "Skipped grid/doc verification (no results to verify).",
//       isValid: true,
//     };
//   }

//   await switchToResultsGridTab(page, keywordTabIndex);

//   const orTerms = parseOrKeywordTerms(keyword);
//   let resultsFound = 0;
//   const processedIds = new Set<string>();
//   const rowsData: string[] = [];
//   let isScenarioValid = true;

//   const scroller = page.locator(".ReactVirtualized__Grid").last();
//   const MAX_STAGNANT_SCROLLS = 8;
//   let stagnantScrolls = 0;

//   while (resultsFound < targetCount) {
//     const rows = scroller.locator('div[data-test="resultRow"]');
//     const visibleRowCount = await rows.count();

//     if (visibleRowCount === 0) {
//       stagnantScrolls++;
//       if (stagnantScrolls > MAX_STAGNANT_SCROLLS) {
//         logToFile(
//           `⚠️ Stopping: grid returned 0 rows after ${MAX_STAGNANT_SCROLLS} attempts. ` +
//             `Found ${resultsFound}/${targetCount}.`,
//         );
//         break;
//       }
//       await page.waitForTimeout(1000);
//       continue;
//     }

//     const unprocessedIndices: number[] = [];
//     for (let i = 0; i < visibleRowCount; i++) {
//       const rowId = await rows.nth(i).getAttribute("id");
//       if (rowId && !processedIds.has(rowId)) {
//         unprocessedIndices.push(i);
//       }
//     }

//     const resultsBefore = resultsFound;

//     for (const i of unprocessedIndices) {
     
//       const freshRows = scroller.locator('div[data-test="resultRow"]');
//       const currentCount = await freshRows.count();
//       if (i >= currentCount) continue; 

//       const row = freshRows.nth(i);
//       const rowId = await row.getAttribute("id");

//       if (!rowId || processedIds.has(rowId)) continue;

//       let rowLabel = `Row ${rowId}`;
//       try {
//         const texts = await row.locator("span").allInnerTexts();
//         const cleanContent = texts.map((t) => t.trim()).filter(Boolean);
//         const intelligizeIdIndex = cleanContent.findIndex((text) =>
//           /^\d{8}$/.test(text),
//         );
//         if (intelligizeIdIndex !== -1) {
//           rowLabel = `Intelligize ID: ${cleanContent[intelligizeIdIndex]}`;
//         }

//         const emTextsArray = await row.locator("p em").allInnerTexts();
//         const highlights = emTextsArray.join(" ").replace(/\n/g, " ").trim();
//         const hasViewAllHits =
//           (await row.getByText(/View All Hits|View More/i).count()) > 0;

//         const gridHighlightOk = hasKeywordHighlight(
//           highlights,
//           hasViewAllHits,
//           orTerms,
//         );

//         if (!gridHighlightOk) {
//           isScenarioValid = false;
//           rowsData.push(
//             `❌ ${rowLabel} -> Result Grid -> missing keyword highlight (found: "${highlights || "none"}")`,
//           );
//           processedIds.add(rowId);
//           resultsFound++;
//           continue;
//         }

//         const viewBtn = row.getByRole("button", { name: /View/i }).last();
//         await expect(viewBtn).toBeVisible({ timeout: 5000 });
//         await viewBtn.click();

//         await verifyDocViewResultsTab(page, logToFile);
//         rowsData.push(`✅ ${rowLabel} -> Grid highlight OK | Doc Results tab OK`);

//         await page.keyboard.press("Escape");
//         await page.waitForTimeout(500);
//       } catch (e: any) {
//         const customMsg = e.message.split("\n")[0];
//         isScenarioValid = false;
//         rowsData.push(`❌ ${rowLabel} -> ${customMsg}`);
//       } finally {
//         processedIds.add(rowId);
//         resultsFound++;
//         await switchToResultsGridTab(page, keywordTabIndex);
//       }

//       if (resultsFound >= targetCount) break;
//     }

//     // Scroll exactly once per while-iteration, only AFTER the current
//     // viewport's unprocessed rows are fully drained — never mid-batch.
//     if (resultsFound < targetCount) {
//       if (resultsFound === resultsBefore) {
//         stagnantScrolls++;
//         if (stagnantScrolls > MAX_STAGNANT_SCROLLS) {
//           logToFile(
//             `⚠️ Stopping: no new rows after ${MAX_STAGNANT_SCROLLS} scroll attempts. ` +
//               `Found ${resultsFound}/${targetCount} — grid likely exhausted or targetCount miscounted from parseCount().`,
//           );
//           break;
//         }
//       } else {
//         stagnantScrolls = 0; // real progress was made, reset the guard
//       }

//       const currentRows = scroller.locator('div[data-test="resultRow"]');
//       const lastRowCount = await currentRows.count();
//       if (lastRowCount > 0) {
//         await currentRows
//           .last()
//           .evaluate((el) => el.scrollIntoView({ block: "start" }));
//       }
//       await page.waitForTimeout(800);
//     }
//   }

//   logToFile(
//     isScenarioValid
//       ? "✅ Grid & Doc View verification: Valid"
//       : "❌ Grid & Doc View verification: Invalid",
//   );

//   return { text: rowsData.join("\n"), isValid: isScenarioValid };
// };

// export const runAAIndexingAndDocViewTest = async (
//   page: Page,
//   logToFile: Function,
// ) => {
//   logToFile("--- Starting AA-indexingAndDocView Report ---");

//   const dateInput = page.locator(
//     '//label[text()="Date"]/ancestor::div[5]//input',
//   );
//   const keywordsInput = page.locator(
//     '//label[text()="Keywords"]/following::textarea[1]',
//   );
//   const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
//   const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

//   const testCases = [
//     {
//       date: "Last 7 Days",
//       keyword: "is OR the OR a",
//       NotKeyword: "NOT (is OR the OR a)",
//     },
//   ];

//   let tabIndex = 0;
//   let resultsSummary: string[] = [];

//   for (const scenario of testCases) {
//     await clearBtn.click();
//     await page.waitForTimeout(500);
//     let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
//     await exhibitsCheckbox.uncheck({ force: true });
//     await page.waitForTimeout(300);

//     logToFile(`\nTesting Scenario: ${scenario.date}`);

//     await fillAndEnter(page, dateInput, scenario.date);
//     await searchBtn.click();
//     const textDateOnly = await getTabText(page, tabIndex++, logToFile, false);
//     logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

//     await fillAndEnter(page, keywordsInput, scenario.keyword);
//     const keywordTabIndex = tabIndex;
//     let textWithKeyword = await getTabText(page, tabIndex++, logToFile, false);
//     logToFile(`With Keyword: ${textWithKeyword}`);

//     const textDateOnlyCount = parseCount(textDateOnly);
//     let textWithKeywordCount = parseCount(textWithKeyword);

//     console.log("AA Baseline Count ->", textDateOnlyCount);
//     console.log("AA Keyword Count ->", textWithKeywordCount);

//     let isValid = textDateOnlyCount === textWithKeywordCount;
//     let notKeywordPart = "";

//     if (!isValid) {
//       logToFile(
//         "⚠️ Mismatch detected. Firing AA NOT keyword fallback verification...",
//       );

//       await clearBtn.click();
//       await page.waitForTimeout(1000);

//       await fillAndEnter(page, dateInput, scenario.date);
//       await fillAndEnter(page, keywordsInput, scenario.NotKeyword);
//       await searchBtn.click();

//       const textWithNotKeyword = await getTabText(
//         page,
//         tabIndex++,
//         logToFile,
//         false,
//       );
//       logToFile(`With Not Keyword: ${textWithNotKeyword}`);

//       const sum = textWithKeywordCount + parseCount(textWithNotKeyword);
//       console.log("AA Validation Sum ->", sum);

//       isValid = sum === textDateOnlyCount;
//       notKeywordPart = `Data: ${scenario.date} + NotKeyword: ${scenario.NotKeyword}\nDoc Found: ${parseCount(textWithNotKeyword)}\n`;
//     }

//     logToFile(
//       isValid ? "✅ Result: Valid" : "❌ Result: Invalid - Counts mismatch",
//     );

//     let gridDocVerificationPart = "";
//     const hasSearchResults =
//       textWithKeyword.includes("Docs:") || textWithKeyword.includes("Results:");

//     if (hasSearchResults) {
//       logToFile(
//         "\n--- Starting Grid Highlight & Doc View Verification (keyword search) ---",
//       );
//       const verificationTarget = Math.min(
//         textWithKeywordCount,
//         RESULT_GRID_VERIFICATION_LIMIT,
//       );
//       const gridDocFindings = await verifyKeywordGridAndDocView(
//         page,
//         scenario.keyword,
//         keywordTabIndex,
//         verificationTarget,
//         logToFile,
//       );

//       gridDocVerificationPart = [
//         ``,
//         `Grid & Doc View Verification (${verificationTarget} rows):`,
//         gridDocFindings?.text ?? "",
//         ``,
//         `Grid/Doc Status: ${gridDocFindings?.isValid ? "Valid ✅" : "Invalid ❌"}`,
//       ].join("\n");
//     } else {
//       logToFile(
//         "ℹ️ Skipping grid/doc verification — no keyword search results found.",
//       );
//     }

//     const scenarioFinding = [
//       `Date: ${scenario.date}`,
//       `Doc Found: ${textDateOnlyCount}`,
//       ``,
//       `Data: ${scenario.date} + Keyword: ${scenario.keyword}`,
//       `Doc Found: ${textWithKeywordCount}`,
//       ``,
//       notKeywordPart.trim(),
//       ``,
//       `Indexing Result: ${isValid ? "Valid ✅" : "Invalid ❌"}`,
//       gridDocVerificationPart,
//     ]
//       .filter((line) => line !== "")
//       .join("\n");

//     resultsSummary.push(scenarioFinding);
//   }

//   const finalDumpString = resultsSummary.join(
//     "\n--------------------------------------------------------------------------------\n",
//   );

//   try {
//     await updateGoogleSheet(finalDumpString, IDENTIFIER);
//     logToFile("\nSuccessfully dumped detailed findings to Google Sheets.");
//   } catch (err: any) {
//     logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
//   }

//   logToFile("\n--- End of Report ---");
//   await closeAllOpenTabs(page);
// };



import { expect, Page } from "@playwright/test";
import * as fs from "fs";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  fillAndEnter,
  getTabText,
  parseCount,
} from "../utils/helpers";

const IDENTIFIER = "aa_indexingAndDocView";
const RESULT_GRID_VERIFICATION_LIMIT = 20;

const parseOrKeywordTerms = (keywordQuery: string): string[] =>
  keywordQuery
    .split(/\s+OR\s+/i)
    .map((term) => term.trim())
    .filter(Boolean);

const hasKeywordHighlight = (
  highlights: string,
  hasViewAllHits: boolean,
  orTerms: string[],
): boolean => {
  return orTerms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(highlights);
  });
};

const switchToResultsGridTab = async (page: Page, tabIndex: number) => {
  const resultsTab = page
    .locator(
      '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "No Results Found")]',
    )
    .nth(tabIndex);

  if (await resultsTab.isVisible()) {
    await resultsTab.click();
  }

  await page
    .locator(".ReactVirtualized__Grid")
    .last()
    .waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(500);
};

const verifyDocViewResultsTab = async (
  page: Page,
  logToFile: Function,
) => {

  const resultsTab = page.locator("#results").first();
  await expect(resultsTab).toBeVisible({ timeout: 10000 });

  // The Results tab is briefly rendered with a "disabled" class right after
  // clicking "View", while the app finishes fetching/highlighting snippets
  // for that document. This is a real, short-lived race, not a permanent
  // failure, so give it a bounded retry window (15s) instead of letting it
  // inherit the repo-wide expect.timeout default (3,000,000ms / 50 minutes),
  // which silently turns this exact race into a multi-minute hang per row.
  await expect(resultsTab).not.toHaveClass(/disabled/, { timeout: 15000 });
  await resultsTab.click();

  await page
    .locator(".snippetsPanel__panel-tree___2OvKF")
    .locator(".SectionTree-styles__section-tree___1Y7yk").first()
    .waitFor({ state: "visible", timeout: 15000 });
  const resultTabSectionCount = await page
    .locator(".snippetsPanel__panel-tree___2OvKF")
    .locator(".SectionTree-styles__section-tree___1Y7yk")
    .count();

  if (resultTabSectionCount < 1) {
    console.log("no section found");
  }

  const outlineHighlights = page
    .locator(".snippetsPanel__panel-tree___2OvKF")
    .locator(".SectionTree-styles__section-tree___1Y7yk")
    .first()
    .locator("em");

  await expect(async () => {
    const count = await outlineHighlights.count();
    expect(count).toBeGreaterThan(0);
  }).toPass({ timeout: 10000 });

  const documentFrame = page.frameLocator("iframe").first();
  const iframeHighlight = documentFrame.locator("em").last();

  await expect(iframeHighlight).toBeVisible({ timeout: 15000 });

  logToFile("✅ Results tab enabled with highlights in panel and document");
};

const verifyKeywordGridAndDocView = async (
  page: Page,
  keyword: string,
  keywordTabIndex: number,
  targetCount: number,
  logToFile: Function,
) => {
  if (targetCount <= 0) {
    return {
      text: "Skipped grid/doc verification (no results to verify).",
      isValid: true,
    };
  }

  await switchToResultsGridTab(page, keywordTabIndex);

  const orTerms = parseOrKeywordTerms(keyword);
  let resultsFound = 0;
  const processedIds = new Set<string>();
  const rowsData: string[] = [];
  let isScenarioValid = true;

  const scroller = page.locator(".ReactVirtualized__Grid").last();
  const MAX_STAGNANT_SCROLLS = 8;
  let stagnantScrolls = 0;

  while (resultsFound < targetCount) {
    const rows = scroller.locator('div[data-test="resultRow"]');
    const visibleRowCount = await rows.count();

    if (visibleRowCount === 0) {
      stagnantScrolls++;
      if (stagnantScrolls > MAX_STAGNANT_SCROLLS) {
        logToFile(
          `⚠️ Stopping: grid returned 0 rows after ${MAX_STAGNANT_SCROLLS} attempts. ` +
            `Found ${resultsFound}/${targetCount}.`,
        );
        break;
      }
      await page.waitForTimeout(1000);
      continue;
    }

    const unprocessedIndices: number[] = [];
    for (let i = 0; i < visibleRowCount; i++) {
      const rowId = await rows.nth(i).getAttribute("id");
      if (rowId && !processedIds.has(rowId)) {
        unprocessedIndices.push(i);
      }
    }

    const resultsBefore = resultsFound;

    for (const i of unprocessedIndices) {
     
      const freshRows = scroller.locator('div[data-test="resultRow"]');
      const currentCount = await freshRows.count();
      if (i >= currentCount) continue; 

      const row = freshRows.nth(i);
      const rowId = await row.getAttribute("id");

      if (!rowId || processedIds.has(rowId)) continue;

      let rowLabel = `Row ${rowId}`;
      try {
        const texts = await row.locator("span").allInnerTexts();
        const cleanContent = texts.map((t) => t.trim()).filter(Boolean);
        const intelligizeIdIndex = cleanContent.findIndex((text) =>
          /^\d{8}$/.test(text),
        );
        if (intelligizeIdIndex !== -1) {
          rowLabel = `Intelligize ID: ${cleanContent[intelligizeIdIndex]}`;
        }

        const emTextsArray = await row.locator("p em").allInnerTexts();
        const highlights = emTextsArray.join(" ").replace(/\n/g, " ").trim();
        const hasViewAllHits =
          (await row.getByText(/View All Hits|View More/i).count()) > 0;

        const gridHighlightOk = hasKeywordHighlight(
          highlights,
          hasViewAllHits,
          orTerms,
        );

        if (!gridHighlightOk) {
          isScenarioValid = false;
          rowsData.push(
            `❌ ${rowLabel} -> Result Grid -> missing keyword highlight (found: "${highlights || "none"}")`,
          );
          processedIds.add(rowId);
          resultsFound++;
          continue;
        }

        const viewBtn = row.getByRole("button", { name: /View/i }).last();
        await expect(viewBtn).toBeVisible({ timeout: 5000 });
        await viewBtn.click();

        await verifyDocViewResultsTab(page, logToFile);
        // Only failed rows go into the Google Sheet report — passing rows
        // are still fully verified above, just not logged to the sheet.

        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      } catch (e: any) {
        const customMsg = e.message.split("\n")[0];
        isScenarioValid = false;
        rowsData.push(`❌ ${rowLabel} -> ${customMsg}`);
      } finally {
        processedIds.add(rowId);
        resultsFound++;
        await switchToResultsGridTab(page, keywordTabIndex);
      }

      if (resultsFound >= targetCount) break;
    }

    // Scroll exactly once per while-iteration, only AFTER the current
    // viewport's unprocessed rows are fully drained — never mid-batch.
    if (resultsFound < targetCount) {
      if (resultsFound === resultsBefore) {
        stagnantScrolls++;
        if (stagnantScrolls > MAX_STAGNANT_SCROLLS) {
          logToFile(
            `⚠️ Stopping: no new rows after ${MAX_STAGNANT_SCROLLS} scroll attempts. ` +
              `Found ${resultsFound}/${targetCount} — grid likely exhausted or targetCount miscounted from parseCount().`,
          );
          break;
        }
      } else {
        stagnantScrolls = 0; // real progress was made, reset the guard
      }

      const currentRows = scroller.locator('div[data-test="resultRow"]');
      const lastRowCount = await currentRows.count();
      if (lastRowCount > 0) {
        await currentRows
          .last()
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
      }
      await page.waitForTimeout(800);
    }
  }

  logToFile(
    isScenarioValid
      ? "✅ Grid & Doc View verification: Valid"
      : "❌ Grid & Doc View verification: Invalid",
  );

  return {
    text: rowsData.length > 0 ? rowsData.join("\n") : "✅ All rows passed.",
    isValid: isScenarioValid,
  };
};

export const runAAIndexingAndDocViewTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting AA-indexingAndDocView Report ---");

  const dateInput = page.locator(
    '//label[text()="Date"]/ancestor::div[5]//input',
  );
  const keywordsInput = page.locator(
    '//label[text()="Keywords"]/following::textarea[1]',
  );
  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

  const testCases = [
    {
      date: "Last 7 Days",
      keyword: "is OR the OR a",
      NotKeyword: "NOT (is OR the OR a)",
    },
  ];

  let tabIndex = 0;
  let resultsSummary: string[] = [];

  for (const scenario of testCases) {
    await clearBtn.click();
    await page.waitForTimeout(500);
    let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
    await exhibitsCheckbox.uncheck({ force: true });
    await page.waitForTimeout(300);

    logToFile(`\nTesting Scenario: ${scenario.date}`);

    await fillAndEnter(page, dateInput, scenario.date);
    await searchBtn.click();
    const textDateOnly = await getTabText(page, tabIndex++, logToFile, false);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    await fillAndEnter(page, keywordsInput, scenario.keyword);
    const keywordTabIndex = tabIndex;
    let textWithKeyword = await getTabText(page, tabIndex++, logToFile, false);
    logToFile(`With Keyword: ${textWithKeyword}`);

    const textDateOnlyCount = parseCount(textDateOnly);
    let textWithKeywordCount = parseCount(textWithKeyword);

    console.log("AA Baseline Count ->", textDateOnlyCount);
    console.log("AA Keyword Count ->", textWithKeywordCount);

    let isValid = textDateOnlyCount === textWithKeywordCount;
    let notKeywordPart = "";

    if (!isValid) {
      logToFile(
        "⚠️ Mismatch detected. Firing AA NOT keyword fallback verification...",
      );

      await clearBtn.click();
      await page.waitForTimeout(1000);

      await fillAndEnter(page, dateInput, scenario.date);
      await fillAndEnter(page, keywordsInput, scenario.NotKeyword);
      await searchBtn.click();

      const textWithNotKeyword = await getTabText(
        page,
        tabIndex++,
        logToFile,
        false,
      );
      logToFile(`With Not Keyword: ${textWithNotKeyword}`);

      const sum = textWithKeywordCount + parseCount(textWithNotKeyword);
      console.log("AA Validation Sum ->", sum);

      isValid = sum === textDateOnlyCount;
      notKeywordPart = `Data: ${scenario.date} + NotKeyword: ${scenario.NotKeyword}\nDoc Found: ${parseCount(textWithNotKeyword)}\n`;
    }

    logToFile(
      isValid ? "✅ Result: Valid" : "❌ Result: Invalid - Counts mismatch",
    );

    let gridDocVerificationPart = "";
    let gridDocFindings: { text: string; isValid: boolean } | undefined;
    const hasSearchResults =
      textWithKeyword.includes("Docs:") || textWithKeyword.includes("Results:");

    if (hasSearchResults) {
      logToFile(
        "\n--- Starting Grid Highlight & Doc View Verification (keyword search) ---",
      );
      const verificationTarget = Math.min(
        textWithKeywordCount,
        RESULT_GRID_VERIFICATION_LIMIT,
      );
      gridDocFindings = await verifyKeywordGridAndDocView(
        page,
        scenario.keyword,
        keywordTabIndex,
        verificationTarget,
        logToFile,
      );

      gridDocVerificationPart = [
        ``,
        `Grid & Doc View Verification (${verificationTarget} rows):`,
        gridDocFindings?.text ?? "",
        ``,
        `Grid/Doc Status: ${gridDocFindings?.isValid ? "Valid ✅" : "Invalid ❌"}`,
      ].join("\n");
    } else {
      logToFile(
        "ℹ️ Skipping grid/doc verification — no keyword search results found.",
      );
    }

    const scenarioFinding = [
      `Date: ${scenario.date}`,
      `Doc Found: ${textDateOnlyCount}`,
      ``,
      `Data: ${scenario.date} + Keyword: ${scenario.keyword}`,
      `Doc Found: ${textWithKeywordCount}`,
      ``,
      notKeywordPart.trim(),
      ``,
      `Indexing Result: ${isValid ? "Valid ✅" : "Invalid ❌"}`,
      gridDocVerificationPart,
    ]
      .filter((line) => line !== "")
      .join("\n");

    const scenarioOverallValid =
      isValid && (gridDocFindings ? gridDocFindings.isValid : true);

    if (!scenarioOverallValid) {
      resultsSummary.push(scenarioFinding);
    }
  }

  const finalDumpString =
    resultsSummary.length > 0
      ? resultsSummary.join(
          "\n--------------------------------------------------------------------------------\n",
        )
      : "Status: Valid\nAll scenarios passed — no failures to report.";

  try {
    await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped detailed findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }

  logToFile("\n--- End of Report ---");
  await closeAllOpenTabs(page);
};