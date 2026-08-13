import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../utils/helpers";
import { AoePage } from "../pages/AoePage";

const IDENTIFIER = "prod_aoe_clause_validation";

const CLAUSE = "Preamble";

const DOCUMENT_TYPES = [
  "Credit/Loan Agreement",
  "Stock Purchase Agreement",
  "Merger Agreement",
  "Underwriting Agreement",
  "Employment Agreement",
];

/**
 * For each document type, searches twice - once on date + document type,
 * then again with the clause added - and checks the clause filter does not
 * drop any document.
 *
 * Every one of these document types contains a Preamble, so the two
 * searches must return the same count AND the same set of Intelligize IDs.
 * The IDs are compared as well as the counts, because two different sets
 * can be the same size and still mean the clause filter matched the wrong
 * documents.
 */
export const runAoeClauseTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting AOE-Clause Report ---");

  const aoe = new AoePage(page);
  const date = getTargetDateString();

  let failures: string[] = [];

  const collectIds = async (total: number): Promise<Set<string>> => {
    const ids = new Set<string>();

    await aoe.scroller.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(1000);

    await aoe.forEachRow(
      total,
      async (row) => {
        const id = await aoe.rowValueByLabel(row, "Intelligize ID");
        if (id) ids.add(id.trim());
      },
      { keyAttr: "data-ref" },
    );

    return ids;
  };

  for (const docType of DOCUMENT_TYPES) {
    logToFile(`\nTesting Document Type: ${docType}`);

    // ---- Search 1: date + document type ----
    await aoe.clearFilters();
    await aoe.fillAndEnter(aoe.dateInput, date, 700);
    await aoe.fillAndEnter(aoe.docTypeInput, docType, 700);
    await aoe.searchBtn.click();

    const withoutClause = await aoe.trySearchResponse();

    // A failed search used to throw out of the whole flow, losing every
    // document type that had already passed. Record it and move on.
    if (withoutClause.error) {
      failures.push(
        `Document Type: ${docType}\nSearch (without clause) failed: ${withoutClause.error}`,
      );
      logToFile(`${docType} search (without clause) failed: ${withoutClause.error}`);
      continue;
    }

    const countWithoutClause = withoutClause.body.TotalRecords;
    logToFile(`${docType} WITHOUT clause: ${countWithoutClause}`);

    if (countWithoutClause === 0) {
      logToFile(`No records for ${docType}. Moving to next document type.`);
      continue;
    }

    await aoe.configureDisplayColumns({ "Filing Info": ["Intelligize ID"] });
    const idsWithoutClause = await collectIds(countWithoutClause);

    // ---- Search 2: date + document type + clause ----
    await aoe.closeCurrentTab({ waitForGrid: false });
    await aoe.clearFilters();
    await aoe.fillAndEnter(aoe.dateInput, date, 700);
    await aoe.fillAndEnter(aoe.docTypeInput, docType, 700);
    await aoe.fillAndEnter(aoe.sectionTypeInput, CLAUSE, 700);
    await aoe.searchBtn.click();

    const withClause = await aoe.trySearchResponse();
    await page.waitForTimeout(1000);

    if (withClause.error) {
      failures.push(
        `Document Type: ${docType}\nSearch (with clause) failed: ${withClause.error}`,
      );
      logToFile(`${docType} search (with clause) failed: ${withClause.error}`);
      continue;
    }

    const countWithClause = withClause.body.TotalRecords;
    logToFile(`${docType} WITH clause: ${countWithClause}`);

    if (countWithClause === 0) {
      failures.push(
        `Document Type: ${docType}\nWithout Clause Count: ${countWithoutClause}\nWith Clause Count: 0\nMissing IDs: all`,
      );
      continue;
    }

    await aoe.configureDisplayColumns({ "Filing Info": ["Intelligize ID"] });
    const idsWithClause = await collectIds(countWithClause);
    await aoe.closeCurrentTab({ waitForGrid: false });

    // ---- Compare ----
    const missing = [...idsWithoutClause].filter(
      (id) => !idsWithClause.has(id),
    );

    console.log(`${docType} missing IDs:`, missing);

    if (countWithoutClause !== countWithClause || missing.length > 0) {
      failures.push(
        [
          `Document Type: ${docType}`,
          `Without Clause Count: ${countWithoutClause}`,
          `With Clause Count: ${countWithClause}`,
          `Missing IDs:`,
          `${missing.length ? missing.join("\n") : "None"}`,
        ].join("\n"),
      );
    }
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Document Types: ${DOCUMENT_TYPES.join("; ")}`,
    `Section Type: ${CLAUSE}`,
    `Failures:`,
    `${failures.length === 0 ? "None" : failures.join("\n---------------------------------\n")}`,
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
