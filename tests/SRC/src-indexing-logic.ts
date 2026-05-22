import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  fillAndEnter,
  getTabText,
  parseCount,
  closeAllOpenTabs,
} from "../utils/helpers";

const IDENTIFIER = "src_indexing";

export const runSRCIndexingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SRC-Indexing Report ---");

  const dateInput = page
    .locator(".styles__focusContainer___13rFy")
    .filter({ has: page.locator("label", { hasText: /^Date$/ }) })
    .locator("input");
  const keywordsInput = page
    .locator("[data-notice=primaryKeywords]")
    .locator("textarea");
  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

  logToFile("Exhibits to Filings: Checked");

  const testCases = [
    {
      date: "Yesterday",
      keyword: "is OR the OR a",
      NotKeyword: "NOT (is OR the OR a)",
    },
  ];

  let tabIndex = 0;
  let resultsSummary: string[] = [];

  for (const scenario of testCases) {
    await clearBtn.click({ force: true });
    await page.waitForTimeout(30);

    logToFile(`\nTesting Scenario: ${scenario.date}`);

    await fillAndEnter(page, dateInput, scenario.date);
    await searchBtn.click();
    const textDateOnly = await getTabText(page, tabIndex++, logToFile, true);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    await fillAndEnter(page, keywordsInput, scenario.keyword);

    let textWithKeyword = await getTabText(page, tabIndex++, logToFile, false);
    logToFile(`With Keyword: ${textWithKeyword}`);

    const textDateOnlyCount = parseCount(textDateOnly);
    console.log("textDateOnlyCount", textDateOnlyCount);
    let textWithKeywordCount = parseCount(textWithKeyword);
    console.log("textWithKeywordCount", textWithKeywordCount);
    let isValid = textDateOnlyCount === textWithKeywordCount;
    let notKeywordPart = "";

    if (!isValid) {
      await clearBtn.click();
      await fillAndEnter(page, dateInput, scenario.date);
      await fillAndEnter(page, keywordsInput, scenario.NotKeyword);

      const textWithNotKeyword = await getTabText(
        page,
        tabIndex++,
        logToFile,
        false,
      );
      logToFile(`With Not Keyword: ${textWithNotKeyword}`);
      const sum = textWithKeywordCount + parseCount(textWithNotKeyword);
      console.log("sum", sum);
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
