import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { closeAllOpenTabs, fillAndEnter, getTabText } from "../utils/helpers";

const IDENTIFIER = "bpc_view";

export const runBpcProfileViewTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting BPC-Profile View Report ---");

  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  let resultsSummary: string[] = [];

  let totalApisFired = 0;
  let successfulApis = 0;
  let failedApis = [];

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
        logToFile(`[NET] ✅ API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (OK)`);
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
    logToFile(`🔴 Broken / Failed:       ${failedApis}`);
    logToFile(`---------------------------------------------------\n`);
    totalApisFired = 0;
    successfulApis = 0;
    failedApis = [];
  };

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

  async function fetchNames(page: Page, logToFile: Function, tabName: string): Promise<string[]> {
    const uniqueNames = new Set<string>();
    const scrollerSelector = 'div[class*="resultsScrollList"]';
    
    let processedCount = 0;
    const totalToProcess = Math.min(5,50); 
    let stagnantAttempts = 0;

    logToFile(`⏳ [${tabName}] Scanning rows...`);

    while (processedCount < totalToProcess && stagnantAttempts < 15) {
      const scroller = page.locator(scrollerSelector).first();

      try {
        await scroller.waitFor({ state: "visible", timeout: 10000 });
      } catch (e) {
        logToFile(`⚠️ [${tabName}] Results scroll list container not found. Cannot proceed to index ${processedCount}.`);
        return Array.from(uniqueNames);
      }

      const rowHeight = await scroller.evaluate((el) => {
        const sampleRow = el.querySelector('[data-test="resultRow"]');
        return sampleRow ? sampleRow.getBoundingClientRect().height : 48; 
      });

      await scroller.evaluate((el, top) => { el.scrollTop = top; }, processedCount * rowHeight);

      const currentRow = page.locator(`div[data-test="resultRow"][id="${processedCount}"], div[id="${processedCount}"]`).first();
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
        let rowIdentifierName = `Row_${processedCount}`;
        
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
            rowIdentifierName = titleText;
            break; 
          }
        }

        const profileBtn = currentRow.getByRole("button", { name: "Profile" }).first();
        if (await profileBtn.isVisible()) {
          logToFile(`➔ Opening Profile Workspace for: ${rowIdentifierName}`);
          await profileBtn.click();
          
          const tabContainer = page.locator('div[data-notice="tab-buttons"]').first();
          try {
            await tabContainer.waitFor({ state: "visible", timeout: 15000 });
          } catch (err) {
            logToFile(`⚠️ Sub-tab buttons container didn't render within timeout for: ${rowIdentifierName}`);
          }

          logNetworkSummary(`[${tabName}] ${rowIdentifierName} -> Initial Profile Load`);

          const subTabsLocator = tabContainer.locator('button');
          const subTabCount = await subTabsLocator.count();
          logToFile(`   🔍 Dynamically detected ${subTabCount} sub-tab buttons for this layout.`);

          for (let k = 0; k < subTabCount; k++) {
            const currentSubTab = subTabsLocator.nth(k);
            const subTabName = (await currentSubTab.innerText())?.trim() || `SubTab_${k}`;

            logToFile(`   ├── Clicking Sub-Tab [${k + 1}/${subTabCount}]: ${subTabName}`);
            await currentSubTab.click();
            
            await page.waitForLoadState("networkidle");
            logNetworkSummary(`[${tabName}] ${rowIdentifierName} -> ${subTabName}`);
          }

          const resultsWorkspaceTab = page.locator('div, span, li').filter({ hasText: /^Results:/ }).first();
          if (await resultsWorkspaceTab.isVisible()) {
            await resultsWorkspaceTab.click();
            await page.waitForLoadState("networkidle");
          }
        }

        processedCount++;
      } else {
        await scroller.evaluate((el) => { el.scrollTop += 80; });
        await page.waitForTimeout(200);
        stagnantAttempts++;
      }
    }

    return Array.from(uniqueNames);
  }

  const primaryCategories = [
    { name: "Board & Company", textMatch: /^Board & Company/ },
    { name: "Directors", textMatch: /^Directors/ },
    { name: "Executives", textMatch: /^Executives/ }
  ];

  for (const category of primaryCategories) {
    logToFile(`\n📂 Switching to Primary Category: [${category.name}]`);
    
    const categoryTab = page
      .locator('.MultipleResultsView__container___2MSD5 .Tabs__tab___1dqzM')
      .filter({ hasText: category.textMatch })
      .first();
    
    if (await categoryTab.isVisible()) {
      await categoryTab.click();
      await page.waitForLoadState("networkidle");
      logNetworkSummary(`Primary Tab Switch -> ${category.name}`);
      
      await fetchNames(page, logToFile, category.name);
    } else {
      logToFile(`⚠️ Could not find navigation element for category tab: ${category.name}`);
    }
  }

  const testStatus = resultsSummary.length > 0 ? "Invalid" : "Valid";
  const finalDumpString = `Status: ${testStatus}\n` + (resultsSummary.length > 0 ? `Issues:\n- ${resultsSummary.join('\n- ')}` : "All profile views and associated sub-tab API payloads validated successfully.");

  try {
    console.log("final summary ", finalDumpString);
    await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped multi-tab structural findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }finally{
    await closeAllOpenTabs(page);
  }

  logToFile("\n--- End of Report ---");
};