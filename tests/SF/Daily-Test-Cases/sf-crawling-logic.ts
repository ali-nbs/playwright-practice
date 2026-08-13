import { Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_crawling";

export const runCrawlingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Crawling Report ---");

  const sf = new SfPage(page);
  let allScenarioResults: string[] = [];


  const testCases = [{ date: "Today", count: 15 }];

  let tabIndex = 0;

  for (const scenario of testCases) {
    const exhibitstoFilingsCheckbox = sf.exhibitsToFilingsLabel;
    await exhibitstoFilingsCheckbox.uncheck({ force: true });
    await sf.amendmentFilingsExcludeRadio.click();
    await sf.ownershipFormsIncludeRadio.click();

    await sf.fillAndEnter(sf.dateInput, scenario.date);
    await sf.searchBtn.click();

    const textDateOnly = await sf.getTabText(tabIndex++, logToFile);
    let findings = { text: "No Results Found", isValid: true };

    if (textDateOnly.includes("Docs")) {
      await sf.configureDisplayColumns({
        "Filing Info": ["Accession #"],
        "Company Info": [],
      });
      await page.waitForTimeout(300);
      findings = await scrapeCrawlingResults(scenario.count, page);
    }

    const scenarioBlock = [
      `Date: ${scenario.date}`,
      `Target Doc Count: ${scenario.count}`,
      ``,
      `Results:`,
      findings.text,
      ``,
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);
    await sf.clearFilters();
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

  await sf.closeAllOpenTabs();
};

/**
 * Walks the grid via BasePage.forEachRow (swallowRowErrors: true, the
 * original id-based, skip-on-error behaviour) instead of hand-rolling the
 * same loop - identical scroll style ("intoViewStart") and 500ms settle
 * wait.
 */
const scrapeCrawlingResults = async (targetCount: number, page: Page) => {
  const sf = new SfPage(page);
  const rowsData: string[] = [];
  let isScenarioValid = true;

  await sf.forEachRow(
    targetCount,
    async (row, rowId) => {
      const { spans: cleanContent } = await sf.rowData(row);

      const companyName = cleanContent[4] || "";
      const pages = cleanContent[5] || "";
      const docSize = cleanContent[6] || "";
      const accessionNo = cleanContent[cleanContent.length - 1] || "";

      const isLineMissingData =
        !companyName || !pages || !docSize || !accessionNo;

      const line = `Acc.No: ${accessionNo} | Co: ${companyName} | Pg: ${pages} | Sz: ${docSize}`;

      if (isLineMissingData) {
        isScenarioValid = false;
        rowsData.push(`❌ MISSING DATA >> ${line}`);
      } else {
        rowsData.push(line);
      }

      console.log("```````````````````````````````````````");
      console.log(`Row ${rowId}:`);
      console.log(line);
      console.log("```````````````````````````````````````");
    },
    { swallowRowErrors: true },
  );

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
