import { Page, expect } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  configureDisplayColumns,
  fillAndEnter,
  getTabText,
} from "../../utils/helpers";

const IDENTIFIER = "sf_xbrl_parsing";

export const runXbrlParsingTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-XBRL Parsing Report ---");

  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });
  await clearBtn.click({ force: true });
  const formsInput = page.locator("#Forms").getByRole("textbox");
  await fillAndEnter(page, formsInput, "10-K", 20);

  const exhibtsToFilingsCheckBox = await page.locator(
    'label[for="-ExhibitsToFilings"]',
  );
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
      const scroller = page.locator(".ReactVirtualized__Grid").last();
      let resultsContainer = scroller.locator('> div[role="rowgroup"]');

      const rowHeight = await scroller.evaluate((el) => {
        const sampleRow = el.querySelector('[data-test="resultRow"]');
        return sampleRow ? sampleRow.getBoundingClientRect().height : 115;
      });

      await scroller.evaluate(
        (el, { index, height }) => {
          el.scrollTop = index * height;
        },
        { index: processedCount, height: rowHeight },
      );

      let currentRow = resultsContainer
        .locator(`> div > div[data-test="resultRow"][id="${processedCount}"]`)
        .first();

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
      const texts = await currentRow.locator("span").allInnerTexts();
      const cleanContent = texts
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const accessionNo =
        cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
        "N/A";
      console.log(`Accession No: ${accessionNo}`);

      const viewBtn = currentRow.getByRole("button", { name: /View/i }).last();
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
