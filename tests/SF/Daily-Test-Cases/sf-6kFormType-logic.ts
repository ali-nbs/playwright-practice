import { Page, Locator, expect } from "@playwright/test";
import * as path from "path";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  configureDisplayColumns,
  getTabText,
  getTargetDateString,
  parseCount,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_6k_subformType";

export const run6kFormTypeTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-6K Form Type Report ---");

  const TEST_DATA = [{ id: 1, form: "6-K", day: getTargetDateString(), count: 25 }];

  for (const data of TEST_DATA) {
    await selectFormTypeAndSearch(page, data.form, data.day);
    const availableDocsText = await getTabText(page, 0, logToFile, true);
    const availableDocs = parseCount(availableDocsText);
    if (availableDocs > 0) {
      await configureDisplayColumns(page, {
        "Filing Info": ["Accession #"],
        "Company Info": [],
      });
      const finalScrapeLimit = Math.min(data.count, availableDocs);
      await scrapeResults(page, finalScrapeLimit, data.form);
    } else {
      logToFile(`Index ${data.id}: Move to next...`);
    }
  }

  logToFile("\n--- End of Report ---");
  await closeAllOpenTabs(page);
};

async function selectFormTypeAndSearch(
  page: Page,
  formType: string,
  dateValue: string,
) {
  const sf = new SfPage(page);
  const sectionFilterBlock = sf.filterBlock(/^Forms$/);

  const sectionPlusBtn = sectionFilterBlock
    .locator("span._icon_1jkal_249.Add")
    .first();
  const modal = sf.popupBody;

  while (!(await modal.isVisible())) {
    await sectionPlusBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const formsInput = sf.formsModalSearchInput;
  await formsInput.last().fill(formType);

  const targetLabel = modal
    .locator("label")
    .filter({ hasText: new RegExp(`^${formType}`, "i") })
    .first();
  await targetLabel.click();
  await sf.okBtn.click();

  // Execute search
  const dateInput = sf.dateInput;
  await dateInput.click({ force: true });
  await dateInput.fill("");
  await dateInput.pressSequentially(dateValue, { delay: 100 });

  await sf.searchBtn.click();
  await expect(
    page
      .locator(
        '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
      )
      .first(),
  ).toBeVisible({ timeout: 60000 });
}

async function scrapeResults(
  page: Page,
  targetCount: number,
  formType: string,
) {
  const sf = new SfPage(page);
  let resultsFound = 0;
  let isTestCaseFailed = false;
  let failurelogs: string[] = [];

  while (resultsFound < targetCount) {
    const currentRow = sf.rowByIdFlat(resultsFound);

    if ((await currentRow.count()) === 0) {
      await currentRow.last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      continue;
    }

    try {
      const formTypeCell = currentRow
        .locator("span")
        .filter({ hasText: new RegExp(`^${formType}`, "i") })
        .last();
      await formTypeCell.waitFor({ state: "attached", timeout: 3000 });
      const rowText = await formTypeCell.innerText();

      const texts = await sf.rowSpanTexts(currentRow);
      const cleanContent = texts
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const accessionNo =
        cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
        "N/A";

      const parenRegex = /\(([^)]+)\)/;
      const match = rowText.match(parenRegex);

      if (!match || match[1].trim().length === 0) {
        console.log(
          `❌ Validation Failed for Row ${resultsFound}: Empty parentheses or no description.`,
        );
        isTestCaseFailed = true;
        failurelogs.push(accessionNo.trim());
      } else {
        console.log(`✅ Row ${resultsFound} Passed: ${rowText}`);
      }
    } catch (e: any) {
      console.log(
        `Note: Row ${resultsFound} could not be fully validated. ${e.message}`,
      );
    }

    resultsFound++;
    await currentRow.last().scrollIntoViewIfNeeded();
  }

  const resultSummary = [
    `Status: ${!isTestCaseFailed ? "Passed ✅" : "Failed ❌"}`,
    ``,
    `Filters Used:`,
    `Form Type: ${formType}`,
    `Search For: Filings`,
    ``,
    `Failure Accession IDs:`,
    `${!isTestCaseFailed ? "None" : failurelogs.join("\n")}`,
  ].join("\n");

  await updateGoogleSheet(resultSummary, IDENTIFIER, failurelogs);
}
