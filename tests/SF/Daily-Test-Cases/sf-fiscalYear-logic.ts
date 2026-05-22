import { Page, expect, Locator } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  fillAndEnter,
  getTabText,
  parseCount,
} from "../../utils/helpers";

const IDENTIFIER = "sf_fiscalYear";

export const runFiscalYearTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-fiscalYear Report ---");

  const dateInput = page.locator(
    '//label[text()="Date"]/ancestor::div[5]//input',
  );
  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

  await clearBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // 1. Set Initial Filters
  await page.getByTestId("amendmentFilings-radio-EXC").click();
  await page.getByTestId("ownershipForms-radio-INC").click();

  logToFile(`Testing Scenario: Yesterday`);
  await fillAndEnter(page, dateInput, "Yesterday");

  const exhibtsToFilingsCheckbox = page.locator(
    'label[for="-ExhibitsToFilings"]',
  );
  await exhibtsToFilingsCheckbox.click({ force: true });
  await searchBtn.click();

  const textDateOnly = await getTabText(page, 0, logToFile);
  logToFile(`Baseline (Yesterday): ${textDateOnly}`);

  if (!textDateOnly.includes("Docs")) {
    logToFile("No results to process.");
    const scenarioBlock = [
      `Scenario Status: "VALID ✅" `,
      `Date: Yesterday`,
      `Failure Companies:"None"}`,
    ].join("\n");
    await updateGoogleSheet(scenarioBlock, IDENTIFIER, []);
    logToFile("Sheet updated successfully.");
    await closeAllOpenTabs(page);
    return;
  }

  // 2. Column Configuration (Checkbox setup)
  await configureFiscalYearColumns(page);

  // 3. Process Results
  const docsCount = parseCount(textDateOnly);
  const actualTarget = Math.min(1, docsCount); // Processing 1 as per original script
  const findings = await scrapeFiscalYearResults(actualTarget, page);

  // 4. Reporting
  const scenarioBlock = [
    `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌"}`,
    `Date: Yesterday`,
    `Failure Companies: ${findings.text.length > 0 ? findings.text.join(", ") : "None"}`,
  ].join("\n");

  try {
    await updateGoogleSheet(scenarioBlock, IDENTIFIER, findings.text);
    logToFile("Sheet updated successfully.");
    await closeAllOpenTabs(page);
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }
  logToFile("--- End of Report ---");
};

/**
 * Internal Logic: Scrape and Validate
 */
const scrapeFiscalYearResults = async (targetCount: number, page: Page) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let failureCompanies: string[] = [];
  const activeTab = page.locator("div.react-contextmenu-wrapper");

  while (resultsFound < targetCount) {
    const scroller = page.locator(".ReactVirtualized__Grid").last();
    const rows = scroller.locator('div[data-test="resultRow"]');

    if ((await rows.count()) === 0) {
      await page.waitForTimeout(500);
      continue;
    }

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const rowId = await row.getAttribute("id");

      if (rowId && !processedIds.has(rowId)) {
        try {
          const anchorLinks = await row.locator("a").allInnerTexts();
          await row.locator("a").first().click();
          await page.waitForTimeout(500);

          const isValid = await validateFiscalYear(page, activeTab);
          if (!isValid) failureCompanies.push(anchorLinks[0]);

          processedIds.add(rowId);
          await activeTab.nth(1).click(); // Return to results tab
          resultsFound++;
        } catch (e) {
          continue;
        }
      }
      if (resultsFound >= targetCount) break;
    }
    if (resultsFound < targetCount) {
      await rows.last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
  }
  return { text: failureCompanies, isValid: failureCompanies.length === 0 };
};

/**
 * Internal Logic: iXBRL and XBRL Frame Validation
 */
const validateFiscalYear = async (page: Page, activeTab: Locator) => {
  const fiscalYearRow = page
    .locator("div.CompanyInfoSummary__company-info__row___3nnEE")
    .filter({ hasText: "Fiscal Year End" });
  await page.waitForTimeout(2000);

  if ((await fiscalYearRow.count()) <= 0) return false;

  const companyTabIndex = (await activeTab.count()) - 1;
  const rows = page.locator("tr.periodicFilingsContent__tableRow___trkDv");

  if ((await rows.count()) > 0) {
    const link = rows
      .first()
      .locator("td.periodicFilingsContent__formType___L_1Ma a")
      .first();
    const linkText = await link.innerText();

    if (linkText.match(/10-K|10-Q|20-F/) && !linkText.includes("NT")) {
      await link.click();
      const ixbrlBtn = page.locator("text=/^iXBRL$/i").first();
      await ixbrlBtn.click();

      try {
        await page.locator("text=/^EX-101$/i").first().click();
        const xbrlFrame = page
          .locator("div.HtmlViewer__viewer___ZSwJe iframe")
          .first()
          .contentFrame();
        await xbrlFrame
          .locator("td.pl, .xbrl, table")
          .first()
          .waitFor({ state: "visible", timeout: 20000 });

        // Return to company tab
        await activeTab.nth(companyTabIndex).click();
      } catch (e) {}
    }
  }
  return true;
};

const configureFiscalYearColumns = async (page: Page) => {
  // Helper to handle the "Filing Info" and "Company Info" checkbox logic
  const sections = ["Filing Info", "Company Info"];
  for (const section of sections) {
    await page
      .locator(".styles__popupContainer___36f60")
      .filter({ hasText: section })
      .locator("._checkbox__icon_1xotg_257")
      .click();
    await page.waitForTimeout(500);
    const mainCheckbox = page
      .locator(".PopupBody__popup__body___1J_d3")
      .locator("div")
      .filter({ hasText: new RegExp(`^${section}$`) })
      .locator("._checkbox__icon_1xotg_257");
    await mainCheckbox.click(); // Toggle off
    await page.waitForTimeout(500);
    await mainCheckbox.click(); // Toggle on (to ensure clean slate)

    if (section === "Filing Info") {
      await page
        .locator(".PopupBody__popup__body___1J_d3")
        .locator("div")
        .filter({ hasText: /^Accession #$/ })
        .locator("._checkbox__icon_1xotg_257")
        .click();
    }
    await page.getByRole("button", { name: "Apply" }).click();
  }
};
