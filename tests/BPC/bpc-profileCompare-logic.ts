// import { Page, expect } from "@playwright/test";
// import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
// import { closeAllOpenTabs, fillAndEnter, getTabText } from "../utils/helpers";

// const IDENTIFIER = "bpc_compare";

// export const runBpcCompareTest = async (page: Page, logToFile: Function) => {
//   logToFile("--- Starting BPC-Profile Compare Report ---");

//   const bpc = new BpcPage(page);
//   const searchBtn = bpc.searchBtn;
//   let resultsSummary: string[] = [];

//   let selectedIdentifiers: string[] = [];

//   let totalApisFired = 0;
//   let successfulApis = 0;
//   let failedApis: string[] = [];

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
//         let matchValidation = "";

//         if (selectedIdentifiers.length === 2) {
//           const responseBodyText = await response.text().catch(() => "");
//         //   console.log("API", url);
//         //   console.log("response", responseBodyText);
//           const hasComp1 = responseBodyText.includes(selectedIdentifiers[0]);
//           const hasComp2 = responseBodyText.includes(selectedIdentifiers[1]);

//           if (hasComp1 && hasComp2) {
//             matchValidation = " [⚖️ Both Companies Data Present]";
//           } else if (hasComp1 || hasComp2) {
//             const missingCik = !hasComp1 ? selectedIdentifiers[0] : selectedIdentifiers[1];
//             matchValidation = ` [❌ Only 1 Company Data Present! Missing CIK: ${missingCik}]`;
//             failedApis.push(`${endpoint} (Single-Entity Data Leak)`);
//             resultsSummary.push(`🚨 API Payload Flaw: [${endpoint}] contains single-company data. Missing validation for target CIK: ${missingCik}`);
//           }
//         }

//         logToFile(`[NET] ✅ API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (OK)${matchValidation}`);
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
//     logToFile(`🔴 Broken / Failed:       ${failedApis.length} (${JSON.stringify(failedApis)})`);
//     logToFile(`---------------------------------------------------\n`);
//     totalApisFired = 0;
//     successfulApis = 0;
//     failedApis = [];
//   };

//   const proxyYear = page.locator("#proxyFilingYear").locator("span ._icon_1jkal_249").last();
//   await proxyYear.click();
//   await page.locator("#container-dropdown").locator("li").filter({hasText : "2025 "}).click({force : true});
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
//   await page.waitForTimeout(2000);
//   await bpc.companyPopupOkBtn.click();
  
//   await searchBtn.click();
//   //await page.waitForLoadState("networkidle");
//   //logNetworkSummary("Initial Search Page Load");

//   await getTabText(page, 0, logToFile, false);

//   async function executeProfileCompare(page: Page, logToFile: Function, tabName: string) {
//     const scrollerSelector = 'div[class*="resultsScrollList"]';
//     const scroller = page.locator(scrollerSelector).first();

//     try {
//       await scroller.waitFor({ state: "visible", timeout: 10000 });
//     } catch (e) {
//       logToFile(`⚠️ [${tabName}] Results scroll list container not found.`);
//       return;
//     }

//     const rowSelector = 'div[data-test="resultRow"]';
//     const availableRowsCount = await page.locator(".styles__resultsListContainer___3ZRTR").locator(rowSelector).count();
//     // console.log("available rows " , availableRowsCount);
    
//     if (availableRowsCount < 2) {
//       logToFile(`⚠️ [${tabName}] Not enough rows available (${availableRowsCount}) to perform a profile comparison.`);
//       return;
//     }

//     const samplePoolSize = Math.min(availableRowsCount, 10); 
//     const idx1 = Math.floor(Math.random() * samplePoolSize);
//     let idx2 = Math.floor(Math.random() * samplePoolSize);
//     while (idx1 === idx2) {
//       idx2 = Math.floor(Math.random() * samplePoolSize);
//     }

//     logToFile(`🎲 Random Selection Generated Indices: [Row ${idx1}] and [Row ${idx2}]`);
//     selectedIdentifiers = []; 

//     const targetIndices = [idx1, idx2];

//     for (const idx of targetIndices) {
//       const currentRow = page.locator(".styles__resultsListContainer___3ZRTR").locator(`div[data-test="resultRow"][id="${idx}"]`);
//       // console.log("current row", currentRow);

//       const rowText = await currentRow.innerText();
//       // console.log("row text " , rowText);
//       const cikMatch = rowText.match(/\d{7,10}/); 
//       if (cikMatch) {
//         // console.log("cik", cikMatch);
//         selectedIdentifiers.push(cikMatch[0]);
//         logToFile(`📌 Indexed target CIK token [${cikMatch[0]}] for Row Index ${idx}`);
//       }

