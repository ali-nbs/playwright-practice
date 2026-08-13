import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "prod_sf_snippets_validation";

const MAX_DOCS = 2;

export const runSnippetsTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Snippets Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.fillAndEnter(sf.dateInput, date);
  await sf.searchBtn.click();

  let { body, error: searchError } = await sf.trySearchResponse();
  logToFile(`Initial grid loaded. Total Records: ${body.TotalRecords}`);

  let failures: string[] = [];
  let verified = 0;

  if (searchError) {
    failures.push(`Search failed: ${searchError}`);
    logToFile(`Search failed: ${searchError}`);
  }

  if (body.TotalRecords > 0) {
     await sf.configureDisplayColumns({
      "Filing Info": ["Intelligize ID"],
      "Company Info": [],
    }, {enableSnippets: true});

    const rerun = await sf.trySearchResponse();
    body = rerun.body;
    logToFile(`Search re-ran with Snippets. Total Records: ${body.TotalRecords}`);

    if (rerun.error) {
      failures.push(`Snippets re-run search failed: ${rerun.error}`);
      logToFile(`Snippets re-run search failed: ${rerun.error}`);
    }

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRow(
      target,
      async (row) => {
        const id = await sf.rowValueByLabel(row, "Intelligize ID");
        const snippetCount = await row
          .locator(".Snippets-styles__result-row__snippet__content___2-_PD")
          .count();

        verified++;

        if (snippetCount === 0) {
          failures.push(`Intelligize ID: ${id} -> row displays no snippets.`);
        }

        console.log(`Row ${verified} -> ${id} | snippets: ${snippetCount}`);
      },
      { keyAttr: "data-ref" },
    );
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
