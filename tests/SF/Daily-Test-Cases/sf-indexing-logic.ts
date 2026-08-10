import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
  getTargetDateString,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_indexing";

export const runIndexingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Indexing Report ---");

  const sf = new SfPage(page);


  logToFile("Exhibits to Filings: Checked");

  const testCases = [
    {
      date: getTargetDateString(),
      keyword: "is OR the OR a",
      NotKeyword: "NOT (is OR the OR a)",
    },
  ];

  let tabIndex = 0;
  let resultsSummary: string[] = [];

  for (const scenario of testCases) {
    await sf.clearFilters();
    await page.waitForTimeout(3000);
    let exhibitsCheckbox = sf.exhibitsToFilingsLabel;
    await exhibitsCheckbox.uncheck({ force: true });
    await page.waitForTimeout(300);

    let ownershipFormsRadioButton = sf.ownershipFormsIncludeRadio;
    await ownershipFormsRadioButton.click();

    logToFile(`\nTesting Scenario: ${scenario.date}`);

    await sf.fillAndEnter(sf.dateInput, scenario.date);
    await sf.search();
    const textDateOnly = await sf.getTabText(tabIndex++, logToFile, true);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    await sf.fillAndEnter(sf.keywordsInput, scenario.keyword);

    let textWithKeyword = await sf.getTabText(tabIndex++, logToFile, false);
    logToFile(`With Keyword: ${textWithKeyword}`);

    const textDateOnlyCount = parseCount(textDateOnly);
    console.log("textDateOnlyCount", textDateOnlyCount);
    let textWithKeywordCount = parseCount(textWithKeyword);
    console.log("textWithKeywordCount", textWithKeywordCount);
    let isValid = textDateOnlyCount === textWithKeywordCount;
    let notKeywordPart = "";

    if (!isValid) {
      await sf.clearFilters();
      await exhibitsCheckbox.uncheck({ force: true });
      await ownershipFormsRadioButton.click();
      await sf.fillAndEnter(sf.dateInput, scenario.date);
      await sf.fillAndEnter(sf.keywordsInput, scenario.NotKeyword);

      const textWithNotKeyword = await sf.getTabText(
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
  await sf.closeAllOpenTabs();
};
