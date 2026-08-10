// import { Page } from "@playwright/test";
// import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
// 
// const IDENTIFIER = "bpc_view";

// export const runBpcProfileViewTest = async (page: Page, logToFile: Function) => {
//   logToFile("--- Starting BPC-Profile View Report ---");

//   const bpc = new BpcPage(page);
//   const searchBtn = bpc.searchBtn;
//   let resultsSummary: string[] = [];

//   let totalApisFired = 0;
//   let successfulApis = 0;
//   let failedApis = [];

//   page.on("response", async (response) => {
//     const request = response.request();
//     const resourceType = request.resourceType();

//     if (resourceType === "fetch" || resourceType === "xhr") {
//       totalApisFired++;
//       const url = response.url();
//       const status = response.status();
//       const endpoint = url.split('/').pop()?.split('?')[0] || url;

//       if (response.ok()) {
//         successfulApis++;
//         logToFile(`[NET] ✅ API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (OK)`);
//       } else {
//         failedApis.push(endpoint);
//         const errorBody = await response.text().catch(() => "No response body text");
//         const errorLog = `[NET] 🚨 API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (FAILED) | Response: ${errorBody}`;
        
//         logToFile(errorLog);
//         resultsSummary.push(errorLog); 
//       }
//     }
//   });

//   const logNetworkSummary = (sectionName: string) => {
//     logToFile(`\n📊 --- NETWORK HEALTH FOR: ${sectionName} ---`);
//     logToFile(`🔹 Total APIs Triggered: ${totalApisFired}`);
//     logToFile(`🟢 Successfully Working:  ${successfulApis}`);
//     logToFile(`🔴 Broken / Failed:       ${failedApis}`);
//     logToFile(`---------------------------------------------------\n`);
//     totalApisFired = 0;
//     successfulApis = 0;
//     failedApis = [];
//   };

//   const companyPlsBtn = page.locator("#company-round-btn").first().locator("span");
//   await companyPlsBtn.click();

//   await page.locator("span").filter({ hasText: "Batch Add" }).click();
//   const textArea = bpc.companyBatchAddTextarea;
  
//   await fillAndEnter(page, textArea, "AAPL", 20);
//   await fillAndEnter(page, textArea, "MSFT", 20);
//   await fillAndEnter(page, textArea, "TSLA", 20);
//   await fillAndEnter(page, textArea, "googl", 20);
//   await fillAndEnter(page, textArea, "AMZN", 20);
//   await fillAndEnter(page, textArea, "META", 20);
//   await page.locator(".PopupFooter__popup__footer___20Bi-").getByRole("button", { name: "OK" }).first().click({ force: true });
//   await page.waitForTimeout(4000);
//   await bpc.companyPopupOkBtn.click();
  
//   await searchBtn.click();
//   //await page.waitForLoadState("networkidle");
//   logNetworkSummary("Initial Search Page Load");

//   await getTabText(page, 0, logToFile, false);

//   async function fetchNames(page: Page, logToFile: Function, tabName: string): Promise<string[]> {
//     const uniqueNames = new Set<string>();
//     const scrollerSelector = 'div[class*="resultsScrollList"]';
    
//     let processedCount = 0;
//     const totalToProcess = Math.min(5,50); 
//     let stagnantAttempts = 0;

//     logToFile(`⏳ [${tabName}] Scanning rows...`);

//     while (processedCount < totalToProcess && stagnantAttempts < 15) {
//       const scroller = page.locator(scrollerSelector).first();

//       try {
//         await scroller.waitFor({ state: "visible", timeout: 10000 });
//       } catch (e) {
//         logToFile(`⚠️ [${tabName}] Results scroll list container not found. Cannot proceed to index ${processedCount}.`);
//         return Array.from(uniqueNames);
//       }

//       const rowHeight = await scroller.evaluate((el) => {
//         const sampleRow = el.querySelector('[data-test="resultRow"]');
//         return sampleRow ? sampleRow.getBoundingClientRect().height : 48; 
//       });

//       await scroller.evaluate((el, top) => { el.scrollTop = top; }, processedCount * rowHeight);

//       const currentRow = page.locator(`div[data-test="resultRow"][id="${processedCount}"], div[id="${processedCount}"]`).first();
//       let rowReady = true;
      
//       try {
//         await currentRow.waitFor({ state: "attached", timeout: 1000 });
//       } catch (e) {
//         rowReady = false;
//       }

//       if (rowReady) {
//         stagnantAttempts = 0;
//         await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));
//         await page.waitForTimeout(50); 

//         const spans = currentRow.locator("span[title]");
//         const spanCount = await spans.count();
//         let rowIdentifierName = `Row_${processedCount}`;
        
