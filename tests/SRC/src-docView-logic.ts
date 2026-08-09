import { Page, Locator, expect } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  fillAndEnter,
  getTabText,
  configureDisplayColumns,
  closeAllOpenTabs,
  parseCount,
} from "../utils/helpers";
import { SrcPage } from "../pages/SrcPage";

const IDENTIFIER = "src_docView";

export const runSRCDocViewTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SRC-DOC View Report ---");
  let allScenarioResults: string[] = [];

  const src = new SrcPage(page);

  let tabIndex = 0;

  await src.selectAllLawsAndRegs();

  // await fillAndEnter(page, src.lawsAndRegsInput, "Securities Laws");
  await src.search();

  const searchResult = await getTabText(page, tabIndex++, logToFile);
  let findings = { text: "No Results Found", isValid: true };
  let docCount = 0;
  if (searchResult.includes("Docs")) {
    //   await configureDisplayColumns(page, {
    //     "Document Info": [],
    //   });
    docCount = parseCount(searchResult);
    await page.waitForTimeout(300);
    findings = await scrapeCrawlingResults(docCount, page, src);
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

  await closeAllOpenTabs(page);
};

const scrapeCrawlingResults = async (
  targetCount: number,
  page: Page,
  src: SrcPage,
) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount) {
    const rows = src.rows;
    const visibleRowCount = await rows.count();

    if (visibleRowCount === 0) {
      await page.waitForTimeout(500);
      continue;
    }

    for (let i = 0; i < visibleRowCount; i++) {
      const row = rows.nth(i);
      const rowId = await row.getAttribute("id");
      console.log("row id ", rowId);

      if (rowId && !processedIds.has(rowId)) {
        try {
          const cleanContent = await src.rowTexts(row);

          console.log("------------------------------------------------------");
          //   for (const [index, content] of cleanContent.entries()) {
          //     console.log("index", index, "content", content);
          //   }
          console.log("------------------------------------------------------");

          const title = cleanContent[2] || "";
          const sourceType = cleanContent[3] || "";
          const materialCategory = cleanContent[4] || "";
          const materialType = cleanContent[5] || "";
          const date = cleanContent[6] || "";

          const isLineMissingData =
            !title || !sourceType || !materialCategory || !materialType;

          if (isLineMissingData) {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType} | Date: ${date}`,
            );
          }
          console.log("```````````````````````````````````````");
          console.log(`Row ${rowId}:`);
          console.log(
            `Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType} | Date: ${date}`,
          );
          console.log("```````````````````````````````````````");
          await page.waitForTimeout(300);

          const viewBtn = src.viewButton(row);

          await expect(viewBtn).toBeVisible({ timeout: 5000 });

          // Count open docs BEFORE clicking, so waitForDocLoaded knows which
          // viewer is the new one. See BasePage.waitForDocLoaded.
          const docsBefore = await src.openDocCount();

          await viewBtn.click();

          try {
            await src.waitForDocLoaded(docsBefore, 30000);
          } catch (error) {
            console.log("error :", error);
            isScenarioValid = false;
            rowsData.push(
              `Doc View Content not Loaded >> Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType} | Date: ${date}`,
            );
          }

          console.log("results visible:", await src.docsTab.isVisible());
          console.log("results enabled:", await src.docsTab.isEnabled());
          await src.backToResults();
          processedIds.add(rowId);
          await page.waitForTimeout(500);
          resultsFound++;
        } catch (e) {
          console.log("err :", e);
          continue;
        }
      }
      if (resultsFound >= targetCount) break;
    }
    if (resultsFound < targetCount) {
      await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
    }
  }

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
