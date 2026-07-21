import { Page, expect } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { closeAllOpenTabs, fillAndEnter, getTabText } from "../utils/helpers";

const IDENTIFIER = "bpc_compare";

export const runBpcCompareTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting BPC-Profile Compare Report ---");

  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  let resultsSummary: string[] = [];

  let selectedIdentifiers: string[] = [];

  let totalApisFired = 0;
  let successfulApis = 0;
  let failedApis: string[] = [];

  page.on("response", async (response) => {
    const request = response.request();
    const resourceType = request.resourceType();

    if (resourceType === "fetch" || resourceType === "xhr") {
      totalApisFired++;
      const url = response.url();
      const status = response.status();
      const endpoint = url.split('/').pop()?.split('?')[0] || url;

      if (response.ok()) {
        successfulApis++;
        let matchValidation = "";

        if (selectedIdentifiers.length === 2) {
          const responseBodyText = await response.text().catch(() => "");
        //   console.log("API", url);
        //   console.log("response", responseBodyText);
          const hasComp1 = responseBodyText.includes(selectedIdentifiers[0]);
          const hasComp2 = responseBodyText.includes(selectedIdentifiers[1]);

          if (hasComp1 && hasComp2) {
            matchValidation = " [⚖️ Both Companies Data Present]";
          } else if (hasComp1 || hasComp2) {
            const missingCik = !hasComp1 ? selectedIdentifiers[0] : selectedIdentifiers[1];
            matchValidation = ` [❌ Only 1 Company Data Present! Missing CIK: ${missingCik}]`;
            failedApis.push(`${endpoint} (Single-Entity Data Leak)`);
            resultsSummary.push(`🚨 API Payload Flaw: [${endpoint}] contains single-company data. Missing validation for target CIK: ${missingCik}`);
          }
        }

        logToFile(`[NET] ✅ API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (OK)${matchValidation}`);
      } else {
        failedApis.push(endpoint);
        const errorBody = await response.text().catch(() => "No response body text");
        const errorLog = `[NET] 🚨 API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (FAILED) | Response: ${errorBody}`;
        
        logToFile(errorLog);
        resultsSummary.push(errorLog); 
      }
    }
  });

  const logNetworkSummary = (sectionName: string) => {
    logToFile(`\n📊 --- NETWORK HEALTH FOR: ${sectionName} ---`);
    logToFile(`🔹 Total APIs Triggered: ${totalApisFired}`);
    logToFile(`🟢 Successfully Working:  ${successfulApis}`);
    logToFile(`🔴 Broken / Failed:       ${failedApis.length} (${JSON.stringify(failedApis)})`);
    logToFile(`---------------------------------------------------\n`);
    totalApisFired = 0;
    successfulApis = 0;
    failedApis = [];
  };

  const proxyYear = page.locator("#proxyFilingYear").locator("span ._icon_1jkal_249").last();
  await proxyYear.click();
  await page.locator("#container-dropdown").locator("li").filter({hasText : "2025 "}).click({force : true});
  const companyPlsBtn = page.locator("#company-round-btn").first().locator("span");
  await companyPlsBtn.click();

  await page.locator("span").filter({ hasText: "Batch Add" }).click();
  const textArea = page.getByTestId("company-popup-batch-add-textarea");
  
  await fillAndEnter(page, textArea, "AAPL", 20);
  await fillAndEnter(page, textArea, "MSFT", 20);
  await fillAndEnter(page, textArea, "TSLA", 20);
  await fillAndEnter(page, textArea, "googl", 20);
  await fillAndEnter(page, textArea, "AMZN", 20);
  await fillAndEnter(page, textArea, "META", 20);
  await page.locator(".PopupFooter__popup__footer___20Bi-").getByRole("button", { name: "OK" }).first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.getByTestId("company-popup-footer-ok").click();
  
  await searchBtn.click();
  await page.waitForLoadState("networkidle");
  logNetworkSummary("Initial Search Page Load");

  await getTabText(page, 0, logToFile, false);

  async function executeProfileCompare(page: Page, logToFile: Function, tabName: string) {
    const scrollerSelector = 'div[class*="resultsScrollList"]';
    const scroller = page.locator(scrollerSelector).first();

    try {
      await scroller.waitFor({ state: "visible", timeout: 10000 });
    } catch (e) {
      logToFile(`⚠️ [${tabName}] Results scroll list container not found.`);
      return;
    }

    const rowSelector = 'div[data-test="resultRow"]';
    const availableRowsCount = await page.locator(".styles__resultsListContainer___3ZRTR").locator(rowSelector).count();
    // console.log("available rows " , availableRowsCount);
    
    if (availableRowsCount < 2) {
      logToFile(`⚠️ [${tabName}] Not enough rows available (${availableRowsCount}) to perform a profile comparison.`);
      return;
    }

    const samplePoolSize = Math.min(availableRowsCount, 10); 
    const idx1 = Math.floor(Math.random() * samplePoolSize);
    let idx2 = Math.floor(Math.random() * samplePoolSize);
    while (idx1 === idx2) {
      idx2 = Math.floor(Math.random() * samplePoolSize);
    }

    logToFile(`🎲 Random Selection Generated Indices: [Row ${idx1}] and [Row ${idx2}]`);
    selectedIdentifiers = []; 

    const targetIndices = [idx1, idx2];

    for (const idx of targetIndices) {
      const currentRow = page.locator(".styles__resultsListContainer___3ZRTR").locator(`div[data-test="resultRow"][id="${idx}"]`);
      // console.log("current row", currentRow);

      const rowText = await currentRow.innerText();
      // console.log("row text " , rowText);
      const cikMatch = rowText.match(/\d{7,10}/); 
      if (cikMatch) {
        // console.log("cik", cikMatch);
        selectedIdentifiers.push(cikMatch[0]);
        logToFile(`📌 Indexed target CIK token [${cikMatch[0]}] for Row Index ${idx}`);
      }

      const rowCheckbox = currentRow.locator('label._checkbox__icon_1xotg_257').first();
      await rowCheckbox.check({force : true});
    }

    const compareBtn = page.locator('.MultipleResultsView__container___2MSD5').getByRole("button", { name: /Compare/i })
      .or(page.getByRole("button", { name: "Compare", exact: true }))
      .first();

    if (await compareBtn.isVisible()) {
      logToFile(`➔ Triggering Profile Compare Workspace for CIKs: ${JSON.stringify(selectedIdentifiers)}`);
      await compareBtn.click();
      await page.waitForLoadState("networkidle");
      
      const avgValuesRow = page.locator('text="Average Values"').or(page.getByRole('cell', { name: "Average Values" })).first();
      try {
        await expect(avgValuesRow).toBeVisible({ timeout: 10000 });
        logToFile("✨ [Primary View] Confirmed layout successfully includes the [Average Values] calculation benchmarks.");
      } catch {
        const errorMsg = "🚨 Layout Error: Primary Comparison view failed to load the [Average Values] data segment.";
        logToFile(errorMsg);
        resultsSummary.push(errorMsg);
      }
      
      logNetworkSummary(`${tabName} -> Initial Compare Workspace View`);

      const tabContainer = page.locator('div[data-notice="tab-buttons"]').first();
      if (await tabContainer.isVisible()) {
        const subTabsLocator = tabContainer.locator('button');
        const subTabCount = await subTabsLocator.count();
        logToFile(`🔍 Dynamically discovered ${subTabCount} inner comparison data sub-tabs.`);

        for (let k = 0; k < subTabCount; k++) {
          const currentSubTab = subTabsLocator.nth(k);
          const subTabName = (await currentSubTab.innerText())?.trim() || `SubTab_${k}`;

          logToFile(`   ├── Accessing Compare Sub-View [${k + 1}/${subTabCount}]: ${subTabName}`);
          await currentSubTab.click();
          
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(500); 
          logNetworkSummary(`${tabName} -> Sub-Tab: ${subTabName}`);
        }
      }

      const resultsWorkspaceTab = page.locator('div, span, li').filter({ hasText: /^Results:/ }).first();
      if (await resultsWorkspaceTab.isVisible()) {
        logToFile(`🧹 Navigation rollback to main Results grid...`);
        await resultsWorkspaceTab.click();
        await page.waitForLoadState("networkidle");
      }
    } else {
      logToFile("⚠️ Master Compare action trigger button was not accessible in the toolbar wrapper.");
    }
  }

  await executeProfileCompare(page, logToFile , "Board Profile and Company");

  const testStatus = resultsSummary.length > 0 ? "Invalid" : "Valid";
  const finalDumpString = `Status: ${testStatus}\n` + (resultsSummary.length > 0 ? `Issues:\n- ${resultsSummary.join('\n- ')}` : "All profile comparisons and dual-entity API payloads validated successfully.");

  try {
    console.log("final summary\n", finalDumpString);
    await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped multi-tab structural findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }finally{
    await closeAllOpenTabs(page);
  }

  logToFile("\n--- End of Report ---");
};