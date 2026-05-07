import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  ensureLoggedIn,
  fillAndEnter,
  getTabText,
  parseCount,
  closeAllOpenTabs,
  configureDisplayColumns,
  closeTabsToTheRight,
} from "../utils/helpers";

const IDENTIFIER = "aoe_accountantMapping";

export const runAccountantMappingTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting AOE-Accountant Report ---");

  const testCases = [
    {
      id: 1,
      lawFirm: "Dykema Gossett",
      date: "Yesterday",
      resultGridVerificationCount: 25,
      docViewerVerificationCount: 3,
      searchThroughPopup: false,
      firmGroup: "AmLaw 200",
    },
    {
      id: 2,
      lawFirm: "Field Law Firm",
      date: "Yesterday",
      resultGridVerificationCount: 25,
      docViewerVerificationCount: 3,
      searchThroughPopup: true,
      firmGroup: "",
    },
    {
      id: 3,
      lawFirm: "ArentFox Schiff",
      date: "Yesterday",
      resultGridVerificationCount: 25,
      docViewerVerificationCount: 3,
      searchThroughPopup: true,
      firmGroup: "AmLaw 200",
    },
  ];

  let tabIndex = 0;
  let selectCheckboxes = true;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];

  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });
  const searchBtn = page.getByRole("button", { name: /^Search$/i });

  const lawFirmInput = page.getByTestId("lawFirm-input");
  const lawFirmFilterBlock = page
    .locator("div.styles__focusContainer___13rFy")
    .filter({
      hasText: /^Law Firm \(name appears in document\)$/,
    });
  const lawFirmFilter = page.getByLabel("Law Firm (name appears in document)");

  const lawFirmPlusBtn = lawFirmFilterBlock.locator("span._icon_1jkal_249");
  const lawFirmModal = page
    .locator("div.PopupContainer__container___1-tgp")
    .first();
  const lawFirmSearchInput = lawFirmModal.locator("input").first();

  for (const scenario of testCases) {
    await clearBtn.click();
    await page.waitForTimeout(1000);
    let findings = { text: "No Results Found", isValid: true };

    if (scenario.searchThroughPopup) {
      await lawFirmPlusBtn.click();
      await page.waitForTimeout(500);

      if (scenario.firmGroup !== "") {
        // await page.pause();
        const modal = page.locator("div.PopupBody__popup__body___1J_d3");

        await modal.getByText(scenario.firmGroup, { exact: true }).click();
        // await page.pause();
      }

      await fillAndEnter(page, lawFirmSearchInput, scenario.lawFirm);
      await page.waitForTimeout(1000);

      const targetRow = lawFirmModal
        .locator("li")
        .filter({ hasText: scenario.lawFirm });

      const checkbox = targetRow.locator(
        'label[class*="checkbox-container"] label',
      );

      await checkbox.click();

      await lawFirmModal.locator('button:has-text("OK")').click();
    } else {
      await page.waitForTimeout(500);
      await fillAndEnter(page, lawFirmInput, scenario.lawFirm, 200);
    }

    // continue;

    await searchBtn.click();

    const searchResultTextOnly = await getTabText(page, 0, logToFile);
    logToFile(`Baseline (${scenario.id}): ${searchResultTextOnly}`);

    if (searchResultTextOnly.includes("Docs")) {
      if (selectCheckboxes) {
        await configureDisplayColumns(page, {
          "Filing Info": ["Intelligize ID"],
          "Company Info": [],
          "Deal Points": ["Law Firms"],
        });
        selectCheckboxes = false;
      }
      await page.waitForTimeout(500);
      const docsCount = parseCount(searchResultTextOnly);
      //  await page.pause();
      actualTarget = Math.min(
        scenario.resultGridVerificationCount,
        docsCount,
        20,
      );

      findings = await scrapeResults(
        actualTarget,
        scenario.docViewerVerificationCount,
        page,
        scenario.lawFirm,
        logToFile,
      );
      //  await page.pause();
      await closeAllOpenTabs(page);
    }
    const scenarioBlock = [
      `Doc Count: ${actualTarget}`,
      `Law Firm: ${scenario.lawFirm}`,
      `Results:`,
      findings.text,
      ``,
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);
    await clearBtn.click();
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );

  try {
    console.log("Final Dump:\n", finalDump);
    await updateGoogleSheet(finalDump, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  } finally {
    logToFile("\n--- End of AOE-Accountant Report ---");
    await closeAllOpenTabs(page);
  }
};
// const scrapeResults = async (
//   targetCount: number,
//   targetDocViewerCount: number = 0,
//   page: Page,
//   targetLawFirm: string,
//   logToFile: Function,
// ) => {
//   let resultsFound = 0;
//   const processedIds = new Set<string>();
//   let rowsData: string[] = [];
//   let isScenarioValid = true;
//   let index = 0;
//   while (resultsFound < targetCount || resultsFound == 24) {
//     const scroller = page.locator(".ReactVirtualized__Grid").last();
//     const rows = scroller.locator('div[data-test="resultRow"]');
//     const visibleRowCount = await rows.count();