//       const rowCheckbox = currentRow.locator('label._checkbox__icon_1xotg_257').first();
//       // force:true skips Playwright's wait-for-actionable check entirely, so
//       // if this row hasn't finished rendering yet it fires against a
//       // not-really-ready checkbox and nothing gets selected. Wait for it to
//       // actually be attached first, then force the check (kept forced since
//       // this is a styled label over a native input, which can otherwise
//       // fail Playwright's own visibility heuristic even when fully ready).
//       await rowCheckbox.waitFor({ state: "attached", timeout: 10000 });
//       await rowCheckbox.check({force : true});
//     }

//     const compareBtn = page.locator('.MultipleResultsView__container___2MSD5').getByRole("button", { name: /Compare/i })
//       .or(page.getByRole("button", { name: "Compare", exact: true }))
//       .first();

//     const compareBtnReady = await compareBtn
//       .waitFor({ state: "visible", timeout: 10000 })
//       .then(() => true)
//       .catch(() => false);

//     if (compareBtnReady) {
//       logToFile(`➔ Triggering Profile Compare Workspace for CIKs: ${JSON.stringify(selectedIdentifiers)}`);
//       await compareBtn.click();

//       // networkidle never fires reliably on this app (the chat widget keeps
//       // a long-poll connection open continuously), so wait for the actual
//       // content instead of "no network activity for 500ms".
//       const avgValuesRow = page.locator('text="Average Values"').or(page.getByRole('cell', { name: "Average Values" })).first();
//       try {
//         await expect(avgValuesRow).toBeVisible({ timeout: 20000 });
//         logToFile("✨ [Primary View] Confirmed layout successfully includes the [Average Values] calculation benchmarks.");
//       } catch {
//         const errorMsg = "🚨 Layout Error: Primary Comparison view failed to load the [Average Values] data segment.";
//         logToFile(errorMsg);
//         resultsSummary.push(errorMsg);
//       }

//       logNetworkSummary(`${tabName} -> Initial Compare Workspace View`);

//       const tabContainer = page.locator('div[data-notice="tab-buttons"]').first();
//       const subTabsLocator = tabContainer.locator('button');

//       // The container mounts before React fills in its buttons, so counting
//       // immediately after mount can read 0 even when sub-tabs are coming.
//       // Wait for the first real button instead of the (possibly still-empty)
//       // container.
//       await subTabsLocator
//         .first()
//         .waitFor({ state: "visible", timeout: 20000 })
//         .catch(() => {
//           logToFile(`⚠️ [${tabName}] No sub-tab buttons appeared within 20s of opening Compare.`);
//         });

//       const subTabCount = await subTabsLocator.count();
//       logToFile(`🔍 Dynamically discovered ${subTabCount} inner comparison data sub-tabs.`);
//       let subTabName: any = "";
//       for (let k = 0; k < subTabCount; k++) {
//         const currentSubTab = subTabsLocator.nth(k);
//          subTabName = (await currentSubTab.innerText())?.trim() || `SubTab_${k}`;

//         logToFile(`   ├── Accessing Compare Sub-View [${k + 1}/${subTabCount}]: ${subTabName}`);
//         await currentSubTab.click();
//         await page.waitForTimeout(1500);
//         logNetworkSummary(`${tabName} -> Sub-Tab: ${subTabName}`);
//       }

//       const resultsWorkspaceTab = page.locator('div, span, li').filter({ hasText: /^Results:/ }).first();
//       if (await resultsWorkspaceTab.isVisible()) {
//         logToFile(`🧹 Navigation rollback to main Results grid...`);
//         await resultsWorkspaceTab.click();
//       }
//     } else {
//       logToFile("⚠️ Master Compare action trigger button was not accessible in the toolbar wrapper.");
//     }
//   }

//   await executeProfileCompare(page, logToFile , "Board Profile and Company");

//   const testStatus = resultsSummary.length > 0 ? "Invalid" : "Valid";
//   const finalDumpString = `Status: ${testStatus}\n` + (resultsSummary.length > 0 ? `Issues:\n- ${resultsSummary.join('\n- ')}` : "All profile comparisons and dual-entity API payloads validated successfully.");

//   try {
//     console.log("final summary\n", finalDumpString);
//     await updateGoogleSheet(finalDumpString, IDENTIFIER);
//     logToFile("\nSuccessfully dumped multi-tab structural findings to Google Sheets.");
//   } catch (err: any) {
//     logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
//   }finally{
//     await closeAllOpenTabs(page);
//   }

