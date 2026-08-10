import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
} from "../utils/helpers";
import { SrcPage } from "../pages/SrcPage";

const IDENTIFIER = "src_docView";

export const runSRCDocViewTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SRC-DOC View Report ---");

  const src = new SrcPage(page);
  let tabIndex = 0;

  await src.selectAllLawsAndRegs();
  await src.search();

  const searchResult = await src.getTabText(tabIndex++, logToFile);
  let findings = { text: "No Results Found", isValid: true };
  let docCount = 0;

  if (searchResult.includes("Docs")) {
    docCount = parseCount(searchResult);
    await page.waitForTimeout(300);
    findings = await verifyDocViews(docCount, src);
  }

  const scenarioBlock = [
    `Source Type - Laws & Regs: "Securities Laws`,
    `Doc Count: ${docCount}`,
    ``,
    `Results:`,
    findings.text,
    ``,
    `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
  ].join("\n");

  try {
    await updateGoogleSheet(scenarioBlock, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }
  logToFile("\n--- End of Report ---");

  await src.closeAllOpenTabs();
};

/**
 * For each result row: check the row has all its data, open the document,
 * confirm it loads, then go back to the results grid.
 */
const verifyDocViews = async (targetCount: number, src: SrcPage) => {
  const rowsData: string[] = [];
  let isScenarioValid = true;

  await src.forEachResultRow(targetCount, async (row, rowId) => {
    const cleanContent = await src.rowTexts(row);

    const title = cleanContent[2] || "";
    const sourceType = cleanContent[3] || "";
    const materialCategory = cleanContent[4] || "";
    const materialType = cleanContent[5] || "";
    const date = cleanContent[6] || "";

    const rowSummary = `Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType} | Date: ${date}`;
    console.log(`Row ${rowId}: ${rowSummary}`);

    if (!title || !sourceType || !materialCategory || !materialType) {
      isScenarioValid = false;
      rowsData.push(`❌ MISSING DATA >> ${rowSummary}`);
    }

    try {
      await src.openDocument(row);
    } catch (error) {
      console.log("error :", error);
      isScenarioValid = false;
      rowsData.push(`Doc View Content not Loaded >> ${rowSummary}`);
    }

    await src.backToResults();
  });

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
