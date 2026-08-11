import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../utils/helpers";
import { HIGHLIGHT_BG_COLOR } from "../pages/BasePage";
import { SrcPage } from "../pages/SrcPage";

const IDENTIFIER = "src_conceptualHighlight";

const CONCEPTUAL_KEYWORD = "Exchange";
const MAX_DOCS = 25;

/**
 * Runs a conceptual keyword search and checks the keyword is highlighted in
 * both the opened document and every result row's snippet.
 *
 * The filter panel is collapsed before opening the first document: SRC's
 * panel overlaps the viewer at this viewport, and the Next control ends up
 * underneath it.
 *
 * Rows are named by title/category/date because SRC results are regulatory
 * documents and carry no Intelligize ID.
 */
export const runSrcConceptualHighlightTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SRC-Conceptual Highlight Report ---");

  const src = new SrcPage(page);
  const date = getTargetDateString();

  await src.clearFilters();
  await page.waitForTimeout(1000);

  await src.fillAndEnter(src.dateInput, date, 700);
  await src.selectSearchType("Conceptual");
  await src.fillAndEnter(src.keywordsInput, CONCEPTUAL_KEYWORD, 700);

  const body = await src.waitForSearchResponse();
  logToFile(`Total Records: ${body.TotalRecords}`);

  let docFailures: string[] = [];
  let gridFailures: string[] = [];
  let docsVerified = 0;
  let rowsVerified = 0;

  if (body.TotalRecords > 0) {
    const target = Math.min(body.TotalRecords, MAX_DOCS);

    // ---- Document viewer ----
    await src.toggleFiltersPanel();
    await src.clickViewForRow(src.refRows.first());

    for (let i = 0; i < target; i++) {
      await page.waitForTimeout(100);

      const highlighted = await src.hasDocumentHighlight();
      docsVerified++;

      if (!highlighted) {
        const details = await src.openDocDetails();
        const label = `${details.title} - ${details.category} - ${details.dateFiled}`;

        docFailures.push(`${label} -> no highlight in document viewer.`);
        logToFile(`Document ${i + 1} failed: ${label}`);
      }

      if (i < target - 1) {
        await src.clickNextDocument();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1000);
      }

      console.log(`Document ${i + 1} processed | highlighted: ${highlighted}`);
    }

    await src.closeCurrentDocumentTab();

    // ---- Result grid ----
    await src.forEachRefRow(target, async (row) => {
      const details = await src.rowDetails(row);
      const label = `${details.title} - ${details.category} - ${details.dateFiled}`;

      const { found, invalidColor } = await src.checkRowHighlights(
        row,
        "customhighlight",
      );

      rowsVerified++;

      if (!found) {
        gridFailures.push(`${label} -> no highlighted keyword in row.`);
      } else if (invalidColor) {
        gridFailures.push(
          `${label} -> highlight colour is not ${HIGHLIGHT_BG_COLOR}.`,
        );
      }

      console.log(`Row ${rowsVerified} -> ${label} | highlighted: ${found}`);
    });
  }

  const allFailures = [...docFailures, ...gridFailures];

  const scenarioBlock = [
    `Status: ${allFailures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Keyword: ${CONCEPTUAL_KEYWORD}`,
    `Search Type: Conceptual`,
    `Docs Verified: ${docsVerified}`,
    `Rows Verified: ${rowsVerified}`,
    ``,
    `Document Viewer Failures:`,
    `${docFailures.length === 0 ? "None" : docFailures.join("\n")}`,
    ``,
    `Result Grid Failures:`,
    `${gridFailures.length === 0 ? "None" : gridFailures.join("\n")}`,
  ].join("\n");

  try {
    await updateGoogleSheet(scenarioBlock, IDENTIFIER, allFailures);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }

  logToFile("\n--- End of Report ---");
  await src.closeAllOpenTabs();
};
