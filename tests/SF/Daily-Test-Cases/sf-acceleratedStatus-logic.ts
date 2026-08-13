import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "prod_sf_AccStatus_validation";

const ACCELERATED_STATUS = "Large Accelerated Filer";
const FORM_TYPES = "10-K;10-Q;S-4;DEF 14A;40-F;20-F";
const MAX_DOCS = 2;

export const runAcceleratedStatusTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting SF-Accelerated Status Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.fillAndEnter(sf.dateInput, date);
  await sf.fillAndEnter(sf.formsInput,FORM_TYPES);
  logToFile(`Forms applied: ${FORM_TYPES}`);
  await sf.fillAndEnter(sf.acceleratedStatusInput, ACCELERATED_STATUS, 1000);
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
    await sf.configureDisplayColumns({
      "Filing Info": ["Intelligize ID"],
      "Company Info": ["Accelerated Status"],
    });

    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.forEachRow(
      target,
      async (row) => {
        const id = await sf.rowValueByLabel(row, "Intelligize ID");
        const status = await sf.rowValueByLabel(row, "Accelerated Status", {
        inParagraph: true,
        });

        verified++;

        if (status !== ACCELERATED_STATUS) {
          failures.push(
            `Intelligize ID: ${id} -> Accelerated Status is "${status}", expected "${ACCELERATED_STATUS}".`,
          );
        }

        console.log(`Row ${verified} -> ${id} | ${status}`);
      },
      { keyAttr: "data-ref" },
    );
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Form: ${FORM_TYPES}`,
    `Accelerated Status: ${ACCELERATED_STATUS}`,
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
