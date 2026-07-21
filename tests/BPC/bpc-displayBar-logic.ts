import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { closeAllOpenTabs, getTabText } from "../utils/helpers";

const IDENTIFIER = "bpc_displayBar";

async function fetchNames(page: Page, logToFile: Function, tabName: string): Promise<string[]> {
  const uniqueNames = new Set<string>();
  const scrollerSelector = 'div[class*="resultsScrollList"]';
  const scroller = page.locator(scrollerSelector).first();

  try {
    await scroller.waitFor({ state: "visible", timeout: 10000 });
  } catch (e) {
    logToFile(`⚠️ [${tabName}] Results scroll list container not found.`);
    return [];
  }

  let processedCount = 0;
  const totalToProcess = 50; 
  let stagnantAttempts = 0;

  logToFile(`⏳ [${tabName}] Scanning rows 0 to 49...`);

  while (processedCount < totalToProcess && stagnantAttempts < 15) {

    const rowHeight = await scroller.evaluate((el) => {
      const sampleRow = el.querySelector('[data-test="resultRow"]');
      return sampleRow ? sampleRow.getBoundingClientRect().height : 48; 
    });

    await scroller.evaluate(
      (el, top) => { el.scrollTop = top; },
      processedCount * rowHeight
    );

    const currentRow = scroller.locator(`div[data-test="resultRow"][id="${processedCount}"], div[id="${processedCount}"]`).first();
    let rowReady = true;
    
    try {
      await currentRow.waitFor({ state: "attached", timeout: 1000 });
    } catch (e) {
      rowReady = false;
    }

    if (rowReady) {
      stagnantAttempts = 0;
      await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(50); 

      const spans = currentRow.locator("span[title]");
      const spanCount = await spans.count();
      
      for (let j = 0; j < spanCount; j++) {
        const titleText = (await spans.nth(j).getAttribute("title"))?.trim() || "";
        if (!titleText) continue;

        const isFilingDate = /^\d{2}\/\d{2}\/\d{4}$/.test(titleText); 
        const isFormType = /^(DEF 14A|8-K|10-K|10-Q|6-K)$/i.test(titleText);
        const isCikNumber = /^\d+$/.test(titleText);
        const isStatusOrFlag = /^(Yes|No|Male|Female|Appointed|Departed|Role Change)$/i.test(titleText);
        const isCurrencyOrMetric = /^\$/.test(titleText) || /\d+(K|M|B|x|%)/i.test(titleText);
      
        if (!isFilingDate && !isFormType && !isCikNumber && !isStatusOrFlag && !isCurrencyOrMetric) {
          uniqueNames.add(titleText);
          break; 
        }
      }

      processedCount++;
    } else {
      
      await scroller.evaluate((el) => { el.scrollTop += 80; });
      await page.waitForTimeout(200);
      stagnantAttempts++;
    }
  }

  const resultsArray = Array.from(uniqueNames);
  logToFile(`✨ [${tabName}] Successfully extracted ${resultsArray.length} names from page 1.`);
  
  resultsArray.forEach((name, index) => {
    logToFile(`  👉 [${index + 1}] ${name}`);
  });

  return resultsArray;
}

export const runBpcDisplayBarTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting BPC First Page Names Collection Report ---");

  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  let resultsSummary: string[] = [];

  await searchBtn.click();
  await getTabText(page, 0, logToFile, false);

  // ── TAB 1: BOARD & COMPANY ───────────────────────────────────────────
  logToFile("\n📂 Processing Tab 1: Board & Company...");
  const boardNames = await fetchNames(page, logToFile, "Board & Company");

  // ── TAB 2: DIRECTORS ──────────────────────────────────────────────────
  logToFile("\n📂 Navigating to Tab 2: Directors...");
  const readyDirectorsTab = page.getByText(/^Directors \([\d,]+\)/).first();
  await readyDirectorsTab.waitFor({ state: "visible", timeout: 30000 });
  await readyDirectorsTab.click({ force: true });
  
  await getTabText(page, 0, logToFile, false);
  const directorNames = await fetchNames(page, logToFile, "Directors");

  // ── TAB 3: EXECUTIVES ─────────────────────────────────────────────────
  logToFile("\n📂 Navigating to Tab 3: Executives...");
  const readyExecutiveTab = page.getByText(/^Executives \([\d,]+\)/).first();
  await readyExecutiveTab.waitFor({ state: "visible", timeout: 30000 });
  await readyExecutiveTab.click({ force: true });
  
  await getTabText(page, 0, logToFile, false);
  const executiveNames = await fetchNames(page, logToFile, "Executives");

  // ── COMPILE OVERALL SUMMARY payload ───────────────────────────────────
  const totalNamesExtracted = boardNames.length + directorNames.length + executiveNames.length;

  const summaryDataDump = [
    `--------------------------------------------------`,
    `🏢 Board & Company Names Extracted :  (${boardNames.length === 50 ? "Valid ✅" : "Invalid ❌"})`,
    `👤 Directors Names Extracted       : (${directorNames.length === 50 ? "Valid ✅" : "Invalid ❌"})`,
    `👔 Executives Names Extracted      :  (${executiveNames.length === 50 ? "Valid ✅" : "Invalid ❌"})`,
  ].join("\n");

  resultsSummary.push(summaryDataDump);

  const finalDumpString = resultsSummary.join("\n");

  try {
    console.log("Final Run Summary:\n", finalDumpString );
    await updateGoogleSheet(finalDumpString, IDENTIFIER,  totalNamesExtracted == 150 ? [] : ["Invalid"]);
    logToFile("\nSuccessfully saved first page findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }finally{
    await closeAllOpenTabs(page);
  }

  logToFile("\n--- End of Report ---");
};