import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../utils/helpers";
import { HIGHLIGHT_BG_COLOR } from "../pages/BasePage";
import { SePage } from "../pages/SePage";

const IDENTIFIER = "se_booleanHighlight";

const KEYWORD = "is or the or a";

/**
 * Runs a boolean keyword search and checks the keyword is highlighted, in
 * the app's highlight colour, in the results table.
 *
 * This is a table-wide check rather than a per-row one: SE renders results
 * as a document table whose highlights are not scoped to an individual
 * row, so there is no row identity to report a failure against. That is
 * also why it uses its own highlight locator rather than
 * BasePage.checkRowHighlights.
 */
export const runSeBooleanHighlightTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SE-Boolean Highlight Report ---");

  const se = new SePage(page);
  const date = getTargetDateString();

  await se.clearFilters();
  await page.waitForTimeout(1000);

  await se.fillAndEnter(se.dateInput, date);
  await se.fillAndEnter(se.keywordsInput, KEYWORD);

  const body = await se.waitForSearchResponse();
  logToFile(`Total Records: ${body.TotalRecords}`);

  let failures: string[] = [];
  let highlightCount = 0;

  if (body.TotalRecords > 0) {
    const highlights = se.tableHighlights;
    highlightCount = await highlights.count();
    logToFile(`Highlights found: ${highlightCount}`);

    if (highlightCount === 0) {
      failures.push(
        `Search returned ${body.TotalRecords} records but the results table shows no highlighted keyword.`,
      );
    }

    for (let i = 0; i < highlightCount; i++) {
      const color = await highlights
        .nth(i)
        .evaluate((el) => getComputedStyle(el).backgroundColor);

      if (color !== HIGHLIGHT_BG_COLOR) {
        failures.push(
          `Highlight ${i + 1} colour is "${color}", expected "${HIGHLIGHT_BG_COLOR}".`,
        );
      }
    }
  } else {
    logToFile("No results found.");
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Keyword: ${KEYWORD}`,
    `Total Records: ${body.TotalRecords}`,
    `Highlights Verified: ${highlightCount}`,
    `Failures:`,
    `${failures.length === 0 ? "None" : failures.join("\n")}`,
  ].join("\n");

  try {
    await updateGoogleSheet(scenarioBlock, IDENTIFIER, failures);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }

  logToFile("\n--- End of Report ---");
  await se.closeAllOpenTabs();
};
