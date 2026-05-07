import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  fillAndEnter,
  getTabText,
  parseCount,
  closeAllOpenTabs,
  configureDisplayColumns,
  parseCurrency,
} from "../utils/helpers";

const IDENTIFIER = "dbm_analytics";

export const runDBMAnalyticsTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting DBM Analytics Report ---");

  let tabIndex = 0;
  let selectCheckboxes = true;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];

  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });
  const searchBtn = page.getByRole("button", { name: /^Search$/i });

  const dateInput = page.getByTestId("date-input");
  const searchDate = "Yesterday";
  const sectionTypeInput = page.getByTestId("sectionType-input");

  await clearBtn.click();
  await page.waitForTimeout(1000);
  let findings = { text: "No Results Found", isValid: true };

  await fillAndEnter(page, dateInput, searchDate, 200);
  await fillAndEnter(
    page,
    sectionTypeInput,
    "10-Q ➤ Item 1. Financial Statements",
    200,
  );
  await page.locator("body").click();
  await fillAndEnter(
    page,
    sectionTypeInput,
    "10-K ➤ Item 1A. Risk Factors",
    200,
  );
  await page.locator("body").click();
  await fillAndEnter(
    page,
    sectionTypeInput,
    "10-K ➤ Item 1B. Unresolved Staff Comments",
    200,
  );

  await searchBtn.click();

  const searchResultTextOnly = await getTabText(page, 0, logToFile);
  logToFile(`Baseline ${searchDate}: ${searchResultTextOnly}`);

  if (searchResultTextOnly.includes("Results")) {
    await configureDisplayColumns(
      page,
      {
        "Filing Info": ["Accession #"],
        "Company Info": [],
      },
      {},
    );

    await page.waitForTimeout(500);
    const docsCount = parseCount(searchResultTextOnly);
    actualTarget = Math.min(25, docsCount);
    console.log(`Actual target for scenario ${actualTarget}`);
    await page.locator("button[title=Analytics]").click();
    await expect(page.locator("div[data-scrollid]")).toBeVisible({
      timeout: 15000,
    });
    findings = await scrapeResults(page, logToFile);
    await page.pause();
    await closeAllOpenTabs(page);

    const scenarioBlock = [
      `Doc Count: ${actualTarget}`,
      `Results:`,
      findings.text,
      ``,
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);

    await clearBtn.click();
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );

  try {
    console.log("Final Dump:\n", finalDump);
    //await updateGoogleSheet(finalDump, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  } finally {
    logToFile("\n--- End of AOE-Deal Points Report ---");
    await closeAllOpenTabs(page);
  }
};

const scrapeResults = async (page: Page, logToFile: Function) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;
  const scroller = page
    .locator(".styles__resultsListContainer___d4g_6")
    .first();
  const rows = scroller.locator('div[data-test="resultRow"]');
  const visibleRowCount = await rows.count();
  console.log("rows ", visibleRowCount);
  while (resultsFound < visibleRowCount) {
    if (visibleRowCount === 0) {
      await page.waitForTimeout(500);
      continue;
    }

    for (let i = 0; i < visibleRowCount; i++) {
      const row = rows.nth(i);
      try {
        await expect(row).toHaveAttribute("id", /.+/, { timeout: 3000 });
      } catch (e) {
        console.log(
          `Row ${i} has no ID attribute yet, skipping this iteration.`,
        );
        continue;
      }
      console.log("row ", row);
      const rowId = await row.getAttribute("id");

      if (rowId && !processedIds.has(rowId)) {
        try {
          console.log("row id ", rowId);
          const link = row.locator('span[id="link"]').first();
          await link.click();
          let index = 1;
          const resultCount = await getTabText(page, index++, logToFile);
          const docsCount = parseCount(resultCount);
          console.log("doc count ", docsCount);
          const activeTab = page
            .locator('//span[contains(text(), "Analytics")]')
            .first();
          await activeTab.click();

          processedIds.add(rowId);
          resultsFound++;

          if (resultsFound >= visibleRowCount) break;
        } catch (e: any) {
          console.log(`Error processing row: ${e.message}`);
          isScenarioValid = false;
          processedIds.add(rowId);
          resultsFound++;
        }
      }
    }
    if (resultsFound < visibleRowCount) {
      console.log(
        `Scrolling for more results... (${resultsFound}/${visibleRowCount})`,
      );
      await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(1000);
    }
  }

  return { text: rowsData.join("\n"), isValid: isScenarioValid };
};