//     if (visibleRowCount === 0) {
//       await page.waitForTimeout(500);
//       continue;
//     }

//     for (let i = 0; i < visibleRowCount; i++) {
//       const row = rows.nth(i);
//       const rowId = await row.getAttribute("id");

//       if (rowId && !processedIds.has(rowId)) {
//         try {
//           const texts = await row.locator("span").allInnerTexts();
//           const cleanContent = texts
//             .map((t) => t.trim())
//             .filter((t) => t.length > 0);
//           console.log("---------------------------------------------");
//           for (const [index, text] of cleanContent.entries()) {
//             console.log(index, text);
//           }
//           console.log("-------------------------------------------");
//           // 1. Find ALL accession indexes (because duplicates exist)
//           const accessionIndexes = cleanContent
//             .map(
//               (text, i) =>
//                 /^Accession\s*#$/i.test(text) ||
//                 /^Accession\s*#\s*/i.test(text),
//             )
//             .map((match, i) => (match ? i : -1))
//             .filter((i) => i !== -1);

//           // fallback: also match actual accession number pattern
//           const accessionNoIndex = cleanContent.findIndex((text) =>
//             /^\d{10}-\d{2}-\d{6}$/.test(text),
//           );

//           const accessionNo =
//             accessionNoIndex !== -1 ? cleanContent[accessionNoIndex] : "N/A";

//           // 2. Get LAST meaningful accession section start
//           const lastAccessionHeaderIndex =
//             accessionIndexes.length > 0
//               ? accessionIndexes[accessionIndexes.length - 1]
//               : accessionNoIndex;

//           // 3. Final base index (acc no line usually comes 1 step after header)
//           const baseIndex =
//             lastAccessionHeaderIndex !== -1
//               ? lastAccessionHeaderIndex + 1
//               : accessionNoIndex;

//           // 4. Law firms start after +2
//           const lawFirmStartIndex = baseIndex !== -1 ? baseIndex + 1 : -1;

//           // 5. Extract law firms till end
//           const lawFirmsRaw =
//             lawFirmStartIndex !== -1
//               ? cleanContent.slice(lawFirmStartIndex)
//               : [];

//           console.log("baseIndex:", baseIndex);
//           console.log("lawFirmStartIndex:", lawFirmStartIndex);
//           console.log("lawFirmsRaw:", lawFirmsRaw);

//           //continue;
//           const isMatch = lawFirmsRaw.some((firm) =>
//             firm.toLowerCase().includes(targetLawFirm.toLowerCase()),
//           );

//           const isLineMissingData =
//             accessionNo === "N/A" || lawFirmsRaw.length === 0;

