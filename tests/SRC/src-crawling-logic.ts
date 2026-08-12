import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
  getTargetDateString,
} from "../utils/helpers";
import { SrcPage } from "../pages/SrcPage";

const IDENTIFIER = "src_crawling";

export const runSRCCrawlingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SRC-Crawling Report ---");

  const src = new SrcPage(page);
  const allScenarioResults: string[] = [];
  const testCases = [{ date: getTargetDateString(), count: 15 }];

  let tabIndex = 0;

  for (const scenario of testCases) {
    await src.fillAndEnter(src.dateInput, scenario.date);
    await src.searchBtn.click();

    const textDateOnly = await src.getTabText(tabIndex++, logToFile);
    const resultCount = parseCount(textDateOnly);
    let findings = { text: "No Results Found", isValid: true };

    if (textDateOnly.includes("Docs")) {
      await page.waitForTimeout(300);
      findings = await scrapeCrawlingResults(
        Math.min(scenario.count, resultCount),
        src,
      );
    }

    allScenarioResults.push(
      [
        `Date: ${scenario.date}`,
        `Target Doc Count: ${scenario.count}`,
        ``,
        `Results:`,
        findings.text,
        ``,
        `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
      ].join("\n"),
    );

    await src.clearFilters();
    await src.closeAllOpenTabs();
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );

  try {
    await updateGoogleSheet(finalDump, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }
  logToFile("\n--- End of Report ---");
};

/**
 * Reads each result row and checks its data is present. Also counts how many
 * rows carry a File # or Release #, which is reported if too many are missing.
 */
const scrapeCrawlingResults = async (targetCount: number, src: SrcPage) => {
  const rowsData: string[] = [];
  let isScenarioValid = true;
  let fileOrReleaseNoCount = 0;

  await src.forEachResultRow(targetCount, async (row, rowId) => {
    const fileNo = await src.labelledValue(row, "File #");
    const releaseNo = await src.labelledValue(row, "Release #");

    console.log({ fileNo, releaseNo });
    if (fileNo || releaseNo) fileOrReleaseNoCount++;

    const { spans: cleanContent } = await src.rowData(row);

    const title = cleanContent[2] || "";
    const sourceType = cleanContent[3] || "";
    const materialCategory = cleanContent[4] || "";
    const materialType = cleanContent[5] || "";

    const rowSummary = `File.No: ${fileNo} | Release.No: ${releaseNo}  | Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType}`;
    console.log(`Row ${rowId}: ${rowSummary}`);

    if (!title || !sourceType || !materialCategory || !materialType) {
      isScenarioValid = false;
      rowsData.push(`❌ MISSING DATA >> ${rowSummary}`);
    }
  });

  if (targetCount - fileOrReleaseNoCount > 5) {
    isScenarioValid = false;
    rowsData.push(
      `❌ MISSING DATA >> File No / Release No missing above threshold (5). Missing count: ${
        targetCount - fileOrReleaseNoCount
      }`,
    );
  }

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
