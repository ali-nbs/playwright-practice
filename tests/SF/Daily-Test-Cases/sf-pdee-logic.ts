import { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { cleanErrorMessage, getRandomIndices } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_pdee";

const DOWNLOAD_TIMEOUT = 60000;

export const runPDEETest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-PDEE (Download & Validation) Report ---");

  const sf = new SfPage(page);

  await sf.clearFilters();
  const exhibtsToFilingsCheckbox = sf.exhibitsToFilingsLabel;
  await exhibtsToFilingsCheckbox.click({ force: true });

  await sf.fillAndEnter(sf.dateInput, "Last 7 Days", 20);
  await sf.searchBtn.click();

  const statusText = await sf.getTabText(0, logToFile);
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

  const failures: string[] = [];
  let selectedRows = 0;

  for (const index of targetIndices) {
    const currentRow =  sf.rowById(index);

    if ((await currentRow.count()) > 0) {
      await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
      await currentRow.locator("label").first().check({ force: true });
      selectedRows++;
      logToFile(`Selected Row Index: ${index}`);
    } else {
      failures.push(`Row index ${index} was not present in the grid.`);
    }
  }

  const saveAndVerify = async (
    download: import("@playwright/test").Download,
    label: string,
  ) => {
    const fileName = download.suggestedFilename();
    const filePath = path.join("./downloads", fileName);

    await download.saveAs(filePath);

    const failure = await download.failure();
    if (failure) {
      failures.push(`${label} download failed: ${failure}`);
      return;
    }

    if (!fs.existsSync(filePath)) {
      failures.push(`${label} download did not produce a file (${fileName}).`);
      return;
    }

    const { size } = fs.statSync(filePath);
    if (size === 0) {
      failures.push(`${label} download saved an empty file (${fileName}).`);
      return;
    }

    logToFile(`Successfully saved: ${fileName} (${size} bytes)`);
  };

  const downloadedFormats: string[] = [];

  const formats = ["PDF", "DOCX", "HTML"];
  for (let i = 0; i < formats.length; i++) {
    logToFile(`Action: Downloading ${formats[i]}...`);

    try {
      const downloadBtn = sf.downloadBtn;
      await downloadBtn.click();
      await sf.dialogCheckboxLabel("coverPage").click({ force: true });
      await sf.downloadFormatOptions.nth(i).click({ force: true });

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: DOWNLOAD_TIMEOUT }),
        sf.okBtn.click(),
      ]);

      await saveAndVerify(download, formats[i]);
      downloadedFormats.push(formats[i]);
    } catch (e) {
      failures.push(`${formats[i]} download failed: ${cleanErrorMessage(e)}`);
      logToFile(`${formats[i]} download failed: ${cleanErrorMessage(e)}`);
    }
  }

  logToFile("Action: Downloading Excel List...");
  try {
    await sf.excelListBtn.click();
    await sf.dialogCheckboxLabel("includeTextSnippets").click({ force: true });

    const [excelDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: DOWNLOAD_TIMEOUT }),
      sf.okBtn.click(),
    ]);

    await saveAndVerify(excelDownload, "Excel");
    downloadedFormats.push("Excel");
  } catch (e) {
    failures.push(`Excel download failed: ${cleanErrorMessage(e)}`);
    logToFile(`Excel download failed: ${cleanErrorMessage(e)}`);
  }

  try {
    await sf.emailBtn.click();
    await sf.okBtn.click();
  } catch (e) {
    failures.push(`Email dialog failed: ${cleanErrorMessage(e)}`);
    logToFile(`Email dialog failed: ${cleanErrorMessage(e)}`);
  }

  const summary = [
    `Status: ${failures.length === 0 ? "VALID ✅" : "INVALID ❌"}`,
    `Date: Last 7 Days`,
    `Rows Targeted: ${targetIndices.length}`,
    `Rows Selected: ${selectedRows}`,
    `Downloads: ${downloadedFormats.length === 0 ? "None" : downloadedFormats.join(", ")}`,
    `Failures:`,
    `${failures.length === 0 ? "None" : failures.join("\n")}`,
    `Timestamp: ${new Date().toLocaleString()}`,
  ].join("\n");

  await updateGoogleSheet(summary, IDENTIFIER, failures);
  await sf.closeAllOpenTabs();
  logToFile("--- SF-PDEE Report Completed ---");
};