//           if (isLineMissingData) {
//             isScenarioValid = false;
//             rowsData.push(
//               `❌ MISSING DATA >> Acc.No: ${accessionNo} | lawFirms: ${lawFirmsRaw}`,
//             );
//           } else if (!isMatch) {
//             isScenarioValid = false;
//             rowsData.push(
//               `❌ WRONG AUDITOR >> Acc.No: ${accessionNo} | lawFirms: ${lawFirmsRaw.join(", ")}`,
//             );
//           } else {
//             rowsData.push(
//               `Acc.No: ${accessionNo} | lawFirms: ${lawFirmsRaw.join(", ")}`,
//             );
//           }
//           console.log(
//             `Acc.No: ${accessionNo} || Law Firm: ${lawFirmsRaw.join(", ")}`,
//           );

//           await row.locator("span", { hasText: targetLawFirm }).first().click();
//           const highlightedFirm = page
//             .locator(".SnippetContent-styles__wrapper___ZxZH_")
//             .locator("span", { hasText: targetLawFirm });

//           await expect(highlightedFirm).toHaveCSS(
//             "background-color",
//             "rgb(255, 255, 0)",
//           );
//           await expect(highlightedFirm).toHaveCSS("font-weight", "700");
//           const viewBtn = page
//             .locator(".SnippetContent-styles__wrapper___ZxZH_")
//             .getByRole("button", { name: /view in document/i })
//             .first();
//           await expect(viewBtn).toBeVisible({ timeout: 7000 });
//           await viewBtn.click();
//           await getTabText(page, 1, logToFile);
//           const searchInDoc = page
//             .locator(".styles__document-view___2Bvgv")
//             .getByPlaceholder("Search")
//             .first();

//           await fillAndEnter(page, searchInDoc, targetLawFirm, 200);
//           const resultCount = page.locator(
//             'span[class*="KeywordFinder__keyword-search__matches"]',
//           );

//           const text = await resultCount.innerText();
//           console.log(`Search progress: ${text}  -> ${text.split("/")[1]}`);
//           const docFrame = page.frameLocator("iframe").first();

//           // 2. Look for the instances INSIDE that frame
//           const highlightedInstances = docFrame
//             .locator(".info-panel-reference")
//             .filter({
//               hasText: targetLawFirm,
//             });

//           const highlightedCount = await highlightedInstances.count();
//           console.log(
//             `Highlighted instances found in doc: ${highlightedCount}`,
//           );
//           await closeTabsToTheRight(page);
//           //  await page.pause();
//           console.log("```````````````````````````````````````");
//           processedIds.add(rowId);
//           await page.waitForTimeout(700);
//           resultsFound++;
//         } catch (e) {
//           console.log(`Skipping Row ${rowId} due to re-render.`);
//         }
//       }

//       if (resultsFound >= targetCount) break;
//     }

//     if (resultsFound < targetCount) {
//       await page.waitForTimeout(500);
//       await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
//       //  await rows.last().scroll({ block: "start" });
//       await page.waitForTimeout(500);
//     }
//   }
//   console.log(`Successfully scraped ${resultsFound} rows.`);
//   return {
//     text: rowsData.join("\n"),
//     isValid: isScenarioValid,
//   };
// };

//////////////////////////////////////////////////////////////////////////////
/////////////////////// WORK WITH DOC VIEWER BUT STUCK ON IF FAILED //////////
//////////////////////////////////////////////////////////////////////////////
// const scrapeResults = async (
//   targetCount: number,
//   targetDocViewerCount: number = 0,
//   page: Page,
//   targetLawFirm: string,
//   logToFile: Function,
// ) => {
//   let resultsFound = 0;
//   const processedIds = new Set<string>();
//   let rowsData: string[] = [];
//   let isScenarioValid = true;

//   while (resultsFound < targetCount || resultsFound === 24) {
//     const scroller = page.locator(".ReactVirtualized__Grid").last();
//     const rows = scroller.locator('div[data-test="resultRow"]');

//     const visibleRowCount = await rows.count();

//     if (visibleRowCount === 0) {
//       await page.waitForTimeout(500);
//       continue;
//     }

//     for (let i = 0; i < visibleRowCount; i++) {
//       const row = rows.nth(i);
//       const rowId = await row.getAttribute("id");

