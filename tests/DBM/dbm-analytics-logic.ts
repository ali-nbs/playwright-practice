import { expect, Page } from "@playwright/test";
import {
  parseCount,
  recoverFromAppCrash,
  getTargetDateString,
} from "../utils/helpers";
import { DbmPage } from "../pages/DbmPage";
import path from "path";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

const IDENTIFIER = "dbm_analytics";

interface SearchScenario {
  name: string;
  isBlankSearch: boolean;
  date?: string;
  sections?: string[];
}

const scenarios: SearchScenario[] = [
  {
    name: "Blank Search (No Date/Section)",
    isBlankSearch: true,
  },
  {
    name: "Section Specific Search",
    isBlankSearch: false,
    date: getTargetDateString(),
    sections: [
      "10-Q ➤ Item 1. Financial Statements",
      "10-K ➤ Item 1A. Risk Factors",
      "10-K ➤ Item 1B. Unresolved Staff Comments",
    ],
  },
];

export const runDBMAnalyticsTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting DBM Analytics Report ---");

  const dbm = new DbmPage(page);

  let allScenarioResults: string[] = [];

  await dbm.clearFilters();
  await page.waitForTimeout(1000);
  for (const scenario of scenarios) {
    logToFile(`\nRunning Scenario: ${scenario.name}`);

    if (!scenario.isBlankSearch) {
      if (scenario.date) {
        await dbm.fillAndEnter(dbm.dateInput, scenario.date, 200);
      }

      if (scenario.sections) {
        for (const section of scenario.sections) {
          await dbm.fillAndEnter(dbm.sectionTypeInput, section, 20);
          await page.locator("body").click();
        }
      }
    }

    await dbm.searchBtn.click();

    const searchResultTextOnly = await dbm.getTabText(0, logToFile);
    logToFile(`${scenario.name} Result: ${searchResultTextOnly}`);

    let findings = { text: "No Results Found", isValid: true };

    if (
      !searchResultTextOnly.includes("No Results Found") ||
      searchResultTextOnly.match(/\d/)
    ) {
      await page.waitForTimeout(500);
      const docsCount = parseCount(searchResultTextOnly);
      const actualTarget = Math.min(25, docsCount);

      await page.locator("button[title=Analytics]").click();

      await expect(page.locator("div[data-scrollid]").first()).toBeVisible({
        timeout: 15000,
      });

      findings = await scrapeResults(page, scenario.isBlankSearch, logToFile);
    }
    await dbm.closeAllOpenTabs();

    const scenarioBlock = [
      `Scenario: ${scenario.name}`,
      `Results:`,
      `Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );
  console.log("Final Dump:\n", finalDump);
  await updateGoogleSheet(finalDump, IDENTIFIER, []);
  await dbm.closeAllOpenTabs();
  logToFile("Testing complete.");
};

const scrapeResults = async (
  page: Page,
  isBlankSearch: boolean,
  logToFile: Function,
) => {
  const dbm = new DbmPage(page);
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  const scroller = page
    .locator(".styles__resultsListContainer___d4g_6")
    .first();
  const rows = scroller.locator('div[data-test="resultRow"]');

  // Wait for rows to load
  await expect(rows.first())
    .toBeVisible({ timeout: 60000 })
    .catch(() => {});
  const visibleRowCount = await rows.count();

  console.log(`Visible rows: ${visibleRowCount}`);

  if (visibleRowCount === 0) {
    return { text: "Zero rows visible in Analytics", isValid: false };
  }

  const totalDocCount = await page
    .locator(".styles__info-item___37x40")
    .filter({ hasText: /Total # Documents/i })
    .locator("span")
    .last()
    .innerText();
  console.log("Total docs: ", totalDocCount);
  if (isBlankSearch) {
    return {
      text: `Blank Search confirmed. Total Docs: ${totalDocCount}`,
      isValid: true,
    };
  }

  while (resultsFound < visibleRowCount && resultsFound < 2) {
    for (let i = 0; i < visibleRowCount; i++) {
      const row = rows.nth(i);
      const rowId = await row.getAttribute("id");

      if (rowId && !processedIds.has(rowId)) {
        try {
          const link = row.locator('span[id="link"]').first();
          await link.click();

          const resultCount = await dbm.getTabText(1, logToFile);
          rowsData.push(`Row ${rowId}: ${resultCount}`);

          await page
            .locator('//span[contains(text(), "Analytics")]')
            .first()
            .click();

          processedIds.add(rowId);
          resultsFound++;
        } catch (e: any) {
          console.log(`Error processing row: ${e.message}`);
          isScenarioValid = false;
          processedIds.add(rowId || `error-${i}`);
          resultsFound++;
        }
      }
    }
  }

  const downloadBtn = page.locator('button[title*="Download"]').first();
  await downloadBtn.click();

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /ok/i }).first().click(),
  ]);
  await pdfDownload.saveAs(
    path.join("./downloads", pdfDownload.suggestedFilename()),
  );
  logToFile(`Downloaded PDF: ${pdfDownload.suggestedFilename()}`);

  await page.locator('button:has-text("Excel List")').first().click();

  const [excelDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /ok/i }).first().click(),
  ]);
  await excelDownload.saveAs(
    path.join("./downloads", excelDownload.suggestedFilename()),
  );

  return { text: rowsData.join("\n"), isValid: isScenarioValid };
};
