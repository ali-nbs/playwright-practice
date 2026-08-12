import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_snippets";

const MAX_DOCS = 25;

/**
 * Turns the Snippets display option on and checks every result row renders
 * its snippet block.
 *
 * The search runs twice on purpose: once to load the grid, then again
 * because ticking Snippets re-runs the search itself. Waiting for that
 * second response is what stops the row checks from reading the pre-snippet
 * grid.
 */
export const runSnippetsTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Snippets Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.fillAndEnter(sf.dateInput, date);
  await sf.search();

  let { body, error: searchError } = await sf.trySearchResponse();
  logToFile(`Initial grid loaded. Total Records: ${body.TotalRecords}`);

  let failures: string[] = [];
  let verified = 0;

  // A search that errored or never fired used to throw straight out of the
  // flow, so nothing was ever written to the sheet. Record it as a failure
  // instead and let the report still be produced.
  if (searchError) {
    failures.push(`Search failed: ${searchError}`);
    logToFile(`Search failed: ${searchError}`);
  }

  if (body.TotalRecords > 0) {
    await sf.setCheckboxState("Snippets", true);

    const rerun = await sf.trySearchResponse();
    body = rerun.body;
    logToFile(`Search re-ran with Snippets. Total Records: ${body.TotalRecords}`);

    if (rerun.error) {
      failures.push(`Snippets re-run search failed: ${rerun.error}`);
      logToFile(`Snippets re-run search failed: ${rerun.error}`);
    }

    await sf.selectInfoOption("Filing Info", "Intelligize ID");

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRefRow(target, async (row) => {
      const id = await sf.rowIntelligizeId(row);
      const snippetCount = await sf.rowSnippets(row).count();

      verified++;

      if (snippetCount === 0) {
        failures.push(`Intelligize ID: ${id} -> row displays no snippets.`);
      }

      console.log(`Row ${verified} -> ${id} | snippets: ${snippetCount}`);
    });
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Snippets: Enabled`,
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
