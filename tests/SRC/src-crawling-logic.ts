import { Page, Locator } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  fillAndEnter,
  getTabText,
  configureDisplayColumns,
  closeAllOpenTabs,
  parseCount,
} from "../utils/helpers";

const IDENTIFIER = "src_crawling";

export const runSRCCrawlingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SRC-Crawling Report ---");
  let allScenarioResults: string[] = [];

  const dateInput = page
    .locator(".styles__focusContainer___13rFy")
    .filter({ has: page.locator("label", { hasText: /^Date$/ }) })
    .locator("input");
  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

  const testCases = [{ date: "Yesterday", count: 15 }];

  let tabIndex = 0;

  for (const scenario of testCases) {
    await fillAndEnter(page, dateInput, scenario.date);
    await searchBtn.click();

    const textDateOnly = await getTabText(page, tabIndex++, logToFile);
    const resultCount = await parseCount(textDateOnly);
    let findings = { text: "No Results Found", isValid: true };

    if (textDateOnly.includes("Docs")) {
      //   await configureDisplayColumns(page, {
      //     "Document Info": [],
      //   });
      await page.waitForTimeout(300);
      findings = await scrapeCrawlingResults(Math.min(scenario.count, resultCount), page);
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
    await clearBtn.click();
    await closeAllOpenTabs(page);
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

  //await closeAllOpenTabs(page);
};

const scrapeCrawlingResults = async (targetCount: number, page: Page) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;
  let fileOrReleaseNoCount = 0;

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

      if (rowId && !processedIds.has(rowId)) {
        try {
          const texts = await row.locator("span").allInnerTexts();
          let fileNo = null;
          let releaseNo = null;

          const fileLocator = row
            .locator("div")
            .filter({ hasText: "File #" })
            .locator("span")
            .last();

          if (await fileLocator.count()) {
            fileNo = await fileLocator.innerText();
          }

          const releaseLocator = row
            .locator("div")
            .filter({ hasText: "Release #" })
            .locator("span")
            .last();

          if (await releaseLocator.count()) {
            releaseNo = await releaseLocator.innerText();
          }
          console.log({ fileNo, releaseNo });
          if (fileNo || releaseNo) {
            fileOrReleaseNoCount++;
          }

          console.log({ fileNo, releaseNo });
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
          //const accessionNo = cleanContent[cleanContent.length - 1] || "";

          const isLineMissingData =
            !title || !sourceType || !materialCategory || !materialType;

          if (isLineMissingData) {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> File.No: ${fileNo} | Release.No: ${releaseNo}  | Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType}`,
            );
          }
          console.log("```````````````````````````````````````");
          console.log(`Row ${rowId}:`);
          console.log(
            `File.No: ${fileNo} | Release.No: ${releaseNo}  | Title: ${title} | Source: ${sourceType} | Category: ${materialCategory} | Type: ${materialType}`,
          );
          console.log("```````````````````````````````````````");
          processedIds.add(rowId);
          await page.waitForTimeout(500);
          resultsFound++;
        } catch (e) {
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