//   logToFile("\n--- End of Report ---");
// };


import { Page, expect } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { BpcPage } from "../pages/BpcPage";
import { closeAllOpenTabs, fillAndEnter, getTabText } from "../utils/helpers";

const IDENTIFIER = "bpc_compare";

type IssueRecord = {
  tabName: string;
  subTab: string;
  cikPair: string;
  endpoint: string;
  issueType: "Data Leak" | "API Failure";
  status: number | string;
  detail: string;
};

export const runBpcCompareTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting BPC-Profile Compare Report ---");

  const bpc = new BpcPage(page);
  const searchBtn = bpc.searchBtn;
  let resultsSummary: string[] = [];
  let detailedIssues: IssueRecord[] = [];

  let selectedIdentifiers: string[] = [];
  // Tracks which sub-tab was on screen when an API fired, so a leak/failure
  // can be attributed to a specific view instead of just "somewhere".
  let currentSubTab = "Pre-Compare";
  let currentTabName = "";

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
            const cikPair = `${selectedIdentifiers[0]} vs ${selectedIdentifiers[1]}`;
            matchValidation = ` [❌ Only 1 Company Data Present! Missing CIK: ${missingCik}]`;
            failedApis.push(`${endpoint} (Single-Entity Data Leak)`);
            resultsSummary.push(`🚨 API Payload Flaw: [${endpoint}] contains single-company data. Missing validation for target CIK: ${missingCik}`);
            detailedIssues.push({
              tabName: currentTabName,
              subTab: currentSubTab,
              cikPair,
              endpoint,
              issueType: "Data Leak",
              status,
              detail: `Missing CIK: ${missingCik}`,
            });
          }
        }

        logToFile(`[NET] ✅ API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (OK)${matchValidation}`);
      } else {
        failedApis.push(endpoint);
        const errorBody = await response.text().catch(() => "No response body text");
        const errorLog = `[NET] 🚨 API #${totalApisFired} | Endpoint: ${endpoint} | Status: ${status} (FAILED) | Response: ${errorBody}`;
        
        logToFile(errorLog);
        resultsSummary.push(errorLog);
        detailedIssues.push({
          tabName: currentTabName,
          subTab: currentSubTab,
          cikPair: selectedIdentifiers.length === 2 ? selectedIdentifiers.join(" vs ") : "N/A",
          endpoint,
          issueType: "API Failure",
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
  const textArea = bpc.companyBatchAddTextarea;
  
  await fillAndEnter(page, textArea, "AAPL", 20);
  await fillAndEnter(page, textArea, "MSFT", 20);
  await fillAndEnter(page, textArea, "TSLA", 20);
  await fillAndEnter(page, textArea, "googl", 20);
  await fillAndEnter(page, textArea, "AMZN", 20);
  await fillAndEnter(page, textArea, "META", 20);
  await page.locator(".PopupFooter__popup__footer___20Bi-").getByRole("button", { name: "OK" }).first().click({ force: true });
  await page.waitForTimeout(2000);
  await bpc.companyPopupOkBtn.click();
  
  await searchBtn.click();
  //await page.waitForLoadState("networkidle");
  //logNetworkSummary("Initial Search Page Load");

  await getTabText(page, 0, logToFile, false);

  async function executeProfileCompare(page: Page, logToFile: Function, tabName: string) {
    currentTabName = tabName;
    currentSubTab = "Pre-Compare";
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
      // force:true skips Playwright's wait-for-actionable check entirely, so
      // if this row hasn't finished rendering yet it fires against a
      // not-really-ready checkbox and nothing gets selected. Wait for it to
      // actually be attached first, then force the check (kept forced since
      // this is a styled label over a native input, which can otherwise
      // fail Playwright's own visibility heuristic even when fully ready).
      await rowCheckbox.waitFor({ state: "attached", timeout: 10000 });
      await rowCheckbox.check({force : true});
    }

    const compareBtn = page.locator('.MultipleResultsView__container___2MSD5').getByRole("button", { name: /Compare/i })
      .or(page.getByRole("button", { name: "Compare", exact: true }))
      .first();

    const compareBtnReady = await compareBtn
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (compareBtnReady) {
      logToFile(`➔ Triggering Profile Compare Workspace for CIKs: ${JSON.stringify(selectedIdentifiers)}`);
      currentSubTab = "Initial Compare Workspace";
      await compareBtn.click();

      // networkidle never fires reliably on this app (the chat widget keeps
      // a long-poll connection open continuously), so wait for the actual
      // content instead of "no network activity for 500ms".
      const avgValuesRow = page.locator('text="Average Values"').or(page.getByRole('cell', { name: "Average Values" })).first();
      try {
        await expect(avgValuesRow).toBeVisible({ timeout: 20000 });
        logToFile("✨ [Primary View] Confirmed layout successfully includes the [Average Values] calculation benchmarks.");
      } catch {
        const errorMsg = "🚨 Layout Error: Primary Comparison view failed to load the [Average Values] data segment.";
        logToFile(errorMsg);
        resultsSummary.push(errorMsg);
      }

      logNetworkSummary(`${tabName} -> Initial Compare Workspace View`);

      const tabContainer = page.locator('div[data-notice="tab-buttons"]').first();
      const subTabsLocator = tabContainer.locator('button');

      // The container mounts before React fills in its buttons, so counting
      // immediately after mount can read 0 even when sub-tabs are coming.
      // Wait for the first real button instead of the (possibly still-empty)
      // container.
      await subTabsLocator
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .catch(() => {
          logToFile(`⚠️ [${tabName}] No sub-tab buttons appeared within 20s of opening Compare.`);
        });

      const subTabCount = await subTabsLocator.count();
      logToFile(`🔍 Dynamically discovered ${subTabCount} inner comparison data sub-tabs.`);
      let subTabName: any = "";
      for (let k = 0; k < subTabCount; k++) {
        const subTabBtn = subTabsLocator.nth(k);
        subTabName = (await subTabBtn.innerText())?.trim() || `SubTab_${k}`;

        logToFile(`   ├── Accessing Compare Sub-View [${k + 1}/${subTabCount}]: ${subTabName}`);
        // Set BEFORE the click so any APIs fired as this sub-tab loads get
        // attributed to it, not to whichever sub-tab was active before.
        currentSubTab = subTabName;
        await subTabBtn.click();
        await page.waitForTimeout(1500);
        logNetworkSummary(`${tabName} -> Sub-Tab: ${subTabName}`);
      }

      const resultsWorkspaceTab = page.locator('div, span, li').filter({ hasText: /^Results:/ }).first();
      if (await resultsWorkspaceTab.isVisible()) {
        logToFile(`🧹 Navigation rollback to main Results grid...`);
        await resultsWorkspaceTab.click();
      }
    } else {
      logToFile("⚠️ Master Compare action trigger button was not accessible in the toolbar wrapper.");
    }
  }

  await executeProfileCompare(page, logToFile , "Board Profile and Company");

  const testStatus = detailedIssues.length > 0 ? "Invalid" : "Valid";

  const buildFinalDumpString = () => {
    if (detailedIssues.length === 0) {
      return `Status: Valid\nAll profile comparisons and dual-entity API payloads validated successfully.`;
    }

    const lines: string[] = [];
    lines.push(`Status: ${testStatus}`);
    lines.push(`Total Issues: ${detailedIssues.length}`);
    lines.push("");

    // // Quick-scan table — tab-separated so it pastes into Sheets as columns.
    // lines.push(["Tab", "Sub-Tab", "CIK Pair", "Endpoint", "Issue Type", "Status", "Detail"].join("\t"));
    // for (const issue of detailedIssues) {
    //   lines.push(
    //     [issue.tabName, issue.subTab, issue.cikPair, issue.endpoint, issue.issueType, issue.status, issue.detail].join("\t")
    //   );
    // }
    // lines.push("");

    // Grouped-by-subtab breakdown for readability.
    const bySubTab = new Map<string, IssueRecord[]>();
    for (const issue of detailedIssues) {
      const key = `${issue.tabName} > ${issue.subTab}`;
      if (!bySubTab.has(key)) bySubTab.set(key, []);
      bySubTab.get(key)!.push(issue);
    }

    //lines.push("Breakdown by Sub-Tab:");
    for (const [subTabKey, issues] of bySubTab) {
      lines.push(`\n[${subTabKey}] — ${issues.length} issue(s)`);
      for (const issue of issues) {
        const icon = issue.issueType === "Data Leak" ? "⚖️❌" : "🚨";
        lines.push(`  ${icon} ${issue.issueType} | CIKs: ${issue.cikPair} | Endpoint: ${issue.endpoint} | Status: ${issue.status} | ${issue.detail}`);
      }
    }

    return lines.join("\n");
  };

  const finalDumpString = buildFinalDumpString();

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