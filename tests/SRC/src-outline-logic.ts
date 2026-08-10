import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
} from "../utils/helpers";
import { SrcPage } from "../pages/SrcPage";

const IDENTIFIER = "src_outline";

export const runSRCOutlineTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SRC-OUTLINE View Report ---");

  const src = new SrcPage(page);
  let tabIndex = 0;

  await src.fillAndEnter(src.dateInput, "Last 60 Days");
  await src.fillAndEnter(src.lawsAndRegsInput, "Securities Regs", 200);

  await src.search();

  const searchResult = await src.getTabText(tabIndex++, logToFile);
  let findings = { text: "No Results Found", isValid: true };
  let docCount = 0;

  if (searchResult.includes("Docs")) {
    docCount = parseCount(searchResult);
    await page.waitForTimeout(300);
    findings = await verifyOutlines(docCount, src, page);
  }

  const scenarioBlock = [
    `Source Type - Laws & Regs: "Securities Laws & Securities Regs"`,
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
 * For each result row: check the row data, open the document, then check the
 * outline tab is enabled and its last item can be clicked.
 */
const verifyOutlines = async (targetCount: number, src: SrcPage, page: Page) => {
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
      rowsData.push(`Doc View Content not Loaded >> ${rowSummary}\n`);
    }

    // The outline tab is disabled for documents that have no outline.
    if (await src.isOutlineDisabled()) {
      rowsData.push(`Outline section Disabled >> ${rowSummary}\n`);
      isScenarioValid = false;
    } else {
      await src.outlineTab.click({ force: true });
      await src.clickLastOutlineItem();
      await page.waitForTimeout(1000);
    }

    await src.backToResults();
  });

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
