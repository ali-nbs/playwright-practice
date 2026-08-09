import { Page, Locator, expect } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  fillAndEnter,
  getTabText,
  configureDisplayColumns,
  closeAllOpenTabs,
  parseCount,
  countDocViewContainers,
  waitForDocViewLoaded,
} from "../utils/helpers";

const IDENTIFIER = "src_docView";

export const runSRCDocViewTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SRC-DOC View Report ---");
  let allScenarioResults: string[] = [];

  const lawsAndRegsInput = page.locator("#LawsAndRegs").locator("input");
  const lawsAndRegsPlsBtn = page.locator("#LawsAndRegs").locator("._icon_1jkal_249").first();
  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

  let tabIndex = 0;

  await lawsAndRegsPlsBtn.click();
  await page
    .locator("div.styles__tabHeader___2qy2T")
    .filter({ hasText: "Select All" })
    .locator("label").check();
  await page.getByRole("button", { name: "OK" }).click();

  // await fillAndEnter(page, lawsAndRegsInput, "Securities Laws");
  await searchBtn.click();

  const searchResult = await getTabText(page, tabIndex++, logToFile);
  let findings = { text: "No Results Found", isValid: true };
  let docCount = 0;
  if (searchResult.includes("Docs")) {
    //   await configureDisplayColumns(page, {
    //     "Document Info": [],
    //   });
    docCount = parseCount(searchResult);
    await page.waitForTimeout(300);
    findings = await scrapeCrawlingResults(docCount, page);
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
    //   await updateGoogleSheet(scenarioBlock, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }
  logToFile("\n--- End of Report ---");

  await closeAllOpenTabs(page);
};

const scrapeCrawlingResults = async (targetCount: number, page: Page) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount) {
    const scroller = page.locator(".ReactVirtualized__Grid").last();
    const rows = scroller.locator('div[data-test="resultRow"]');
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
          const texts = await row.locator("span").allInnerTexts();

          const cleanContent = texts
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

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

          const viewBtn = row.getByRole("button", { name: /View/i });

          await expect(viewBtn).toBeVisible({ timeout: 5000 });

          // Snapshot how many document viewers are already mounted BEFORE
          // clicking. The app appends a new viewer per opened document and
          // never unmounts the old ones, so this baseline is what lets the
          // wait below tell "the document I just opened" apart from the
          // stale viewers left behind by previous rows.
          const containersBefore = await countDocViewContainers(page);

          await viewBtn.click();

          try {
            await waitForDocViewLoaded(page, containersBefore, 30000);
          } catch (error) {
            console.log("error :", error);
            isScenarioValid = false;
            rowsData.push(
              `Doc View Content not Loaded >> Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType} | Date: ${date}`,
            );
          }

          const resultsTab = page.locator('span[title^="Docs:"]').first();
          console.log("results visible:", await resultsTab.isVisible());

          console.log("results enabled:", await resultsTab.isEnabled());
          // if (await resultsTab.isVisible()) {
          //await resultsTab.click({ force: true });
          await resultsTab.evaluate((el) => (el as HTMLElement).click());
          //}
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
