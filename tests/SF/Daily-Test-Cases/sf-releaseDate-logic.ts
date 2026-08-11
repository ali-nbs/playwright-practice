import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_releaseDate";

const MAX_DOCS = 25;

/**
 * Checks that every row released on the searched date really shows that
 * date, by switching the grid's date column from "Date Filed" to
 * "Date Released" and reading it back.
 *
 * The expected value is the search date itself: getTargetDateString()
 * already returns a concrete MM/DD/YYYY, so no separate date resolution is
 * needed here.
 *
 * "Exhibits to Filings" is switched OFF so the grid holds filings only;
 * exhibit sub-rows have no date cell of their own.
 */
export const runReleaseDateTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Release Date Report ---");

  const sf = new SfPage(page);
  const expectedDate = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.setCheckboxState("-ExhibitsToFilings", false);
  await sf.fillAndEnter(sf.dateInput, expectedDate);
  await sf.search();

  const body = await sf.waitForSearchResponse();
  logToFile(`Total Records: ${body.TotalRecords}`);

  let failures: string[] = [];
  let verified = 0;

  if (body.TotalRecords > 0) {
    await sf.switchDateColumn("Date Filed", "Date Released");
    await sf.selectInfoOption("Filing Info", "Intelligize ID");

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRefRow(target, async (row) => {
      const id = await sf.rowIntelligizeId(row);
      const releaseDate = await sf.rowDate(row);

      verified++;

      if (releaseDate !== expectedDate) {
        failures.push(
          `Intelligize ID: ${id} -> Date Released is "${releaseDate}", expected "${expectedDate}".`,
        );
      }

      console.log(`Row ${verified} -> ${id} | ${releaseDate}`);
    });
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
