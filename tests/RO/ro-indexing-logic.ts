import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
  getTargetDateString,
} from "../utils/helpers";
import { RoPage } from "../pages/RoPage";

const IDENTIFIER = "ro_indexing";

export const runRoIndexingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting RO-Indexing Report ---");

  const ro = new RoPage(page);

  const testCases = [
    // {
    //   date: "Today",
    //   keyword: "is OR the OR a",
    //   NotKeyword: "NOT (is OR the OR a)",
    // },
    {
      date: getTargetDateString(),
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
    await ro.clearFilters();
    await page.waitForTimeout(2000);

    logToFile(`\nTesting Scenario: ${scenario.date}`);

    await ro.fillAndEnter(ro.dateInput, scenario.date);
    await ro.searchBtn.click();
    const textDateOnly = await ro.getTabText(tabIndex++, logToFile, false);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    await ro.fillAndEnter(ro.keywordsInput, scenario.keyword);
    let textWithKeyword = await ro.getTabText(tabIndex++, logToFile, false);
    logToFile(`With Keyword: ${textWithKeyword}`);

    const textDateOnlyCount = parseCount(textDateOnly);
    let textWithKeywordCount = parseCount(textWithKeyword);

    console.log("RO Baseline Count ->", textDateOnlyCount);
    console.log("RO Keyword Count ->", textWithKeywordCount);

    let isValid = textDateOnlyCount === textWithKeywordCount;
    let notKeywordPart = "";

    if (!isValid) {
      logToFile(
        "⚠️ Mismatch detected. Firing RO NOT keyword fallback verification...",
      );

      await ro.clearFilters();
      await page.waitForTimeout(1000);

      await ro.fillAndEnter(ro.dateInput, scenario.date);
      await ro.fillAndEnter(ro.keywordsInput, scenario.NotKeyword);

      const textWithNotKeyword = await ro.getTabText(
        tabIndex++,
        logToFile,
        false,
      );
      logToFile(`With Not Keyword: ${textWithNotKeyword}`);

      const sum = textWithKeywordCount + parseCount(textWithNotKeyword);
      console.log("RO Validation Sum ->", sum);

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
  await ro.closeAllOpenTabs();
};
