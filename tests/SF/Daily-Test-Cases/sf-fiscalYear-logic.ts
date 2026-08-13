import { Page, expect, Locator } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  getTargetDateString,
  parseCount,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";
import { calculateDynamicFiscal } from "../../Daily-DataPoints-Sheets/Fiscal-Year/fiscalYear.batch.spec";

const IDENTIFIER = "sf_fiscalYear";

export const runFiscalYearTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-fiscalYear Report ---");

  const sf = new SfPage(page);


  await sf.clearFilters();
  await page.waitForTimeout(2000);

  await sf.amendmentFilingsExcludeRadio.click();
  await sf.ownershipFormsIncludeRadio.click();

  logToFile(`Testing Scenario: Yesterday`);
  await sf.fillAndEnter(sf.dateInput, getTargetDateString());

  const exhibtsToFilingsCheckbox = sf.exhibitsToFilingsLabel;
  await exhibtsToFilingsCheckbox.click({ force: true });
  await sf.searchBtn.click();

  const textDateOnly = await sf.getTabText(0, logToFile);
  logToFile(`Baseline (Yesterday): ${textDateOnly}`);

  if (!textDateOnly.includes("Docs")) {
    logToFile("No results to process.");
    const scenarioBlock = [
      `Scenario Status: "VALID ✅" `,
      `Date: ${getTargetDateString()}`,
      `Failure Companies:"None"}`,
    ].join("\n");
    await updateGoogleSheet(scenarioBlock, IDENTIFIER, []);
    logToFile("Sheet updated successfully.");
    await sf.closeAllOpenTabs();
    return;
  }

  await configureFiscalYearColumns(page);

  const docsCount = parseCount(textDateOnly);
  const actualTarget = Math.min(5, docsCount);
  const findings = await scrapeFiscalYearResults(actualTarget, page);

  const scenarioBlock = [
    `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌"}`,
    `Date: Yesterday`,
    `Failure Companies: ${findings.text.length > 0 ? findings.text.join(", ") : "None"}`,
  ].join("\n");

  try {
    await updateGoogleSheet(scenarioBlock, IDENTIFIER, findings.text);
    logToFile("Sheet updated successfully.");
    await sf.closeAllOpenTabs();
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }
  logToFile("--- End of Report ---");
};

const scrapeFiscalYearResults = async (targetCount: number, page: Page) => {
  const sf = new SfPage(page);
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let failureCompanies: string[] = [];
  const activeTab = sf.contextMenuWrapper;

  while (resultsFound < targetCount) {
    const scroller = sf.scroller;
    const rows = sf.rows;

    if ((await rows.count()) === 0) {
      await page.waitForTimeout(500);
      continue;
    }

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const rowId = await row.getAttribute("id");

      if (rowId && !processedIds.has(rowId)) {
        try {
          const { links: anchorLinks } = await sf.rowData(row);
          await row.locator("a").first().click();
          await page.waitForTimeout(500);

          const isValid = await validateFiscalYear(page, activeTab);
          if (!isValid.status) failureCompanies.push(anchorLinks[0]);

          processedIds.add(rowId);
          await activeTab.nth(1).click();
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

const validateFiscalYear = async (
  page: Page,
  activeTab: Locator,
): Promise<{ status: boolean; reason: string }> => {
  const sf = new SfPage(page);
  const fiscalYearRow = page
    .locator("div.CompanyInfoSummary__company-info__row___3nnEE")
    .filter({ hasText: "Fiscal Year End" });

  await page.waitForTimeout(2000);

  if ((await fiscalYearRow.count()) === 0) {
    return {
      status: false,
      reason: "Fiscal Year End field missing in Company Profile",
    };
  }

  const fiscalYearEndValue = (
    await fiscalYearRow.locator("div").last().textContent()
  )?.trim();

  const companyTabIndex = (await activeTab.count()) - 1;

  const rows = sf.periodicFilingRows;

  if ((await rows.count()) === 0) {
    return {
      status: false,
      reason: "No filing rows found.",
    };
  }

  const link = rows
    .first()
    .locator("td.periodicFilingsContent__formType___L_1Ma a")
    .first();

  const linkText = await link.innerText();

  if (
    !/\b(?:10|20)-(?:K|Q|F)(?:\/A)?\b/.test(linkText) ||
    linkText.includes("NT")
  ) {
    return {
      status: false,
      reason: "Latest filing is not a supported annual/quarterly filing.",
    };
  }

  await link.click();

  try {
    const docFrame = page
      .locator('iframe[src*="/SECFilings/Documents/"]')
      .first()
      .contentFrame();
    const currentFYELocator = docFrame
      .locator('ix\\:nonnumeric[name="dei:CurrentFiscalYearEndDate"]')
      .first();
    const docPeriodLocator = docFrame
      .locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]')
      .first();

    let fiscalYearEndValue: string | null = null;


    await currentFYELocator
      .isVisible({ timeout: 10000 })
      .catch(() => false)
    await sf.ixbrlTabByText.waitFor({ state: "visible", timeout: 30000 });
    await sf.ixbrlTabByText.click();
    await sf.ex101Tab.click();

    await sf.xbrlReportTable.waitFor({
      state: "visible",
      timeout: 40000,
    });

    const getValue = async (labels: string[]): Promise<string> => {
      for (const label of labels) {
        const row = sf.xbrlRowByLabel(label);

        if ((await row.count()) === 0) continue;

        const cells = sf.periodicFilingCells(row);

        for (let i = 0; i < (await cells.count()); i++) {
          const text = (await cells.nth(i).textContent())?.trim() ?? "";
          if (/\d/.test(text)) {
            return text;
          }
        }
      }

      return "";
    };

    const yearEnd = await getValue([
      "Current Fiscal Year End Date",
      "Fiscal Year End",
    ]);

    await activeTab.nth(companyTabIndex).click();

    if (!yearEnd) {
      return {
        status: false,
        reason: "Fiscal Year End not found in XBRL.",
      };
    }

    const normalize = (value: string) => value.replace(/^--/, "").trim();

    const isMatch =
      normalize(fiscalYearEndValue ?? "") === normalize(yearEnd);

    return {
      status: isMatch,
      reason: isMatch
        ? ""
        : `Mismatch. Company Profile: ${fiscalYearEndValue}, XBRL: ${yearEnd}`,
    };
  } catch {
    await activeTab.nth(companyTabIndex).click();

    return {
      status: false,
      reason: "Unable to read Fiscal Year End from XBRL.",
    };
  }
};
const configureFiscalYearColumns = async (page: Page) => {
  const sf = new SfPage(page);
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
    await mainCheckbox.click();
    await page.waitForTimeout(500);
    await mainCheckbox.click();

    if (section === "Filing Info") {
      await page
        .locator(".PopupBody__popup__body___1J_d3")
        .locator("div")
        .filter({ hasText: /^Accession #$/ })
        .locator("._checkbox__icon_1xotg_257")
        .click();
    }
    await sf.applyBtn.click();
  }
};