//         for (let j = 0; j < spanCount; j++) {
//           const titleText = (await spans.nth(j).getAttribute("title"))?.trim() || "";
//           if (!titleText) continue;

//           const isFilingDate = /^\d{2}\/\d{2}\/\d{4}$/.test(titleText); 
//           const isFormType = /^(DEF 14A|8-K|10-K|10-Q|6-K)$/i.test(titleText);
//           const isCikNumber = /^\d+$/.test(titleText);
//           const isStatusOrFlag = /^(Yes|No|Male|Female|Appointed|Departed|Role Change)$/i.test(titleText);
//           const isCurrencyOrMetric = /^\$/.test(titleText) || /\d+(K|M|B|x|%)/i.test(titleText);
        
//           if (!isFilingDate && !isFormType && !isCikNumber && !isStatusOrFlag && !isCurrencyOrMetric) {
//             uniqueNames.add(titleText);
//             rowIdentifierName = titleText;
//             break; 
//           }
//         }
//         console.log("before profile page click");
//         const profileBtn = currentRow.getByRole("button", { name: "Profile" }).first();
//         if (await profileBtn.isVisible()) {
//           logToFile(`➔ Opening Profile Workspace for: ${rowIdentifierName}`);
//           await profileBtn.click({force: true});
          
//           const tabContainer = page.locator('div[data-notice="tab-buttons"]').first();
//           try {
//             await tabContainer.waitFor({ state: "visible", timeout: 15000 });
//           } catch (err) {
//             logToFile(`⚠️ Sub-tab buttons container didn't render within timeout for: ${rowIdentifierName}`);
//           }

//           logNetworkSummary(`[${tabName}] ${rowIdentifierName} -> Initial Profile Load`);

//           const subTabsLocator = tabContainer.locator('button');
//           const subTabCount = await subTabsLocator.count();
//           logToFile(`   🔍 Dynamically detected ${subTabCount} sub-tab buttons for this layout.`);

//           for (let k = 0; k < subTabCount; k++) {
//             const currentSubTab = subTabsLocator.nth(k);
//             const subTabName = (await currentSubTab.innerText())?.trim() || `SubTab_${k}`;

//             logToFile(`   ├── Clicking Sub-Tab [${k + 1}/${subTabCount}]: ${subTabName}`);
//             await currentSubTab.click();
            
//             await page.waitForLoadState("networkidle");
//             logNetworkSummary(`[${tabName}] ${rowIdentifierName} -> ${subTabName}`);
//           }

//           const resultsWorkspaceTab = page.locator('div, span, li').filter({ hasText: /^Results:/ }).first();
//           if (await resultsWorkspaceTab.isVisible()) {
//             await resultsWorkspaceTab.click();
//             await page.waitForLoadState("networkidle");
//           }
//         }

//         processedCount++;
//       } else {
//         await scroller.evaluate((el) => { el.scrollTop += 80; });
//         await page.waitForTimeout(200);
//         stagnantAttempts++;
//       }
//     }

//     return Array.from(uniqueNames);
//   }

//   const primaryCategories = [
//     { name: "Board & Company", textMatch: /^Board & Company/ },
//     { name: "Directors", textMatch: /^Directors/ },
//     { name: "Executives", textMatch: /^Executives/ }
//   ];

//   for (const category of primaryCategories) {
//     logToFile(`\n📂 Switching to Primary Category: [${category.name}]`);
    
//     const categoryTab = page
//       .locator('.MultipleResultsView__container___2MSD5 .Tabs__tab___1dqzM')
//       .filter({ hasText: category.textMatch })
//       .first();
    
//     if (await categoryTab.isVisible()) {
//       await categoryTab.click();
//       //await page.waitForLoadState("networkidle");
//       logNetworkSummary(`Primary Tab Switch -> ${category.name}`);
      
//       await fetchNames(page, logToFile, category.name);
//     } else {
//       logToFile(`⚠️ Could not find navigation element for category tab: ${category.name}`);
//     }
//   }

//   const testStatus = resultsSummary.length > 0 ? "Invalid" : "Valid";
//   const finalDumpString = `Status: ${testStatus}\n` + (resultsSummary.length > 0 ? `Issues:\n- ${resultsSummary.join('\n- ')}` : "All profile views and associated sub-tab API payloads validated successfully.");

//   try {
//     console.log("final summary ", finalDumpString);
//     await updateGoogleSheet(finalDumpString, IDENTIFIER);
//     logToFile("\nSuccessfully dumped multi-tab structural findings to Google Sheets.");
//   } catch (err: any) {
//     logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
//   }finally{
//     await closeAllOpenTabs(page);
//   }

