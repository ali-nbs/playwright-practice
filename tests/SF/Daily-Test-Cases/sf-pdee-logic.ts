import { Page, expect } from "@playwright/test";
import * as path from "path";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  fillAndEnter,
  getRandomIndices,
  getTabText,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_pdee";

export const runPDEETest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-PDEE (Download & Validation) Report ---");

  const sf = new SfPage(page);

  const clearBtn = sf.clearFiltersBtn;
  await sf.clearFiltersBtn.click({ force: true });
  const exhibtsToFilingsCheckbox = sf.exhibitsToFilingsLabel;
  await exhibtsToFilingsCheckbox.click({ force: true });

  await fillAndEnter(page, sf.dateInput, "Last 7 Days", 20);
  await sf.searchBtn.click();

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

  const scroller = sf.scroller;
  const resultsContainer = sf.resultsContainer;

  for (const index of targetIndices) {
    const rowHeight = await sf.rowHeight();

    await sf.scrollToRowIndex(index, rowHeight);

    const currentRow = sf.rowById(index);

    if ((await currentRow.count()) > 0) {
      await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
      await sf.rowCheckboxLabel(currentRow).check({ force: true });
      logToFile(`Selected Row Index: ${index}`);
    }
  }

  const formats = ["PDF", "DOCX", "HTML"];
  for (let i = 0; i < formats.length; i++) {
    logToFile(`Action: Downloading ${formats[i]}...`);
    const downloadBtn = sf.downloadBtn;
    await downloadBtn.click();
    await sf.dialogCheckboxLabel("coverPage").click({ force: true });
    await sf.downloadFormatOptions.nth(i).click({ force: true });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      sf.okBtnLoose.click(),
    ]);
    const filePath = path.join("./downloads", download.suggestedFilename());
    await download.saveAs(filePath);
    logToFile(`Successfully saved: ${download.suggestedFilename()}`);
  }

  logToFile("Action: Downloading Excel List...");
  await sf.excelListBtn.click();
  await sf.dialogCheckboxLabel("includeTextSnippets").click({ force: true });
  const [excelDownload] = await Promise.all([
    page.waitForEvent("download"),
    sf.okBtnLoose.click(),
  ]);
  await excelDownload.saveAs(
    path.join("./downloads", excelDownload.suggestedFilename()),
  );

 await sf.emailBtn.click();
 sf.okBtnLoose.click();


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
