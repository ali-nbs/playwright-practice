import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
  getTargetDateString,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_crossReferenceLinks";

export const runCrossReferenceLinksTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Cross Reference Links Test ---");

  const sf = new SfPage(page);

  let tabIndex = 0;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];
  let findings = { text: "No Results Found", isValid: true };

  const searchBtn = sf.searchBtn;

  await sf.clearFilters();
  await page.waitForTimeout(500);
  let exhibitsCheckbox = sf.exhibitsToFilingsLabel;
  await exhibitsCheckbox.uncheck();
  await page.waitForTimeout(300);
  const dateInput = sf.dateInputByTestId;
  await sf.fillAndEnter(sf.dateInput, getTargetDateString());
  await sf.searchBtn.click();

  const searchResultTextOnly = await sf.getTabText(tabIndex++, logToFile);
  logToFile(`Baseline: ${searchResultTextOnly}`);

  if (searchResultTextOnly.includes("Docs")) {
    await sf.configureDisplayColumns(
      {
        "Filing Info": ["Intelligize ID"],
        "Company Info": [],
      },
      {
        enableSnippets: true,
        enableCrossReferenceLinks: true,
      },
    );

    await page.waitForTimeout(500);
    const docsCount = parseCount(searchResultTextOnly);
    //  await page.pause();
    actualTarget = Math.min(docsCount, 2);
    findings = await scrapeResults(actualTarget, 0, page, logToFile);
    await sf.closeAllOpenTabs();
  }
  const scenarioBlock = [
    `Doc Count: ${actualTarget}`,
    `Exhbits to Filings: Disabled`,
    `Snippets: Enabled`,
    `Cross Reference Links: Enabled`,
    `Results:`,
    findings.text,
    ``,
    `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
  ].join("\n");

  allScenarioResults.push(scenarioBlock);
  await sf.clearFilters();

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
    await sf.closeAllOpenTabs();
  }
};

const scrapeResults = async (
  targetCount: number,
  targetDocViewerCount: number = 0,
  page: Page,
  logToFile: Function,
) => {
  const sf = new SfPage(page);
  let rowsData: string[] = [];
  let isScenarioValid = true;
  let resultsFound = 0;

  await sf.forEachRow(
    targetCount,
    async (row) => {
      try {
        const allpTags = row.locator("p");
        const { spans: cleanContent } = await sf.rowData(row);

        const intelligizeIdIndex = cleanContent.findIndex(
          (item) => item === "Intelligize ID",
        );

        const intelligizeId =
          intelligizeIdIndex !== -1
            ? cleanContent[intelligizeIdIndex + 1]
            : undefined;

        const formType = cleanContent[2];

        console.log(
          `Row: ${resultsFound + 1} || Intelligize ID: ${intelligizeId} `,
        );

        const targetedLink = allpTags
          .locator('a[href*="/SecuritiesRegulationAndCompliance?"]')
          .first();
        if (await targetedLink.isVisible()) {
          console.log("Found the Securities Regulation link!");
        } else {
          isScenarioValid = false;
          rowsData.push(
            `Intelligize ID: ${intelligizeId} | FormType ${formType} -> on Result Grid -> missing highlighting of the Cross Reference link.`,
          );
        }

        if (targetDocViewerCount > 0 && resultsFound < targetDocViewerCount) {
          const viewBtn = sf.viewButton(row).first();
          if (await viewBtn.isVisible()) {
            await viewBtn.click();
            await page.waitForTimeout(1000);

            const docFrame = sf.documentFrame;
            await docFrame
              .locator("body")
              .waitFor({ state: "visible", timeout: 15000 });
            await docFrame
              .locator(".cross-reference-anchor")
              .first()
              .waitFor({ state: "attached", timeout: 15000 })
              .catch(() => {});
            const crossReferenceLinksCount = await docFrame
              .locator(".cross-reference-anchor")
              .count();

            console.log(
              `Cross Reference Links found: ${crossReferenceLinksCount}`,
            );
            if (crossReferenceLinksCount === 0) {
              isScenarioValid = false;
              rowsData.push(
                `Intelligize ID: ${intelligizeId} | FormType ${formType} -> in Document Viewer -> missing highlighting of cross-reference links.`,
              );
            }
            const activeTab = sf
              .resultTabsMatching(["Docs:", "No Results Found"])
              .first();
            if (await activeTab.isVisible()) {
              await activeTab.click();
            }
          }
        }
      } catch (e: any) {
        // Preserve original behavior: swallow row-level errors, still count
        // the row as processed and return to the results grid below.
      } finally {
        resultsFound++;
        const activeTab = sf
          .resultTabsMatching(["Docs:", "No Results Found"])
          .first();
        if (await activeTab.isVisible()) {
          await activeTab.click();
        }
        await page.waitForTimeout(700);
      }
    },
  );

  console.log(`Successfully scraped ${resultsFound} rows.`);
  return { text: rowsData.join("\n"), isValid: isScenarioValid };
};
