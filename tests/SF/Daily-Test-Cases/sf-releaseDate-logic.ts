import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "prod_sf_releaseDate_validation";

const MAX_DOCS = 2;

export const runReleaseDateTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Release Date Report ---");

  const sf = new SfPage(page);
  const expectedDate = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.exhibitsToFilingsLabel.uncheck();
  await sf.fillAndEnter(sf.dateInput, expectedDate);
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
    await sf.switchDateColumn("Date Filed", "Date Released");
    await sf.configureDisplayColumns({ "Filing Info": ["Intelligize ID"] });

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRow(
      target,
      async (row) => {
        const id = await sf.rowValueByLabel(row, "Intelligize ID");
        const releaseDate =
          (await row
            .locator(".styles__filing-date-value-column___2pu1v")
            .textContent())?.trim() ?? "";

        verified++;

        if (releaseDate !== expectedDate) {
          failures.push(
            `Intelligize ID: ${id} -> Date Released is "${releaseDate}", expected "${expectedDate}".`,
          );
        }

        console.log(`Row ${verified} -> ${id} | ${releaseDate}`);
      },
      { keyAttr: "data-ref" },
    );
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${expectedDate}`,
    `Exhibits to Filings: Exclude`,
    `Grid Column: Date Released`,
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
