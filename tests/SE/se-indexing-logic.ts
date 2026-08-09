import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  fillAndEnter,
  getTabText,
  parseCount,
  closeAllOpenTabs,
  getTargetDateString,
} from "../utils/helpers";
import { SePage } from "../pages/SePage";

const IDENTIFIER = "se_indexing";

export const runSEIndexingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SE-Indexing Report ---");

  const se = new SePage(page);

  const testCases = [
    // {
    //   date: "Today",
    //   keyword: "is OR the OR a",
    //   NotKeyword: "NOT (is OR the OR a)",
    // },
    {
      date:getTargetDateString(),
      keyword: "is OR the OR a",
      NotKeyword: "NOT (is OR the OR a)",
    },
    // {
    //   date: "Last 7 Days",
    //   keyword: "is OR the OR a",
    //   NotKeyword: "NOT (is OR the OR a)",
    // },
  ];

  let tabIndex = 0;
  let resultsSummary: string[] = [];

  for (const scenario of testCases) {
    await se.clearFilters();
    await page.waitForTimeout(2000);

    logToFile(`\nTesting Scenario: ${scenario.date}`);

    await fillAndEnter(page, se.dateInput, scenario.date);
    await se.search();
    const textDateOnly = await getTabText(page, tabIndex++, logToFile, false);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    await fillAndEnter(page, se.keywordsInput, scenario.keyword);
    // await se.search();
    let textWithKeyword = await getTabText(page, tabIndex++, logToFile, false);
    logToFile(`With Keyword: ${textWithKeyword}`);

    const textDateOnlyCount = parseCount(textDateOnly);
    let textWithKeywordCount = parseCount(textWithKeyword);

    console.log("SE Baseline Count ->", textDateOnlyCount);
    console.log("SE Keyword Count ->", textWithKeywordCount);

    let isValid = textDateOnlyCount === textWithKeywordCount;
    let notKeywordPart = "";

    if (!isValid) {
      logToFile(
        "⚠️ Mismatch detected. Firing SE NOT keyword fallback verification...",
      );

      await se.clearFilters();
      await page.waitForTimeout(1000);

      await fillAndEnter(page, se.dateInput, scenario.date);
      await fillAndEnter(page, se.keywordsInput, scenario.NotKeyword);
      // await se.search();

      const textWithNotKeyword = await getTabText(
        page,
        tabIndex++,
        logToFile,
        false,
      );
      logToFile(`With Not Keyword: ${textWithNotKeyword}`);

      const sum = textWithKeywordCount + parseCount(textWithNotKeyword);
      console.log("SE Validation Sum ->", sum);

      isValid = sum === textDateOnlyCount;
      notKeywordPart = `Data: ${scenario.date} + NotKeyword: ${scenario.NotKeyword}\nDoc Found: ${parseCount(textWithNotKeyword)}\n`;
    }

    logToFile(
      isValid ? "✅ Result: Valid" : "❌ Result: Invalid - Counts mismatch",
    );

    const scenarioFinding = [
      `Date: ${scenario.date}`,
      `Doc Found: ${textDateOnlyCount}`,
      ``,
      `Data: ${scenario.date} + Keyword: ${scenario.keyword}`,
      `Doc Found: ${textWithKeywordCount}`,
      ``,
      notKeywordPart.trim(),
      ``,
      `Result: ${isValid ? "Valid ✅" : "Invalid ❌"}`,
    ]
      .filter((line) => line !== "")
      .join("\n");

    resultsSummary.push(scenarioFinding);
  }

  const finalDumpString = resultsSummary.join(
    "\n--------------------------------------------------------------------------------\n",
  );

  try {
    await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped detailed findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }

  logToFile("\n--- End of Report ---");
  await closeAllOpenTabs(page);
};