//   logToFile("\n--- End of Report ---");
// };

import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { BpcPage } from "../pages/BpcPage";

const IDENTIFIER = "bpc_view";

type IssueRecord = {
  category: string;
  profileName: string;
  subTab: string;
  endpoint: string;
  status: number | string;
  detail: string;
};

export const runBpcProfileViewTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting BPC-Profile View Report ---");

  const bpc = new BpcPage(page);
  const searchBtn = bpc.searchBtn;
  let resultsSummary: string[] = [];
  let detailedIssues: IssueRecord[] = [];

  // Context trackers so a failed API can be attributed to exactly where it
  // happened, instead of just "somewhere during the run".
  let currentCategory = "";
  let currentProfileName = "";
  let currentSubTab = "Profile Load";

  let totalApisFired = 0;
  let successfulApis = 0;
  let failedApis: string[] = [];

  // "networkidle" never fires reliably on this app (a chat widget keeps a
  // long-poll connection open continuously, so the page never truly goes
  // quiet). Instead, track the timestamp of the last fetch/xhr response and
  // wait until a quiet window has passed since it — capped by a max wait so
  // a genuinely stuck page doesn't hang the test.
  let lastApiActivityAt = Date.now();
  const waitForApiQuiet = async (quietMs = 800, maxMs = 8000) => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (Date.now() - lastApiActivityAt >= quietMs) return;
      await page.waitForTimeout(150);
    }
  };

  page.on("response", async (response) => {
    const request = response.request();
    const resourceType = request.resourceType();

    if (resourceType === "fetch" || resourceType === "xhr") {
      totalApisFired++;
      lastApiActivityAt = Date.now();
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
        detailedIssues.push({
          category: currentCategory,
          profileName: currentProfileName,
          subTab: currentSubTab,
          endpoint,
          status,
          detail: errorBody.slice(0, 300),
        });
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
  const textArea = bpc.companyBatchAddTextarea;
  
  await bpc.fillAndEnter(textArea, "AAPL", 20);
  await bpc.fillAndEnter(textArea, "MSFT", 20);
  await bpc.fillAndEnter(textArea, "TSLA", 20);
  await bpc.fillAndEnter(textArea, "googl", 20);
  await bpc.fillAndEnter(textArea, "AMZN", 20);
  await bpc.fillAndEnter(textArea, "META", 20);
  await page.locator(".PopupFooter__popup__footer___20Bi-").getByRole("button", { name: "OK" }).first().click({ force: true });
  await page.waitForTimeout(4000);
  await bpc.companyPopupOkBtn.click();
  
  await searchBtn.click();
  //await page.waitForLoadState("networkidle");
  logNetworkSummary("Initial Search Page Load");

  await bpc.getTabText(0, logToFile, false);

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

      // Scoped to `scroller` (not `page`) — this SPA keeps the Home tab's
      // "History" table mounted off-screen after switching to Results, and
      // it reuses the same id="0", id="1"... row-id scheme. An unscoped
      // page-wide locator can resolve to that off-screen row instead of the
      // real result, and hovering/clicking an element permanently out of
      // viewport hangs forever (no action timeout is set in playwright.config.ts).
      const currentRow = scroller.locator(`[data-test="resultRow"][id="${processedCount}"], [id="${processedCount}"]`).first();
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
        console.log("before profile page click");

        // Row action buttons on some layouts only render/become visible on
        // hover, and isVisible() below checks immediately with no wait — so
        // a not-yet-revealed button silently skips the whole row with zero
        // log trace. Hover first, then wait (with a fallback label match)
        // instead of a single instantaneous check.
        await currentRow.hover().catch(() => {});

        let profileBtn = currentRow.getByRole("button", { name: "Profile", exact: true }).first();
        let profileBtnReady = await profileBtn
          .waitFor({ state: "visible", timeout: 3000 })
          .then(() => true)
          .catch(() => false);

        if (!profileBtnReady) {
          // Some tabs may label/expose the same action differently (e.g.
          // "View Profile", an icon-only button with an aria-label, etc).
          profileBtn = currentRow.getByRole("button", { name: /profile/i }).first();
          profileBtnReady = await profileBtn
            .waitFor({ state: "visible", timeout: 3000 })
            .then(() => true)
            .catch(() => false);
        }

        if (profileBtnReady) {
          currentProfileName = rowIdentifierName;
          currentSubTab = "Initial Profile Load";
          logToFile(`➔ Opening Profile Workspace for: ${rowIdentifierName}`);
          await profileBtn.click({force: true});
          
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
            const subTabBtn = subTabsLocator.nth(k);
            const subTabName = (await subTabBtn.innerText())?.trim() || `SubTab_${k}`;

            logToFile(`   ├── Clicking Sub-Tab [${k + 1}/${subTabCount}]: ${subTabName}`);
            // Set BEFORE the click so any APIs fired while this sub-tab loads
            // get attributed to it, not to whichever sub-tab was active before.
            currentSubTab = subTabName;
            await subTabBtn.click();

            await waitForApiQuiet();
            logNetworkSummary(`[${tabName}] ${rowIdentifierName} -> ${subTabName}`);
          }

          const resultsWorkspaceTab = page.locator('div, span, li').filter({ hasText: /^Results:/ }).first();
          if (await resultsWorkspaceTab.isVisible()) {
            currentSubTab = "Results Grid Rollback";
            await resultsWorkspaceTab.click();
            await waitForApiQuiet();
          }
        } else {
          // Diagnostic dump instead of a silent skip — capture exactly what
          // buttons DO exist in this row so a future run's log/sheet shows
          // the real cause instead of just "no profile output".
          const allButtons = currentRow.locator('button');
          const btnCount = await allButtons.count();
          const btnLabels: string[] = [];
          for (let b = 0; b < btnCount; b++) {
            const label =
              (await allButtons.nth(b).innerText().catch(() => "")) ||
              (await allButtons.nth(b).getAttribute("aria-label").catch(() => "")) ||
              "(no text)";
            btnLabels.push(label.trim());
          }
          const diagMsg = `⚠️ [${tabName}] Profile button not found/visible for row "${rowIdentifierName}" (index ${processedCount}). Buttons found in row: ${JSON.stringify(btnLabels)}`;
          logToFile(diagMsg);
          resultsSummary.push(diagMsg);
          detailedIssues.push({
            category: currentCategory,
            profileName: rowIdentifierName,
            subTab: "Row Action Lookup",
            endpoint: "N/A",
            status: "N/A",
            detail: `Profile button not found/visible. Row buttons: ${JSON.stringify(btnLabels)}`,
          });
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
    currentCategory = category.name;
    
    const categoryTab = page
      .locator('.MultipleResultsView__container___2MSD5 .Tabs__tab___1dqzM')
      .filter({ hasText: category.textMatch })
      .first();
    
    if (await categoryTab.isVisible()) {
      await categoryTab.click();
      //await page.waitForLoadState("networkidle");
      logNetworkSummary(`Primary Tab Switch -> ${category.name}`);
      
      await fetchNames(page, logToFile, category.name);
    } else {
      logToFile(`⚠️ Could not find navigation element for category tab: ${category.name}`);
    }
  }

  const testStatus = detailedIssues.length > 0 ? "Invalid" : "Valid";

  const buildFinalDumpString = () => {
    if (detailedIssues.length === 0) {
      return `Status: Valid\nAll profile views and associated sub-tab API payloads validated successfully.`;
    }

    const lines: string[] = [];
    lines.push(`Status: Invalid`);
    lines.push(`Total Issues: ${detailedIssues.length}`);
    lines.push("");

    // Quick-scan table — tab-separated so it pastes into Sheets as columns.
    lines.push(["Category", "Profile", "Sub-Tab", "Endpoint", "Status", "Detail"].join("\t"));
    for (const issue of detailedIssues) {
      lines.push(
        [issue.category, issue.profileName, issue.subTab, issue.endpoint, issue.status, issue.detail].join("\t")
      );
    }
    lines.push("");

    // Grouped breakdown: Category > Profile > Sub-Tab, for readability.
    const byProfile = new Map<string, IssueRecord[]>();
    for (const issue of detailedIssues) {
      const key = `${issue.category} > ${issue.profileName}`;
      if (!byProfile.has(key)) byProfile.set(key, []);
      byProfile.get(key)!.push(issue);
    }

    lines.push("Breakdown by Profile:");
    for (const [profileKey, issues] of byProfile) {
      lines.push(`\n[${profileKey}] — ${issues.length} issue(s)`);
      for (const issue of issues) {
        lines.push(`  🚨 Sub-Tab: ${issue.subTab} | Endpoint: ${issue.endpoint} | Status: ${issue.status} | ${issue.detail}`);
      }
    }

    return lines.join("\n");
  };

  const finalDumpString = buildFinalDumpString();

  try {
    console.log("final summary ", finalDumpString);
    await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped multi-tab structural findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }finally{
    await bpc.closeAllOpenTabs();
  }

  logToFile("\n--- End of Report ---");
};