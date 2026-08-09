import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  fillAndEnter,
  getTabText,
  parseCount,
  closeAllOpenTabs,
  getTargetDateString,
} from "../utils/helpers";

const IDENTIFIER = "ro_indexing";

export const runRoIndexingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting RO-Indexing Report ---");

  const dateInput = page.locator(
    '//label[text()="Date"]/ancestor::div[5]//input',
  );
  const keywordsInput = page.locator(
    '//label[text()="Keywords"]/following::textarea[1]',
  );
  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

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
    await clearBtn.click();
    await page.waitForTimeout(2000);

    logToFile(`\nTesting Scenario: ${scenario.date}`);

    await fillAndEnter(page, dateInput, scenario.date);
    await searchBtn.click();
    const textDateOnly = await getTabText(page, tabIndex++, logToFile, false);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    await fillAndEnter(page, keywordsInput, scenario.keyword);
    let textWithKeyword = await getTabText(page, tabIndex++, logToFile, false);
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

      await clearBtn.click();
      await page.waitForTimeout(1000);

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
  await closeAllOpenTabs(page);
};
