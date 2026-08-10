import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { getTargetDateString, parseCount } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_6k_subformType";

export const run6kFormTypeTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-6K Form Type Report ---");

  const sf = new SfPage(page);

  const TEST_DATA = [
    { id: 1, form: "6-K", day: getTargetDateString(), count: 25 },
  ];

  for (const data of TEST_DATA) {
    await selectFormTypeAndSearch(sf, page, data.form, data.day);
    const availableDocsText = await sf.getTabText(0, logToFile, true);
    const availableDocs = parseCount(availableDocsText);
    if (availableDocs > 0) {
      await sf.configureDisplayColumns({
        "Filing Info": ["Accession #"],
        "Company Info": [],
      });
      const finalScrapeLimit = Math.min(data.count, availableDocs);
      await scrapeResults(sf, page, finalScrapeLimit, data.form);
    } else {
      logToFile(`Index ${data.id}: Move to next...`);
    }
  }

  logToFile("\n--- End of Report ---");
  await sf.closeAllOpenTabs();
};

async function selectFormTypeAndSearch(
  sf: SfPage,
  page: Page,
  formType: string,
  dateValue: string,
) {
  const modal = sf.popupBody;

  while (!(await modal.isVisible())) {
    await sf.filterAddIcon(/^Forms$/).click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  await sf.formsModalSearchInput.last().fill(formType);
  await sf.formsModalOption(formType).click();
  await sf.okBtn.click();

  // Execute search
  await sf.clearAndType(sf.dateInput, dateValue, 100);

  await sf.searchBtn.click();
  await sf.waitForResults(60000);
}

async function scrapeResults(
  sf: SfPage,
  page: Page,
  targetCount: number,
  formType: string,
) {
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
      const formTypeCell = sf.rowFormTypeCell(currentRow, formType);
      await formTypeCell.waitFor({ state: "attached", timeout: 3000 });
      const rowText = await formTypeCell.innerText();

      const cleanContent = await sf.rowTexts(currentRow);

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
