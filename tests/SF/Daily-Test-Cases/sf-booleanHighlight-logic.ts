import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { HIGHLIGHT_BG_COLOR } from "../../pages/BasePage";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_booleanHighlight";

const KEYWORD = "is or the or a";
const MAX_DOCS = 25;

/**
 * Runs a boolean keyword search and checks that every result row actually
 * shows the keyword highlighted, in the app's highlight colour.
 *
 * "Exhibits to Filings" is switched OFF first so the grid holds filings
 * only - exhibit sub-rows carry no snippet of their own and would be
 * reported as missing highlights.
 */
export const runBooleanHighlightTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Boolean Highlight Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.setCheckboxState("-ExhibitsToFilings", false);
  await sf.fillAndEnter(sf.dateInput, date);
  await sf.selectSearchType("Boolean");
  await sf.fillAndEnter(sf.keywordsInput, KEYWORD);

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
    await sf.configureDisplayColumns({ "Filing Info": ["Intelligize ID"] });

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRow(
      target,
      async (row) => {
        const id = await sf.rowValueByLabel(row, "Intelligize ID");
        const { found, invalidColor } = await sf.checkRowHighlights(
          row,
          "em.highlight",
        );

        verified++;

        if (!found) {
          failures.push(`Intelligize ID: ${id} -> no keyword highlight in row.`);
        } else if (invalidColor) {
          failures.push(
            `Intelligize ID: ${id} -> highlight colour is not ${HIGHLIGHT_BG_COLOR}.`,
          );
        }

        console.log(`Row ${verified} -> ${id} | highlighted: ${found}`);
      },
      { keyAttr: "data-ref" },
    );
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Keyword: ${KEYWORD}`,
    `Search Type: Boolean`,
    `Exhibits to Filings: Exclude`,
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
