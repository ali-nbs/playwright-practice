import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { BpcPage } from "../pages/BpcPage";
import {
  getTargetDateString,
  recoverFromAppCrash,
} from "../utils/helpers";

const IDENTIFIER = "bpc_crawling";

async function fetchSpansWithTitles(page: Page, logToFile: Function): Promise<string[]> {
  const bpc = new BpcPage(page);
  const targetDate = getTargetDateString();
 // const targetDate = "06/18/2026";
  logToFile(`📅 Target date calculated: ${targetDate}`);

  const uniqueNames = new Set<string>();
  
  const scrollerSelector = 'div[class*="resultsScrollList"]';
  const scroller = page.locator(scrollerSelector).first();

  try {
    await scroller.waitFor({ state: "visible", timeout: 10000 });
  } catch (e) {
    logToFile("⚠️ Results scroll list container not found on this page.");
    return [];
  }

  let processedCount = 0;
  const totalToProcess = 50;
  let stagnantAttempts = 0;
  let targetDateFound = true;
  
  let datesFoundOnCurrentPage = 0;
  let pageNumber = 1;

  while (processedCount < totalToProcess && stagnantAttempts < 20 && targetDateFound) {
    
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
      await currentRow.waitFor({ state: "attached", timeout: 1200 });
    } catch (e) {
      rowReady = false;
    }

    if (rowReady) {
      stagnantAttempts = 0;
    
      await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(50); 

      const hasTargetDate = (await currentRow.locator(`span[title="${targetDate}"]`).count()) > 0;

      if (hasTargetDate) {
        datesFoundOnCurrentPage++; 
        const spans = currentRow.locator("span[title]");
        const spanCount = await spans.count();
        
        for (let j = 0; j < spanCount; j++) {
          const titleText = (await spans.nth(j).getAttribute("title"))?.trim() || "";
          if (!titleText) continue;

          const isDate = titleText === targetDate;
          const isForm = /^(DEF 14A|8-K|10-K|10-Q|6-K)$/i.test(titleText);
          const isPureNumber = /^\d+$/.test(titleText);
          const isStatusOrFlag = /^(Yes|No|Male|Female|Appointed|Departed|Role Change)$/i.test(titleText);
          const isCurrencyOrMetric = /^\$/.test(titleText) || /\d+(K|M|B|x|%)/i.test(titleText);

          if (!isDate && !isForm && !isPureNumber && !isStatusOrFlag && !isCurrencyOrMetric) {
            uniqueNames.add(titleText);
            break; 
          }
        }
      } else {
       
        const spans = currentRow.locator("span[title]");
        const spanCount = await spans.count();
        let rowDateStr = "";

        for (let j = 0; j < spanCount; j++) {
          const titleText = (await spans.nth(j).getAttribute("title"))?.trim() || "";
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(titleText)) {
            rowDateStr = titleText;
            break; 
          }
        }

        if (rowDateStr) {
          const currentDateObj = new Date(rowDateStr);
          const targetDateObj = new Date(targetDate);

          if (currentDateObj < targetDateObj) {
            logToFile(`🏁 Reached older filing date [${rowDateStr}] at row index [${processedCount}]. Target zone completed.`);
            targetDateFound = false;
            break;
          }
        }
      }

      processedCount++;

      if (processedCount === totalToProcess) {
        if (datesFoundOnCurrentPage === 0) {
          logToFile(`🛑 No entries for ${targetDate} found on Page ${pageNumber}. Breaking pagination chain.`);
          targetDateFound = false;
          break;
        }

        const nextBtn = page.locator('span._icon_1jkal_249.SmallChevronRight, span.SmallChevronRight').first();
        const isNextBtnVisible = await nextBtn.isVisible();

        if (isNextBtnVisible) {
          await nextBtn.click();
          
          await bpc.getTabText(0, logToFile, false);
          
          pageNumber++;
          processedCount = 0;
          datesFoundOnCurrentPage = 0;
          stagnantAttempts = 0;
          
          await scroller.evaluate((el) => { el.scrollTop = 0; });
          await page.waitForTimeout(500); 
        } else {
          logToFile(`Reached the absolute end of documents layout. Next page button is missing or disabled.`);
          targetDateFound = false;
        }
      }

    } else {
      await scroller.evaluate((el) => { el.scrollTop += 100; });
      await page.waitForTimeout(250);
      stagnantAttempts++;
    }
  }

  const resultsArray = Array.from(uniqueNames);
  logToFile(`\n✨ Successfully collected ${resultsArray.length} unique entries for ${targetDate} across ${pageNumber} page(s):`);
  
  resultsArray.forEach((name, index) => {
    logToFile(`  👉 [${index + 1}] ${name}`);
  });

  return resultsArray;
}