//       if (rowId && !processedIds.has(rowId)) {
//         try {
//           // ---------------------------
//           // YOUR ORIGINAL PARSING LOGIC
//           // ---------------------------
//           const texts = await row.locator("span").allInnerTexts();
//           const cleanContent = texts.map((t) => t.trim()).filter(Boolean);

//           const accessionIndexes = cleanContent
//             .map(
//               (text) =>
//                 /^Accession\s*#$/i.test(text) ||
//                 /^Accession\s*#\s*/i.test(text),
//             )
//             .map((match, i) => (match ? i : -1))
//             .filter((i) => i !== -1);

//           const accessionNoIndex = cleanContent.findIndex((text) =>
//             /^\d{10}-\d{2}-\d{6}$/.test(text),
//           );

//           const accessionNo =
//             accessionNoIndex !== -1 ? cleanContent[accessionNoIndex] : "N/A";

//           const lastAccessionHeaderIndex =
//             accessionIndexes.length > 0
//               ? accessionIndexes[accessionIndexes.length - 1]
//               : accessionNoIndex;

//           const baseIndex =
//             lastAccessionHeaderIndex !== -1
//               ? lastAccessionHeaderIndex + 1
//               : accessionNoIndex;

//           const lawFirmStartIndex = baseIndex !== -1 ? baseIndex + 1 : -1;

//           const lawFirmsRaw =
//             lawFirmStartIndex !== -1
//               ? cleanContent.slice(lawFirmStartIndex)
//               : [];

//           const isMatch = lawFirmsRaw.some((firm) =>
//             firm.toLowerCase().includes(targetLawFirm.toLowerCase()),
//           );

//           const isLineMissingData =
//             accessionNo === "N/A" || lawFirmsRaw.length === 0;

//           if (isLineMissingData) {
//             isScenarioValid = false;
//             rowsData.push(
//               `❌ MISSING DATA >> Acc.No: ${accessionNo} | lawFirms: ${lawFirmsRaw}`,
//             );
//           } else if (!isMatch) {
//             isScenarioValid = false;
//             rowsData.push(
//               `❌ WRONG AUDITOR >> Acc.No: ${accessionNo} | lawFirms: ${lawFirmsRaw.join(", ")}`,
//             );
//           } else {
//             rowsData.push(
//               `Acc.No: ${accessionNo} | lawFirms: ${lawFirmsRaw.join(", ")}`,
//             );
//           }

//           console.log(
//             `Acc.No: ${accessionNo} || Law Firm: ${lawFirmsRaw.join(", ")}`,
//           );

//           if (targetDocViewerCount > 0 && resultsFound < targetDocViewerCount) {
//             await row
//               .locator("span", { hasText: targetLawFirm })
//               .first()
//               .click();

//             const highlightedFirm = page
//               .locator(".SnippetContent-styles__wrapper___ZxZH_")
//               .locator("span", { hasText: targetLawFirm });

//             await expect(highlightedFirm).toHaveCSS(
//               "background-color",
//               "rgb(255, 255, 0)",
//             );
//             await expect(highlightedFirm).toHaveCSS("font-weight", "700");

//             const viewBtn = page
//               .locator(".SnippetContent-styles__wrapper___ZxZH_")
//               .getByRole("button", { name: /view in document/i })
//               .first();

//             await expect(viewBtn).toBeVisible({ timeout: 7000 });
//             await viewBtn.click();

//             // const searchInDoc = page
//             //   .locator(".styles__document-view___2Bvgv")
//             //   .getByPlaceholder("Search")
//             //   .first();
//             const docViewWrapper = page
//               .locator(".styles__document-view___2Bvgv")
//               .first();
//             await docViewWrapper.waitFor({ state: "visible", timeout: 15000 });

//             console.log(
//               "count of doc view search inputs: ",
//               await page.locator(".styles__document-view___2Bvgv").count(),
//             );

