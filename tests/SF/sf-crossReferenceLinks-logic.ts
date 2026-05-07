import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  getTabText,
  parseCount,
  closeAllOpenTabs,
  configureDisplayColumns,
} from "../utils/helpers";

const IDENTIFIER = "sf_crossReferenceLinks";

export const runCrossReferenceLinksTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Cross Reference Links Test ---");

  let tabIndex = 0;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];
  let findings = { text: "No Results Found", isValid: true };

  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });
  const searchBtn = page.getByRole("button", { name: /^Search$/i });

  await clearBtn.click();
  await page.waitForTimeout(500);
  let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
  await exhibitsCheckbox.click();
  await page.waitForTimeout(300);
  await searchBtn.click();

  const searchResultTextOnly = await getTabText(page, tabIndex++, logToFile);
  logToFile(`Baseline: ${searchResultTextOnly}`);

  if (searchResultTextOnly.includes("Docs")) {
    await configureDisplayColumns(
      page,
      {
        "Filing Info": ["Accession #"],
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
    actualTarget = Math.min(docsCount, 25);
    findings = await scrapeResults(actualTarget, 4, page, logToFile);
    await closeAllOpenTabs(page);
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
  await clearBtn.click();

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

const scrapeResults = async (
  targetCount: number,
  targetDocViewerCount: number = 0,
  page: Page,
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
        let AccessionNumber = "N/A";
        try {
          const allSpantexts = await row.locator("span").allInnerTexts();
          const allpTags = await row.locator("p");
          const cleanContent = allSpantexts
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          console.log("---------------------------------------------");
          //   for (const [index, text] of cleanContent.entries()) {
          //     console.log(index, text);
          //   }
          console.log("-------------------------------------------");

          const accessionNo =
            cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
            "N/A";

          console.log(
            `Row: ${resultsFound + 1} || Accession ID: ${accessionNo} `,
          );

          const targetedLink = allpTags
            .locator('a[href*="/SecuritiesRegulationAndCompliance?"]')
            .first();
          if (await targetedLink.isVisible()) {
            console.log("Found the Securities Regulation link!");
          } else {
            isScenarioValid = false;
            rowsData.push(
              `Accession ${accessionNo} on Result Grid -> missing highlighting of the Cross Reference link.`,
            );
            logToFile(
              `❌ Row ${resultsFound + 1}: Accession ${accessionNo} on Result Grid -> missing highlighting of the Cross Reference link.`,
            );
          }

          if (targetDocViewerCount > 0 && resultsFound < targetDocViewerCount) {
            const viewBtn = row.getByRole("button", { name: /View/i }).first();
            if (await viewBtn.isVisible()) {
              await viewBtn.click();
              await page.waitForTimeout(1000);
              const docFrame = page.frameLocator("iframe").first();
              await docFrame
                .locator("body")
                .waitFor({ state: "visible", timeout: 15000 });
              const crossReferenceLinksCount = await docFrame
                .locator(".cross-reference-anchor")
                .count();
              console.log(
                `Cross Reference Links found: ${crossReferenceLinksCount}`,
              );
              if (crossReferenceLinksCount === 0) {
                isScenarioValid = false;
                logToFile(
                  `❌ Accession ${accessionNo} is missing cross-reference links.`,
                );
                rowsData.push(
                  `Accession ${accessionNo} in Document Viewer -> missing highlighting of cross-reference links.`,
                );
              } else {
                logToFile(
                  `✅ Accession ${accessionNo} has ${crossReferenceLinksCount} cross-reference links.`,
                );
              }
              const activeTab = page
                .locator(
                  '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
                )
                .first();

              if (await activeTab.isVisible()) {
                await activeTab.click();
              }
            }
          }
        } catch (e: any) {
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

    if (resultsFound < targetCount) {
      await page.waitForTimeout(500);
      await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
    }
  }

  console.log(`Successfully scraped ${resultsFound} rows.`);
  return { text: rowsData.join("\n"), isValid: isScenarioValid };
};
