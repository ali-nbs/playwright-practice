import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");
const IDENTIFIER = "sf_auditor";

const setupLogger = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const logDirectory = path.resolve(__dirname, "./Results/sf-auditor");

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const fileName = path.join(logDirectory, `sf-auditor-${timestamp}.txt`);

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

const typeValue = async (locator: Locator, value: string, delay: number) => {
  // await locator.click({ force: true });
  await locator.focus();
  await locator.fill("");
  await locator.pressSequentially(value, { delay: delay });
};

const fillAndEnter = async (
  page: Page,
  locator: Locator,
  value: string,
  delay: number,
) => {
  await typeValue(locator, value, delay);
  await page.keyboard.press("Enter");
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

const parseCount = (text: string): number => {
  const digits = text.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

const scrapeResults = async (targetCount: number, page: Page) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount || resultsFound == 24) {
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

          const accessionNo =
            cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
            "N/A";

          const auditorIndex = cleanContent.indexOf("Audited By");
          const recentAuditorIndex = cleanContent.indexOf("Recent Auditor");

          console.log("auditorIndex", auditorIndex);
          console.log("recentAuditorIndex", recentAuditorIndex);

          const recentAuditorName =
            recentAuditorIndex !== -1
              ? cleanContent[recentAuditorIndex + 1]
              : "No Recent Auditor Found";

          const auditorName =
            auditorIndex !== -1
              ? cleanContent[auditorIndex + 1]
              : "No Auditor Found";

          const isLineMissingData =
            (auditorName == "No Auditor Found" &&
              recentAuditorName == "No Recent Auditor Found") ||
            !accessionNo;

          if (isLineMissingData) {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> Acc.No: ${accessionNo} | auditorName: ${auditorName}`,
            );
          } else {
            rowsData.push(
              `Acc.No: ${accessionNo} | auditorName: ${auditorName != "No Auditor Found" ? auditorName : recentAuditorName}`,
            );
          }

          console.log(
            `Acc.No: ${accessionNo} || Auditor ${auditorName != "No Auditor Found" ? auditorName : recentAuditorName}`,
          );
          processedIds.add(rowId);
          await page.waitForTimeout(500);
          resultsFound++;
        } catch (e) {
          console.log(`Skipping Row ${rowId} due to re-render.`);
        }
      }

      if (resultsFound >= targetCount) break;
    }
    if (resultsFound < targetCount) {
      await page.waitForTimeout(500);
      await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
    }
  }

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
test.describe("SF-Auditor Automation", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Auditor", async ({ page }) => {
    const logToFile = setupLogger();
    logToFile("--- Starting SF-Auditor Report ---");

    await performLogin(page, logToFile);

    await page.locator("text=/SEC Filings/i").first().click();

    const dateInput = page.locator(
      '//label[text()="Date"]/ancestor::div[5]//input',
    );
    const formsInput = page.locator("#Forms").getByRole("textbox");
    const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
    const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

    const testCases = [
      { date: "Today", formType: "10-k", count: 15 },
      // { date: 'Yesterday', formType: '10-k', count: 15 },
    ];

    let tabIndex = 0;
    let selectCheckboxes = true;
    let actualTarget = 0;
    let allScenarioResults: string[] = [];

    for (const scenario of testCases) {
      await clearBtn.click();
      await page.waitForTimeout(5000);
      let findings = { text: "No Results Found", isValid: true };

      let amendmentFillingsRadioButton = page.getByTestId(
        "amendmentFilings-radio-EXC",
      );
      await amendmentFillingsRadioButton.click();

      let ownershipFormsRadioButton = page.getByTestId(
        "ownershipForms-radio-INC",
      );
      await ownershipFormsRadioButton.click();

      logToFile(`\nTesting Scenario: ${scenario.date}`);
      await fillAndEnter(page, dateInput, scenario.date, 50);
      logToFile(`\nTesting Form Type: ${scenario.formType}`);
      await fillAndEnter(page, formsInput, scenario.formType, 3000);
      //await formsInput.press('Enter');
      let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');

      await exhibitsCheckbox.click();
      await page.waitForTimeout(2000);
      await searchBtn.click();

      const textDateOnly = await getTabText(page, tabIndex++, logToFile);
      logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

      if (textDateOnly.includes("Docs")) {
        if (selectCheckboxes) {
          const filingInfoPopupCheckbox = page
            .locator(".styles__popupContainer___36f60")
            .filter({ hasText: "Filing Info" })
            .locator("._checkbox__icon_1xotg_257");

          await filingInfoPopupCheckbox.click();
          await page.waitForTimeout(500);

          const filingInfoCheckbox = page
            .locator(".PopupBody__popup__body___1J_d3")
            .locator("div")
            .filter({ hasText: /^Filing Info$/ })
            .locator("._checkbox__icon_1xotg_257");
          await filingInfoCheckbox.click();
          await page.waitForTimeout(500);
          await filingInfoCheckbox.click();
          await page.waitForTimeout(500);

          const accessionCheckbox = page
            .locator(".PopupBody__popup__body___1J_d3")
            .locator("div")
            .filter({ hasText: /^Accession #$/ })
            .locator("._checkbox__icon_1xotg_257");

          await accessionCheckbox.click();
          await page.waitForTimeout(500);
          const auditorCheckbox = page
            .locator(".PopupBody__popup__body___1J_d3")
            .locator("div")
            .filter({ hasText: /^Audited By$/ })
            .locator("._checkbox__icon_1xotg_257");

          await auditorCheckbox.click();
          await page.waitForTimeout(500);

          await page
            .getByRole("button", {
              name: "Apply",
            })
            .click();

          const companyInfoPopupCheckbox = page
            .locator(".styles__popupContainer___36f60")
            .filter({ hasText: "Company Info" })
            .locator("._checkbox__icon_1xotg_257");

          await companyInfoPopupCheckbox.click();
          await page.waitForTimeout(500);

          const companyInfoCheckbox = page
            .locator(".PopupBody__popup__body___1J_d3")
            .locator("div")
            .filter({ hasText: /^Company Info$/ })
            .locator("._checkbox__icon_1xotg_257");

          await companyInfoCheckbox.click();
          await page.waitForTimeout(500);
          await companyInfoCheckbox.click();
          await page.waitForTimeout(500);

          const recentAuditorCheckbox = page
            .locator(".PopupBody__popup__body___1J_d3")
            .locator("div")
            .filter({ hasText: /^Recent Auditor$/ })
            .locator("._checkbox__icon_1xotg_257");

          await recentAuditorCheckbox.click();
          await page.waitForTimeout(500);

          await page
            .getByRole("button", {
              name: "Apply",
            })
            .click();

          selectCheckboxes = false;
        }
        await page.waitForTimeout(500);
        const docsCount = parseCount(textDateOnly);
        actualTarget = Math.min(scenario.count, docsCount);

        findings = await scrapeResults(actualTarget, page);
      }
      const scenarioBlock = [
        `Date: ${scenario.date}`,
        `Doc Count: ${actualTarget}`,
        ``,
        `Results:`,
        findings.text,
        ``,
        `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
      ].join("\n");

      allScenarioResults.push(scenarioBlock);
      // await clearBtn.click();
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
    logToFile("\n--- End of Report ---");
  });
});