//             // 2. TARGET THE INPUT SPECIFICALLY using the Name attribute seen in your screenshot
//             console.log("Locating search input in document...");
//             // This is much more reliable than generic class names
//             const searchInDoc = docViewWrapper
//               .getByPlaceholder("Search")
//               .first();

//             await fillAndEnter(page, searchInDoc, targetLawFirm, 200);

//             const resultCount = page.locator(
//               'span[class*="KeywordFinder__keyword-search__matches"]',
//             );

//             const text = await resultCount.innerText();
//             console.log(`Search progress: ${text} -> ${text.split("/")[1]}`);

//             const docFrame = page.frameLocator("iframe").first();

//             const highlightedInstances = docFrame
//               .locator(".info-panel-reference")
//               .filter({ hasText: targetLawFirm });

//             console.log(
//               `Highlighted instances found: ${await highlightedInstances.count()}`,
//             );

//             await closeTabsToTheRight(page);
//             await page.waitForTimeout(700);
//           }

//           processedIds.add(rowId);
//           resultsFound++;
//         } catch (e) {
//           console.log(`Skipping Row ${rowId} due to re-render.`);
//         }
//       }

//       if (resultsFound >= targetCount) break;
//     }
//     if (resultsFound < targetCount) {
//       await page.waitForTimeout(500);

//       const rows = scroller.locator('div[data-test="resultRow"]');

//       await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));

//       await page.waitForTimeout(500);
//     }
//   }

//   console.log(`Successfully scraped ${resultsFound} rows.`);

//   return {
//     text: rowsData.join("\n"),
//     isValid: isScenarioValid,
//   };
// };

////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////

