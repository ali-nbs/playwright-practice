import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../utils/helpers";
import { AoePage } from "../pages/AoePage";

const IDENTIFIER = "aoe_releaseDate";

const MAX_DOCS = 25;

/**
 * Checks that every row released on the searched date really shows that
 * date, by switching the grid's date column to "Released" and reading it
 * back.
 *
 * The column labels are shorter here than in SEC Filings ("Filed" /
 * "Released" rather than "Date Filed" / "Date Released"), so the labels are
 * passed explicitly rather than shared with the SF flow.
 */
export const runAoeReleaseDateTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting AOE-Release Date Report ---");

  const aoe = new AoePage(page);
  const expectedDate = getTargetDateString();

  await aoe.clearFilters();
  await page.waitForTimeout(1000);

  await aoe.fillAndEnter(aoe.dateInput, expectedDate, 700);
  await aoe.search();

  const { body, error: searchError } = await aoe.trySearchResponse();
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
    await aoe.switchDateColumn("Filed", "Released");
    await aoe.selectInfoOption("Filing Info", "Intelligize ID");

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await aoe.forEachRefRow(target, async (row) => {
      const id = await aoe.rowIntelligizeId(row);
      const releaseDate = await aoe.rowDate(row);

      verified++;

      if (releaseDate !== expectedDate) {
        failures.push(
          `Intelligize ID: ${id} -> Released date is "${releaseDate}", expected "${expectedDate}".`,
        );
      }

      console.log(`Row ${verified} -> ${id} | ${releaseDate}`);
    });
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${expectedDate}`,
    `Grid Column: Released`,
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
  await aoe.closeAllOpenTabs();
};
