import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../utils/helpers";
import { HIGHLIGHT_BG_COLOR } from "../pages/BasePage";
import { AoePage } from "../pages/AoePage";

/**
 * AOE keyword-highlight verification, for both search types.
 *
 * Boolean and Conceptual are the same test with two differences, so they
 * share one scenario runner here and get one exported runner (and one spec)
 * each rather than a copy of the whole flow:
 *
 *   1. which search type is selected, and
 *   2. Conceptual has to click the first highlighted snippet before
 *      checking each document. A conceptual match is semantic, so the
 *      viewer does not land on a highlight by itself the way a literal
 *      boolean match does.
 *
 * Each scenario checks the same two places: the opened document, and the
 * snippet of every result row.
 */

const BOOLEAN_KEYWORD = "is or the or a";
const CONCEPTUAL_KEYWORD = "cybersecurity";
const MAX_DOCS = 25;

type Scenario = {
  identifier: string;
  label: string;
  searchType: "Boolean" | "Conceptual";
  keyword: string;
  clickSnippetFirst: boolean;
};

const runScenario = async (
  page: Page,
  logToFile: Function,
  scenario: Scenario,
) => {
  logToFile(`--- Starting AOE-${scenario.label} Highlight Report ---`);

  const aoe = new AoePage(page);
  const date = getTargetDateString();

  await aoe.clearFilters();
  await page.waitForTimeout(1000);

  await aoe.fillAndEnter(aoe.dateInput, date, 700);
  await aoe.selectSearchType(scenario.searchType);
  await aoe.fillAndEnter(aoe.keywordsInput, scenario.keyword, 700);

  const { body, error: searchError } = await aoe.trySearchResponse();
  logToFile(`Total Records: ${body.TotalRecords}`);

  let docFailures: string[] = [];

  // A search that errored or never fired used to throw straight out of
  // the flow, so nothing was ever written to the sheet. Record it as a
  // failure instead and let the report still be produced.
  if (searchError) {
    docFailures.push(`Search failed: ${searchError}`);
    logToFile(`Search failed: ${searchError}`);
  }
  let gridFailures: string[] = [];
  let docsVerified = 0;
  let rowsVerified = 0;

  if (body.TotalRecords > 0) {
    await aoe.configureDisplayColumns({ "Filing Info": ["Intelligize ID"] });

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    // ---- Document viewer ----
    await aoe.clickViewForRow(aoe.refRows.first());

    for (let i = 0; i < target; i++) {
      if (scenario.clickSnippetFirst) {
        await page.waitForTimeout(1000);
        await aoe.clickFirstHighlightedSnippet();
      }

      const highlighted = await aoe.hasDocumentHighlight();
      docsVerified++;

      if (!highlighted) {
        await aoe.openInfoTab();
        const id = await aoe.openDocIntelligizeId();

        docFailures.push(
          `Intelligize ID: ${id} -> no highlight in document viewer.`,
        );
        logToFile(`Document ${i + 1} failed: ${id}`);
      }

      if (i < target - 1) {
        await aoe.clickNextDocument();
        await page.waitForLoadState("domcontentloaded");
        if (scenario.clickSnippetFirst) {
          await page.waitForTimeout(1000);
        }
      }

      console.log(`Document ${i + 1} processed | highlighted: ${highlighted}`);
    }

    await aoe.closeCurrentTab();

    // ---- Result grid ----
    await aoe.forEachRefRow(target, async (row) => {
      const id = await aoe.rowIntelligizeId(row);
      const { found, invalidColor } = await aoe.checkRowHighlights(
        aoe.rowSnippetContainer(row),
        "em.highlight",
      );

      rowsVerified++;

      if (!found) {
        gridFailures.push(
          `Intelligize ID: ${id} -> no highlight in result-grid snippet.`,
        );
      } else if (invalidColor) {
        gridFailures.push(
          `Intelligize ID: ${id} -> snippet highlight colour is not ${HIGHLIGHT_BG_COLOR}.`,
        );
      }

      console.log(`Row ${rowsVerified} -> ${id} | highlighted: ${found}`);
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
  await aoe.closeAllOpenTabs();
};

export const runAoeBooleanHighlightTest = async (
  page: Page,
  logToFile: Function,
) =>
  runScenario(page, logToFile, {
    identifier: "aoe_booleanHighlight",
    label: "Boolean",
    searchType: "Boolean",
    keyword: BOOLEAN_KEYWORD,
    clickSnippetFirst: false,
  });

export const runAoeConceptualHighlightTest = async (
  page: Page,
  logToFile: Function,
) =>
  runScenario(page, logToFile, {
    identifier: "aoe_conceptualHighlight",
    label: "Conceptual",
    searchType: "Conceptual",
    keyword: CONCEPTUAL_KEYWORD,
    clickSnippetFirst: true,
  });
