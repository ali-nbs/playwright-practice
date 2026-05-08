import { Page, Locator, expect } from "@playwright/test";
import * as path from "path";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  configureDisplayColumns,
  getTabText,
  parseCount,
} from "../../utils/helpers";

const IDENTIFIER = "sf_6k_subformType";

export const run6kFormTypeTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-6K Form Type Report ---");

  const TEST_DATA = [{ id: 1, form: "6-K", day: "Last 7 Days", count: 25 }];

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
  const sectionFilterBlock = page
    .locator("div.styles__focusContainer___13rFy")
    .filter({ has: page.locator("label", { hasText: /^Forms$/ }) });

  const sectionPlusBtn = sectionFilterBlock
    .locator("span._icon_1jkal_249.Add")
    .first();
  const modal = page.locator("div.PopupBody__popup__body___1J_d3");

  while (!(await modal.isVisible())) {
    await sectionPlusBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const formsInput = modal.getByTestId("forms-searchInput");
  await formsInput.last().fill(formType);

  const targetLabel = modal
    .locator("label")
    .filter({ hasText: new RegExp(`^${formType}`, "i") })
    .first();
  await targetLabel.click();
  await page.getByRole("button", { name: /^OK$/ }).click();

  // Execute search
  const dateInput = page.locator(
    '//label[text()="Date"]/ancestor::div[5]//input',
  );
  await dateInput.click({ force: true });
  await dateInput.fill("");
  await dateInput.pressSequentially(dateValue, { delay: 100 });

  await page.getByRole("button", { name: /^Search$/i }).click();
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
  let resultsFound = 0;
  let isTestCaseFailed = false;
  let failurelogs: string[] = [];

  while (resultsFound < targetCount) {
    const currentRow = page.locator(
      `div[data-test="resultRow"][id="${resultsFound}"]`,
    );

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

      const texts = await currentRow.locator("span").allInnerTexts();
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
