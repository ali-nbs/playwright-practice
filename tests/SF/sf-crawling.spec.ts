import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");
const IDENTIFIER = "sf_crawling";

const setupLogger = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const logDirectory = path.resolve(__dirname, "./Results/sf-crawling");

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const fileName = path.join(logDirectory, `sf-crawling-${timestamp}.txt`);

  return (message: string) => {
    fs.appendFileSync(fileName, message + "\n");
    console.log(message);
  };
};

const performLogin = async (page: Page, logToFile: Function) => {
  await page.goto("/");

  const userIdInput = page.locator("#userid");

  if (await userIdInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    logToFile("Session expired or not found. Performing manual login...");

    await userIdInput.fill(process.env.APP_USERNAME!);
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator("#password").fill(process.env.APP_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(/.*apps.intelligize.com/, {
      waitUntil: "networkidle",
    });
    await page.context().storageState({ path: AUTH_PATH });
    logToFile("Login successful. auth.json updated.");
  } else {
    logToFile("Active session detected via auth.json. Skipping login.");
  }
};

const typeValue = async (locator: Locator, value: string) => {
  // await locator.click({ force: true });
  await locator.focus();
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 50 });
};

const fillAndEnter = async (page: Page, locator: Locator, value: string) => {
  await typeValue(locator, value);
  // await page.keyboard.press('Enter');
};

const getTabText = async (
  page: Page,
  expectedIndex: number,
  logToFile: Function,
) => {
  const tabLocator = page.locator(
    '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
  );
  await expect(tabLocator.nth(expectedIndex)).toBeVisible({ timeout: 240000 });
  //return await tabLocator.nth(expectedIndex).innerText();
  let text = await tabLocator.nth(expectedIndex).innerText();
  return text;
};

const scrapeResults = async (targetCount: number, page: Page) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount) {
    const scroller = page.locator(".ReactVirtualized__Grid").last();
    const rows = scroller.locator('div[data-test="resultRow"]');
    const visibleRowCount = await rows.count();

    if (visibleRowCount === 0) {
      await page.waitForTimeout(500);
      continue;
    }

    for (let i = 0; i < visibleRowCount; i++) {
      const row = rows.nth(i);
      const rowId = await row.getAttribute("id");

      if (rowId && !processedIds.has(rowId)) {
        try {
          const texts = await row.locator("span").allInnerTexts();
          const cleanContent = texts
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

          const companyName = cleanContent[4] || "";
          const pages = cleanContent[5] || "";
          const docSize = cleanContent[6] || "";
          const accessionNo = cleanContent[cleanContent.length - 1] || "";

          // Check if any of the 4 are missing
          const isLineMissingData =
            !companyName || !pages || !docSize || !accessionNo;

          if (isLineMissingData) {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> Acc.No: ${accessionNo} | Co: ${companyName} | Pg: ${pages} | Sz: ${docSize}`,
            );
          } else {
            rowsData.push(
              `Acc.No: ${accessionNo} | Co: ${companyName} | Pg: ${pages} | Sz: ${docSize}`,
            );
          }
          console.log("```````````````````````````````````````");
          console.log(`Row ${rowId}:`);
          console.log(
            `Acc.No: ${accessionNo} | Co: ${companyName} | Pg: ${pages} | Sz: ${docSize}`,
          );
          console.log("```````````````````````````````````````");
          processedIds.add(rowId);
          await page.waitForTimeout(500);
          resultsFound++;
        } catch (e) {
          continue;
        }
      }
      if (resultsFound >= targetCount) break;
    }
    if (resultsFound < targetCount) {
      await page.waitForTimeout(500);
      await rows.last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
  }
  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
test.describe("SF-Crawling Automation", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Crawling", async ({ page }) => {
    const logToFile = setupLogger();
    logToFile("--- Starting SF-Crawling Report ---");
    let allScenarioResults: string[] = [];

    await performLogin(page, logToFile);
    await page.locator("text=/SEC Filings/i").first().click();

    const dateInput = page.locator(
      '//label[text()="Date"]/ancestor::div[5]//input',
    );
    const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
    const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

    const testCases = [
      { date: "Today", count: 15 },
      //{ date: 'Yesterday', count: 25 },
    ];

    let tabIndex = 0;

    for (const scenario of testCases) {
      await page.locator('label[for="-ExhibitsToFilings"]').click();
      await page.getByTestId("amendmentFilings-radio-EXC").click();
      await page.getByTestId("ownershipForms-radio-INC").click();

      await fillAndEnter(page, dateInput, scenario.date);
      await searchBtn.click();

      const textDateOnly = await getTabText(page, tabIndex++, logToFile);
      let findings = { text: "No Results Found", isValid: true };

      if (textDateOnly.includes("Docs")) {
        // Setup Columns
        await page
          .locator(".styles__popupContainer___36f60")
          .filter({ hasText: "Filing Info" })
          .locator("._checkbox__icon_1xotg_257")
          .click();

        const filingInfoCheckbox = page
          .locator(".PopupBody__popup__body___1J_d3")
          .locator("div")
          .filter({ hasText: /^Filing Info$/ })
          .locator("._checkbox__icon_1xotg_257");
        await filingInfoCheckbox.click();
        await filingInfoCheckbox.click();
        await page
          .locator(".PopupBody__popup__body___1J_d3")
          .locator("div")
          .filter({ hasText: /^Accession #$/ })
          .locator("._checkbox__icon_1xotg_257")
          .click();
        await page.getByRole("button", { name: "Apply" }).click();

        await page
          .locator(".styles__popupContainer___36f60")
          .filter({ hasText: "Company Info" })
          .locator("._checkbox__icon_1xotg_257")
          .click();
        const companyInfoCheckbox = page
          .locator(".PopupBody__popup__body___1J_d3")
          .locator("div")
          .filter({ hasText: /^Company Info$/ })
          .locator("._checkbox__icon_1xotg_257");
        await companyInfoCheckbox.click();
        await companyInfoCheckbox.click();
        await page.getByRole("button", { name: "Apply" }).click();
        await page.waitForTimeout(500);

        findings = await scrapeResults(scenario.count, page);
      }

      const scenarioBlock = [
        `Date: ${scenario.date}`,
        `Target Doc Count: ${scenario.count}`,
        ``,
        `Results:`,
        findings.text,
        ``,
        `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
      ].join("\n");

      allScenarioResults.push(scenarioBlock);
      await clearBtn.click();
    }

    const finalDump = allScenarioResults.join(
      "\n---------------------------------\n",
    );

    try {
      await updateGoogleSheet(finalDump, IDENTIFIER);
      logToFile("Sheet updated successfully.");
    } catch (e: any) {
      logToFile(`Sheet update failed: ${e.message}`);
    }
  });
});
