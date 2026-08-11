import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../utils/helpers";
import { HIGHLIGHT_BG_COLOR } from "../pages/BasePage";
import { DbmPage, DbmRowDetails } from "../pages/DbmPage";

/**
 * DBM keyword-highlight verification, for both search types.
 *
 * Boolean and Conceptual run the identical checks and differ only in the
 * search type and the keyword, so they share one scenario runner and get
 * one exported runner (and one spec) each.
 *
 * Rows and documents are named by company/section/date rather than by an
 * Intelligize ID, because DBM's grid is section-level: one filing shows up
 * as several rows that an ID could not tell apart.
 */

const BOOLEAN_KEYWORD = "(is or the)";
const CONCEPTUAL_KEYWORD = "cybersecurity";
const MAX_DOCS = 25;

type Scenario = {
  identifier: string;
  label: string;
  searchType: "Boolean" | "Conceptual";
  keyword: string;
};

const describeRow = (details: DbmRowDetails) =>
  `${details.company} - ${details.sectionType} - ${details.dateFiled}`;

const runScenario = async (
  page: Page,
  logToFile: Function,
  scenario: Scenario,
) => {
  logToFile(`--- Starting DBM-${scenario.label} Highlight Report ---`);

  const dbm = new DbmPage(page);
  const date = getTargetDateString();

  await dbm.clearFilters();
  await page.waitForTimeout(1000);

  await dbm.fillAndEnter(dbm.dateInput, date, 700);
  await dbm.selectSearchType(scenario.searchType);
  await dbm.fillAndEnter(dbm.bodyKeywordsInput, scenario.keyword, 700);

  const body = await dbm.waitForSearchResponse();
  logToFile(`Total Records: ${body.TotalRecords}`);

  let docFailures: string[] = [];
  let gridFailures: string[] = [];
  let docsVerified = 0;
  let rowsVerified = 0;

  if (body.TotalRecords > 0) {
    const target = Math.min(body.TotalRecords, MAX_DOCS);

    // ---- Document viewer ----
    await dbm.clickViewForRow(dbm.refRows.first());

    for (let i = 0; i < target; i++) {
      await page.waitForTimeout(100);

      const highlighted = await dbm.hasDbmDocumentHighlight();
      docsVerified++;

      if (!highlighted) {
        const details = await dbm.openDocDetails();
        docFailures.push(
          `${describeRow(details)} -> no highlight in document viewer.`,
        );
        logToFile(`Document ${i + 1} failed: ${describeRow(details)}`);
      }

      if (i < target - 1) {
        await dbm.clickNextDocument();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1000);
      }

      console.log(`Document ${i + 1} processed | highlighted: ${highlighted}`);
    }

    await dbm.closeCurrentDocumentTab();

    // ---- Result grid ----
    await dbm.forEachRefRow(target, async (row) => {
      const details = await dbm.rowDetails(row);
      const { found, invalidColor } = await dbm.checkRowHighlights(
        row,
        "customhighlight",
      );

      rowsVerified++;

      if (!found) {
        gridFailures.push(
          `${describeRow(details)} -> no highlighted keyword in row.`,
        );
      } else if (invalidColor) {
        gridFailures.push(
          `${describeRow(details)} -> highlight colour is not ${HIGHLIGHT_BG_COLOR}.`,
        );
      }

      console.log(
        `Row ${rowsVerified} -> ${describeRow(details)} | highlighted: ${found}`,
      );
    });
  }

  const allFailures = [...docFailures, ...gridFailures];

  const scenarioBlock = [
    `Status: ${allFailures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Keyword: ${scenario.keyword}`,
    `Search Type: ${scenario.searchType}`,
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
    await updateGoogleSheet(scenarioBlock, scenario.identifier, allFailures);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }

  logToFile("\n--- End of Report ---");
  await dbm.closeAllOpenTabs();
};

export const runDbmBooleanHighlightTest = async (
  page: Page,
  logToFile: Function,
) =>
  runScenario(page, logToFile, {
    identifier: "dbm_booleanHighlight",
    label: "Boolean",
    searchType: "Boolean",
    keyword: BOOLEAN_KEYWORD,
  });

export const runDbmConceptualHighlightTest = async (
  page: Page,
  logToFile: Function,
) =>
  runScenario(page, logToFile, {
    identifier: "dbm_conceptualHighlight",
    label: "Conceptual",
    searchType: "Conceptual",
    keyword: CONCEPTUAL_KEYWORD,
  });
