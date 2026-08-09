import { Page, expect } from "@playwright/test";
import * as path from "path";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  fillAndEnter,
  getRandomIndices,
  getTabText,
} from "../../utils/helpers";

const IDENTIFIER = "sf_pdee";

export const runPDEETest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-PDEE (Download & Validation) Report ---");

  const clearBtn = await page.getByRole("button", { name: /^Clear Filters$/i });
  await clearBtn.click({ force: true });
  const exhibtsToFilingsCheckbox = page.locator(
    'label[for="-ExhibitsToFilings"]',
  );
  await exhibtsToFilingsCheckbox.click({ force: true });

  const dateInput = page.locator(
    '//label[text()="Date"]/ancestor::div[5]//input',
  );
  await fillAndEnter(page, dateInput, "Last 7 Days", 20);
  await page.getByRole("button", { name: /^Search$/i }).click();

  const statusText = await getTabText(page, 0, logToFile);
  logToFile(`Search Result: ${statusText}`);

  if (statusText.includes("No Results Found")) {
    logToFile(`Result: VALID (No data to crawl)`);
    await updateGoogleSheet(
      `Status: VALID ✅\nNo results found for Last 7 Days`,
      IDENTIFIER,
    );
    return;
  }

  let targetIndices = getRandomIndices(5, 25).sort((a, b) => a - b);
  logToFile(
    `Action: Targeting random row indices: ${targetIndices.join(", ")}`,
  );

  const scroller = page.locator(".ReactVirtualized__Grid").last();
  const resultsContainer = scroller.locator('> div[role="rowgroup"]');

  for (const index of targetIndices) {
    const rowHeight = await scroller.evaluate((el) => {
      const sampleRow = el.querySelector('[data-test="resultRow"]');
      return sampleRow ? sampleRow.getBoundingClientRect().height : 115;
    });

    await scroller.evaluate(
      (el, { i, h }) => {
        el.scrollTop = i * h;
      },
      { i: index, h: rowHeight },
    );

    const currentRow = resultsContainer
      .locator(`> div > div[data-test="resultRow"][id="${index}"]`)
      .first();

    if ((await currentRow.count()) > 0) {
      await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
      await currentRow.locator("label").first().check({ force: true });
      logToFile(`Selected Row Index: ${index}`);
    }
  }

  const formats = ["PDF", "DOCX", "HTML"];
  for (let i = 0; i < formats.length; i++) {
    logToFile(`Action: Downloading ${formats[i]}...`);
    const downloadBtn = page.locator('button[title*="Download"]');
    await downloadBtn.click();
    await page.locator('label[for="coverPage"]').click({ force: true });
    await page.locator('div[name="formats"]').nth(i).click({ force: true });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /ok/i }).click(),
    ]);
    const filePath = path.join("./downloads", download.suggestedFilename());
    await download.saveAs(filePath);
    logToFile(`Successfully saved: ${download.suggestedFilename()}`);
  }

  logToFile("Action: Downloading Excel List...");
  await page.locator('button:has-text("Excel List")').click();
  await page.locator('label[for="includeTextSnippets"]').click({ force: true });
  const [excelDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /ok/i }).click(),
  ]);
  await excelDownload.saveAs(
    path.join("./downloads", excelDownload.suggestedFilename()),
  );

 await page.locator('span[title="Email the selected items from the list below"]').click();
 page.getByRole("button", { name: /ok/i }).click();


  const summary = [
    `Status: "VALID ✅"`,
    `Date: Last 7 Days`,
    `Selected Rows: ${targetIndices.length}`,
    `Downloads: PDF, DOCX, HTML, Excel (Success)`,
    `Timestamp: ${new Date().toLocaleString()}`,
  ].join("\n");

  await updateGoogleSheet(summary, IDENTIFIER);
  await closeAllOpenTabs(page);
  logToFile("--- SF-PDEE Report Completed ---");
};
