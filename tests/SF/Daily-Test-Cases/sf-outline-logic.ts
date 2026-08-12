import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_outline";

const FORM_TYPES = "10-K;8-K";
const MAX_DOCS = 25;

/**
 * Opens the first result and steps through documents with the viewer's Next
 * control, checking each one renders its Outline tab.
 *
 * Only 10-K and 8-K are searched because those are the forms the app builds
 * an outline for; other forms would legitimately have none.
 *
 * The 10s settle wait before each check is deliberate: the Outline tab is
 * built after the document body renders, and checking earlier reports a
 * document that does have an outline as missing one.
 */
export const runOutlineTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Outline Report ---");

  const sf = new SfPage(page);
  const date = getTargetDateString();

  await sf.clearFilters();
  await page.waitForTimeout(1000);

  await sf.fillAndEnter(sf.dateInput, date);
  await sf.applyFormTypes(FORM_TYPES);
  await sf.search();

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
    const target = Math.min(body.TotalRecords, MAX_DOCS);

    await sf.clickViewForRow(sf.refRows.first());

    for (let i = 0; i < target; i++) {
      await page.waitForTimeout(10000);

      const isActive = await sf.isOutlineTabActive();
      verified++;

      if (!isActive) {
        await sf.openInfoTab();
        const id = await sf.openDocIntelligizeId();

        failures.push(`Intelligize ID: ${id} -> Outline tab did not render.`);
        logToFile(`Document ${i + 1} failed: ${id}`);
      }

      if (i < target - 1) {
        await sf.clickNextDocument();
        await page.waitForLoadState("domcontentloaded");
      }

      console.log(`Document ${i + 1} processed | outline: ${isActive}`);
    }
  }

  const scenarioBlock = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Date: ${date}`,
    `Form: ${FORM_TYPES}`,
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
