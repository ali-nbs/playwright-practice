import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "prod_sf_AccFee_validation";

/**
 * Which Accountant Fees option to filter by.
 *
 * The three lines that apply it live in this file rather than on SfPage:
 * picking "Any Fees" is a decision this test makes, and the click sequence
 * itself is a generic popup interaction with nothing SF-specific about it.
 */
const FEE_OPTION = "Any Fees";
const FORM_TYPES = "10-K;10-Q;S-4;DEF 14A;40-F;20-F";
const MAX_DOCS = 2;

/**
 * Filters by Accountant Fees = "Any Fees" and checks every result row
 * actually shows a fee value.
 *
 * Note this is a presence check, not a value check: "Any Fees" only claims
 * the filing reports some fee, so the row passes as long as the column is
 * not empty.
 */
export const runAccountantFeesTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Accountant Fees Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.fillAndEnter(sf.dateInput, date);
  await sf.fillAndEnter(sf.formsInput,FORM_TYPES);
  logToFile(`Forms applied: ${FORM_TYPES}`);

  await sf.accountantFeesInput.click();
  await page.locator("label").filter({ hasText: FEE_OPTION }).first().click();
  await sf.okBtn.click();

  await sf.searchBtn.click();

  const { body, error: searchError } = await sf.trySearchResponse();
  logToFile(`Total Records: ${body.TotalRecords}`);

  let failures: string[] = [];

  if (searchError) {
    failures.push(`Search failed: ${searchError}`);
    logToFile(`Search failed: ${searchError}`);
  }
  let verified = 0;

  if (body.TotalRecords > 0) {
    await sf.configureDisplayColumns({
      "Filing Info": ["Intelligize ID", "Accountant Fees"],
    });

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRow(
      target,
      async (row) => {
        const id = await sf.rowValueByLabel(row, "Intelligize ID");
        const hasFee = await sf.rowValueByLabel(row, "Accountant Fees"); 

        verified++;

        if (!hasFee) {
          failures.push(`Intelligize ID: ${id} -> no Accountant Fee shown.`);
        }

        console.log(`Row ${verified} -> ${id} | has fee: ${hasFee}`);
      },
      { keyAttr: "data-ref" },
    );
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Form: ${FORM_TYPES}`,
    `Accountant Fees: ${FEE_OPTION}`,
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