export const runBpcCrawlingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting BPC-Crawling Report ---");

  const bpc = new BpcPage(page);
  const searchBtn = bpc.searchBtn;
  const clearBtn = bpc.clearFiltersBtn;

let resultsSummary: string[] = [];
  const targetDate = getTargetDateString();

  // The BPC app crashes ("Oops!" — filterHasValue reading .isEmpty on an
  // undefined filter value, a known app bug) if Search is clicked before
  // its background filter-init API calls finish populating Redux defaults.
  // Give it a moment to settle before submitting a blank/unfiltered search.
  await searchBtn.waitFor({ state: "visible" });
  await page.waitForTimeout(7000);
  await searchBtn.click();

  try {
    await bpc.getTabText(0, logToFile, false);
  } catch (e: any) {
    if (e?.kind === "crash") {
      logToFile(`💥 Initial search: app crashed — ${e.message}`);
      await recoverFromAppCrash(page, logToFile);
    }
    throw e; // nothing to collect without an initial search result
  }

  // ── TAB 1: BOARD & COMPANY ───────────────────────────────────────────
  logToFile("\n📂 Processing Tab 1: Board & Company...");
  const boardTitles = await fetchSpansWithTitles(page, logToFile);

  // ── TAB 2: DIRECTORS ──────────────────────────────────────────────────
  let directorTitles: string[] = [];
  try {
    logToFile("\n📂 Navigating to Tab 2: Directors...");
    const readyDirectorsTab = page.getByText(/^Directors \([\d,]+\)/).first();
    await readyDirectorsTab.waitFor({ state: "visible", timeout: 30000 });
    await readyDirectorsTab.click({ force: true });

    await bpc.getTabText(0, logToFile, false);
    directorTitles = await fetchSpansWithTitles(page, logToFile);
  } catch (e: any) {
    if (e?.kind === "crash") {
      logToFile(`💥 Directors tab: app crashed — ${e.message}`);
      await recoverFromAppCrash(page, logToFile);
      throw e;
    }
    logToFile(`⚠️ Directors tab skipped — ${e.message}`);
  }

  // ── TAB 3: EXECUTIVES ─────────────────────────────────────────────────
  let executiveTitles: string[] = [];
  try {
    logToFile("\n📂 Navigating to Tab 3: Executives...");
    const readyExecutiveTab = page.getByText(/^Executives \([\d,]+\)/).first();
    await readyExecutiveTab.waitFor({ state: "visible", timeout: 30000 });
    await readyExecutiveTab.click({ force: true });

    await bpc.getTabText(0, logToFile, false);
    executiveTitles = await fetchSpansWithTitles(page, logToFile);
  } catch (e: any) {
    if (e?.kind === "crash") {
      logToFile(`💥 Executives tab: app crashed — ${e.message}`);
      await recoverFromAppCrash(page, logToFile);
      throw e;
    }
    logToFile(`⚠️ Executives tab skipped — ${e.message}`);
  }

  // ── COMPILE SUMMARY FINDINGS ──────────────────────────────────────────
  const totalExtracted = boardTitles.length + directorTitles.length + executiveTitles.length;
  let isValid = totalExtracted > 0;


  const scenarioFinding = [
    `Filing Date Target: ${targetDate}`,
    `--------------------------------------------------`,
    `🏢 Board & Company Unique Titles : ${boardTitles.length}`,
    `👤 Directors Unique Titles       : ${directorTitles.length}`,
    `👔 Executives Unique Titles      : ${executiveTitles.length}`,
    `--------------------------------------------------`,
    `📊 Combined Total Pulled Records : ${totalExtracted}`,
    `Result Status                    : ${isValid ? "Valid ✅" : "Invalid ❌"}`
  ].join("\n");

  resultsSummary.push(scenarioFinding);

  const finalDumpString = resultsSummary.join(
    "\n--------------------------------------------------------------------------------\n",
  );

  try {
    console.log("final summary " , finalDumpString);
    await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped multi-tab structural findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }finally{
    await bpc.closeAllOpenTabs();
  }

  logToFile("\n--- End of Report ---");
 
};