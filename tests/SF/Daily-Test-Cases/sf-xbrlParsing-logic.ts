import { Page, expect } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  configureDisplayColumns,
  fillAndEnter,
  getTabText,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_xbrl_parsing";

export const runXbrlParsingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-XBRL Parsing Report ---");

  const sf = new SfPage(page);

  await sf.clearFiltersBtn.click({ force: true });
  await fillAndEnter(page, sf.formsInput, "10-K", 20);

  const exhibtsToFilingsCheckBox = await sf.exhibitsToFilingsLabel;
  await exhibtsToFilingsCheckBox.click({ force: true });
  await page.getByRole("button", { name: /^Search$/i }).click();

  const searchResult = await getTabText(page, 0, logToFile, false);

  const totalToProcess = 4;
  let processedCount = 0;
  let failureLogs: string[] = [];
  let isFailed = false;

  if (searchResult.includes("Docs")) {
    await configureDisplayColumns(page, {
      "Filing Info": ["Accession #"],
      "Company Info": [],
    });
    while (processedCount < totalToProcess) {
      const scroller = sf.scroller;
      const rowHeight = await sf.rowHeight();

      await sf.scrollToRowIndex(processedCount, rowHeight);

      let currentRow = sf.rowById(processedCount);

      const rowExists = (await currentRow.count()) > 0;
      if (rowExists) {
        await currentRow.evaluate((el) =>
          el.scrollIntoView({ block: "start" }),
        );
      } else {
        await scroller.evaluate((el) => (el.scrollTop += el.clientHeight));
        await page.waitForTimeout(1000);
        continue;
      }

      console.log(`Processing Row: ${1 + processedCount}`);
      const cleanContent = await sf.rowTexts(currentRow);
      const accessionNo =
        cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
        "N/A";
      console.log(`Accession No: ${accessionNo}`);

      const viewBtn = sf.viewButton(currentRow).last();
      const isixbrlBtn = currentRow
        .getByRole("button", { name: /iXBRL/i })
        .first();

      if (!(await isixbrlBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
        console.log(`iXBRL doc not found for ${accessionNo}, skipping...`);
        processedCount++;
        continue;
      }

      try {
        if (await viewBtn.isVisible({ timeout: 5000 })) {
          await viewBtn.click();

          const ixbrlBtn = page.locator("text=/^iXBRL$/i").first();
          if (await ixbrlBtn.isVisible({ timeout: 8000 })) {
            await ixbrlBtn.click();
            const ex101Link = page.locator("text=/^EX-101$/i").first();
            if (await ex101Link.isVisible()) {
              await ex101Link.click();
            } else {
              isFailed = true;
            }
            console.log(
              `Successfully accessed EX-101 for Item ${processedCount + 1}`,
            );
          } else {
            isFailed = true;
          }
        }
      } catch (e: any) {
        console.log(
          `Extraction failed for item at index ${processedCount}: ${e.message}`,
        );
      }

      const resultsTab = page
        .locator('//span[contains(text(), "Docs:")]')
        .first();
      if (await resultsTab.isVisible()) {
        await resultsTab.click();
      }
      await page.waitForTimeout(500);
      processedCount++;
    }
  }

  const scenarioBlock = [
    `Status: ${!isFailed ? "VALID ✅" : "INVALID ❌"}`,
    `Filters Used`,
    `Form: 10-K`,
    `Exhibits to Filings: Exclude`,
    `Search For: Filings`,
    `Failure IDs:`,
    `${failureLogs.length === 0 ? "None" : failureLogs.join("\n")}`,
  ].join("\n");

  await updateGoogleSheet(scenarioBlock, IDENTIFIER, failureLogs);

  logToFile("\n--- End of Report ---");
  await closeAllOpenTabs(page);
};