const scrapeResults = async (
  targetCount: number,
  targetDocViewerCount: number = 0,
  page: Page,
  targetLawFirm: string,
  logToFile: Function,
) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount || resultsFound === 24) {
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
        let navigationState: "GRID" | "SNIPPET" | "DOC" = "GRID";
        let intelligizeId = "N/A";
        try {
          // --- ORIGINAL PARSING LOGIC ---
          const texts = await row.locator("span").allInnerTexts();
          const cleanContent = texts.map((t) => t.trim()).filter(Boolean);

          console.log("---------------------------------------------");
          // for (const [index, text] of cleanContent.entries()) {
          //   console.log(index, text);
          // }
          console.log("-------------------------------------------");

          const intelligizeIdIndex = cleanContent.findIndex((text) =>
            /^\d{8}$/.test(text),
          );
          intelligizeId =
            intelligizeIdIndex !== -1
              ? cleanContent[intelligizeIdIndex]
              : "N/A";

          // (Your index calculation logic here...)
          const isMatch = cleanContent.some((t) =>
            t.toLowerCase().includes(targetLawFirm.toLowerCase()),
          );

          // --- ORIGINAL rowsData.push LOGIC ---
          if (intelligizeId === "N/A") {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> Intelligize ID: ${intelligizeId}`,
            );
          } else if (!isMatch) {
            isScenarioValid = false;
            rowsData.push(
              `❌ WRONG AUDITOR >> Intelligize ID: ${intelligizeId}`,
            );
          } else {
            rowsData.push(
              `Intelligize ID: ${intelligizeId} | lawFirms matching: ${targetLawFirm}`,
            );
          }

          console.log(
            `Row: ${resultsFound + 1} || Intelligize ID: ${intelligizeId} || Target Firm: ${targetLawFirm}`,
          );

          // --- INTERACTION LOGIC ---
          if (targetDocViewerCount > 0 && resultsFound < targetDocViewerCount) {
            // // 1. Open Snippet
            // await row
            //   .locator("span", { hasText: targetLawFirm })
            //   .first()
            // //   .click({ timeout: 5000 });
            // await row.evaluate((el) => el.scrollIntoView({ block: "start" }));
            // await page.waitForTimeout(300);

            const firmLink = row
              .locator("span", { hasText: targetLawFirm })
              .first();
            // await firmLink.click({ force: true, timeout: 15000 }).catch((e) => {
            //   throw new Error(
            //     `GRID ERROR: Click failed - ${e.message.split("\n")[0]}`,
            //   );
            // });
            await firmLink
              .evaluate((el) => {
                el.dispatchEvent(
                  new MouseEvent("click", {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                  }),
                );
              })
              .catch((e) => {
                throw new Error(
                  `GRID ERROR: Dispatch failed - ${e.message.split("\n")[0]}`,
                );
              });

            navigationState = "SNIPPET";
            const snippetWrapper = page.locator(
              ".SnippetContent-styles__wrapper___ZxZH_",
            );
            await snippetWrapper
              .waitFor({ state: "visible", timeout: 8000 })
              .catch(() => {
                throw new Error("Snippet container didn't open");
              });

            const highlightedFirm = page
              .locator(".SnippetContent-styles__wrapper___ZxZH_")
              .locator("span", { hasText: targetLawFirm });

            // Customized Error for Snippet
            await expect(highlightedFirm)
              .toHaveCSS("background-color", "rgb(255, 255, 0)", {
                timeout: 5000,
              })
              .catch(() => {
                throw new Error(
                  "Highlight Missing or Incorrect Lawfirm in Snippet",
                );
              });

            // 2. Open Document
            const viewBtn = page
              .locator(".SnippetContent-styles__wrapper___ZxZH_")
              .getByRole("button", { name: /view in document/i })
              .first();
            await expect(viewBtn)
              .toBeVisible({ timeout: 5000 })
              .catch(() => {
                throw new Error("View Button Missing");
              });
            await viewBtn.click();
            navigationState = "DOC";

            // 3. Document Search
            const docViewWrapper = page
              .locator(".styles__document-view___2Bvgv")
              .first();
            await docViewWrapper
              .waitFor({ state: "visible", timeout: 15000 })
              .catch(() => {
                throw new Error("Doc Load Timeout");
              });

            const searchInDoc = docViewWrapper
              .getByPlaceholder("Search")
              .first();
            await fillAndEnter(page, searchInDoc, targetLawFirm, 200);

            const resultCount = page.locator(
              'span[class*="KeywordFinder__keyword-search__matches"]',
            );
            const text = await resultCount.innerText();
            console.log(`Search progress: ${text}`);

            const docFrame = page.frameLocator("iframe").first();
            const count = await docFrame
              .locator(".info-panel-reference")
              .filter({ hasText: targetLawFirm })
              .count();
            console.log(`Highlighted instances found: ${count}`);

            // if (parseInt(text.split("/")[1]) !== count) {
            //   throw new Error(
            //     `Doc Viewer count mismatch: expected ${count}, got ${text.split("/")[1]}`,
            //   );
            // }
          }

          // Mark as successful
        } catch (e: any) {
          // --- CUSTOM ERROR HANDLING ---
          const customMsg = e.message.split("\n")[0];
          console.log(`Error at ${navigationState}: ${customMsg}`);

          if (navigationState == "SNIPPET") {
            await page
              .locator(".SnippetContent-styles__wrapper___ZxZH_")
              .locator("button._btn_1tq6r_306")
              .first()
              .click({ timeout: 3000 })
              .catch(() => {
                console.log(
                  "Snippet close button not found or already closed.",
                );
              });
          }
          rowsData.push(
            `❌ ${navigationState} ERROR >> ${customMsg} (ID: ${intelligizeId})`,
          );
          isScenarioValid = false;
        } finally {
          processedIds.add(rowId);
          resultsFound++;
          const activeTab = page
            .locator(
              '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
            )
            .first();

          if (await activeTab.isVisible()) {
            await activeTab.click();
          }
          await page.waitForTimeout(700);
        }
      }
      if (resultsFound >= targetCount) break;
    }

    // --- SCROLLING ---
    if (resultsFound < targetCount) {
      await page.waitForTimeout(500);
      await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
    }
  }

  console.log(`Successfully scraped ${resultsFound} rows.`);
  return { text: rowsData.join("\n"), isValid: isScenarioValid };
};
