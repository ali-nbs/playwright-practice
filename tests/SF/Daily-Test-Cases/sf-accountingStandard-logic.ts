import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "prod_sf_AccStd_validation";

const ACCOUNTING_STANDARD = "U.S. GAAP";
const MAX_DOCS = 2;

/**
 * Filters by Accounting Standard and checks every result row really carries
 * that standard, by reading the "Accounting Std." display column.
 */
export const runAccountingStandardTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Accounting Standard Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.fillAndEnter(sf.dateInput, date);
  await sf.fillAndEnter(sf.accountingStandardInput, ACCOUNTING_STANDARD, 700);
  await sf.searchBtn.click();

  const { body, error: searchError } = await sf.trySearchResponse();
  logToFile(`Total Records: ${body.TotalRecords}`);

  let failures: string[] = [];

  // A search that errored or never fired used to throw straight out of
  // the flow, so nothing was ever written to the sheet. Record it as a
  // failure instead and let the report still be produced.
  if (searchError) {
    failures.push(`Search failed: ${searchError}`);
    logToFile(`Search failed: ${searchError}`);
  }
  let verified = 0;

  if (body.TotalRecords > 0) {
    await sf.configureDisplayColumns({
      "Filing Info": ["Intelligize ID"],
      "Company Info": ["Accounting Std."],
    });

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRow(
      target,
      async (row) => {
        const id = await sf.rowValueByLabel(row, "Intelligize ID");
        const standard = await sf.rowValueByLabel(row, "Accounting Std.");

        verified++;

        if (standard !== ACCOUNTING_STANDARD) {
          failures.push(
            `Intelligize ID: ${id} -> Accounting Std. is "${standard}", expected "${ACCOUNTING_STANDARD}".`,
          );
        }

        console.log(`Row ${verified} -> ${id} | ${standard}`);
      },
      { keyAttr: "data-ref" },
    );
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Accounting Standard: ${ACCOUNTING_STANDARD}`,
    `Search For: Filings`,
    `Docs Verified: ${verified}`,
    `Failure IDs:`,
    `${failures.length === 0 ? "None" : failures.join("\n")}`,
  ].join("\n");

  try {
    await updateGoogleSheet(scenarioBlock, IDENTIFIER, failures);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }

  logToFile("\n--- End of Report ---");
  await sf.closeAllOpenTabs();
};
