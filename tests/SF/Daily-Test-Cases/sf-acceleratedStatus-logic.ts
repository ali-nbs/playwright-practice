import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_acceleratedStatus";

const ACCELERATED_STATUS = "Large Accelerated Filer";
const FORM_TYPES = "10-K;10-Q;S-4;DEF 14A;40-F;20-F";
const MAX_DOCS = 25;

/**
 * Filters by Accelerated Status and checks every result row really carries
 * that status, by reading the "Accelerated Status" display column.
 *
 * The form filter is applied first because Accelerated Status is only
 * populated on periodic filings, so an unfiltered search would report rows
 * with a blank status that are not actually defects.
 */
export const runAcceleratedStatusTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Accelerated Status Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.fillAndEnter(sf.dateInput, date);
  await sf.typeFormTypeList(FORM_TYPES);
  logToFile(`Forms applied: ${FORM_TYPES}`);
  await sf.fillAndEnter(sf.acceleratedStatusInput, ACCELERATED_STATUS, 1000);
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
      "Company Info": ["Accelerated Status"],
    });

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRefRow(target, async (row) => {
      const id = await sf.rowIntelligizeId(row);
      const status = await sf.rowAcceleratedStatus(row);

      verified++;

      if (status !== ACCELERATED_STATUS) {
        failures.push(
          `Intelligize ID: ${id} -> Accelerated Status is "${status}", expected "${ACCELERATED_STATUS}".`,
        );
      }

      console.log(`Row ${verified} -> ${id} | ${status}`);
    });
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Form: ${FORM_TYPES}`,
    `Accelerated Status: ${ACCELERATED_STATUS}`,
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
