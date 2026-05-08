import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { fail } from "assert";

const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");
const TARGET_ROW_COUNT = 5;

const Categories = [
  {
    id: "IsSPAC",
    SIC_Code: "6770",
    name: "Special Purpose Acquisition Co (SPAC)",
    identifier: "sf_companyType_SPAC",
  },
  {
    id: "IsREIT",
    SIC_Code: "6798",
    name: "Real Estate Investment Trust (REIT)",
    identifier: "sf_companyType",
  },
  {
    id: "IsBDC",
    SIC_Code: "",
    name: "Business Development Company (BDC)",
    identifier: "sf_companyType",
  },
  {
    id: "IsFPI",
    SIC_Code: "",
    name: "Foreign Private Issuer (FPI)",
    identifier: "sf_companyType",
  },
  {
    id: "IsInvestmentCompany",
    SIC_Code: "",
    name: "Investment Company",
    identifier: "sf_companyType",
  },
];
const setupLogger = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const logDirectory = path.resolve(__dirname, "./Results/sf-companyType");

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const fileName = path.join(logDirectory, `sf-companyType-${timestamp}.txt`);

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

test.describe("SF-CompanyType Automation", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }
  test("SF Company Type", async ({ page }) => {
    const logToFile = setupLogger();
    logToFile("--- Starting Company Type Report ---");

    await performLogin(page, logToFile);

    await page.locator("text=/SEC Filings/i").first().click();
    let finalCompanyTypeReport: string[] = [];
    let failureLogs: string[] = [];

    for (const category of Categories) {
      logToFile(`\n--- Starting Category: ${category.name} ---`);

      const companyTypeFilterBlock = page
        .locator("div.styles__focusContainer___13rFy")
        .filter({
          has: page.locator("label", { hasText: /^Company Type\/Status$/ }),
        });

      const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

      await clearBtn.click();

      await page.waitForTimeout(2000);

      const sectionPlusBtn = companyTypeFilterBlock
        .locator("span._icon_1jkal_249.Add")
        .first();
      const modal = page.locator("div.PopupBody__popup__body___1J_d3");

      while (!(await modal.isVisible())) {
        await sectionPlusBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);

        if (await sectionPlusBtn.isVisible()) {
          await sectionPlusBtn.scrollIntoViewIfNeeded();
        }
      }
      await modal.waitFor({ state: "visible", timeout: 0 });

      await modal.locator(`label[for="${category.id}"]`).click();
      await page.getByRole("button", { name: /^OK$/ }).click();

      let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
      await page.waitForTimeout(2000);
      await exhibitsCheckbox.click();
      await page.waitForTimeout(2000);
      await page
        .getByRole("button", { name: /^Search$/i })
        .first()
        .click();

      const statusLocator = page.locator(
        '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
      );
      await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

      if (
        (await statusLocator.first().innerText()).includes("No Results Found")
      ) {
        throw new Error("No results found for selection.");
      }
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

      const companyInfoCheckbox = page
        .locator(".PopupBody__popup__body___1J_d3")
        .locator("div")
        .filter({ hasText: /^Company Info$/ })
        .locator("._checkbox__icon_1xotg_257");
      await page.waitForTimeout(500);
      await companyInfoCheckbox.click();
      await page.waitForTimeout(500);
      await companyInfoCheckbox.click();

      const companyTypeCheckbox = page
        .locator(".PopupBody__popup__body___1J_d3")
        .locator("div")
        .filter({ hasText: /^Company Type\/Status$/ })
        .locator("._checkbox__icon_1xotg_257");
      await page.waitForTimeout(500);
      await companyTypeCheckbox.click();

      const SICIndustryCheckbox = page
        .locator(".PopupBody__popup__body___1J_d3")
        .locator("div")
        .filter({ hasText: /^SIC - Industry$/ })
        .locator("._checkbox__icon_1xotg_257");
      await page.waitForTimeout(500);
      await SICIndustryCheckbox.click();

      await page
        .getByRole("button", {
          name: "Apply",
        })
        .click();
      await page.waitForTimeout(500);

      let resultsFound = 0;
      let categoryHasFailure = false;

      // await page.pause();

      while (resultsFound < TARGET_ROW_COUNT) {
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
          { index: resultsFound, height: rowHeight },
        );

        console.log(`Processing Row: ${1 + resultsFound}`);
        let currentRow = resultsContainer
          .locator(`> div > div[data-test="resultRow"][id="${resultsFound}"]`)
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

        const fillingInforesultLabel = currentRow.locator("span", {
          hasText: "Accession #",
        });
        const accessionNo = await fillingInforesultLabel
          .locator("xpath=following-sibling::span")
          .innerText();

        console.log(`Accession No : ${accessionNo}`);
        console.log(
          "--------------------------------------------------------------",
        );
        const resultLabel = currentRow.locator("span", {
          hasText: "Company Type/Status",
        });
        const resultValueContainer = resultLabel
          .locator("xpath=..")
          .locator("p");
        const allValues = await resultValueContainer.all();

        let companyTypeMatchFound = false;
        for (const value of allValues) {
          const uiText = await value.innerText();
          if (uiText.toLowerCase().includes(category.name.toLowerCase())) {
            companyTypeMatchFound = true;
            console.log(`Company Type/Status UI Text: ${uiText}`);
          }
        }

        const sicIndustryLabel = currentRow.locator("span", {
          hasText: "SIC - Industry",
        });
        const sicIndustryContainer = sicIndustryLabel
          .locator("xpath=..")
          .locator("p");
        const sicIndustryValues = await sicIndustryContainer.all();
        console.log(
          "--------------------------------------------------------------",
        );
        let sicIndustryMatchFound = false;
        for (const value of sicIndustryValues) {
          const uiText = await value.innerText();
          if (uiText.toLowerCase().includes(category.SIC_Code.toLowerCase())) {
            sicIndustryMatchFound = true;
            console.log(`SIC - Industry UI Text: ${uiText}`);
          }
        }
        console.log(
          "\n--------------------------------------------------------------",
        );
        console.log(
          "--------------------------------------------------------------\n",
        );
        if (!companyTypeMatchFound && category.SIC_Code === "") {
          console.log(
            `Failure: Expected Company Type/Status: ${category.name}`,
          );
          categoryHasFailure = true;
          failureLogs.push(accessionNo);
        } else if (
          !companyTypeMatchFound ||
          (!sicIndustryMatchFound && category.SIC_Code !== "")
        ) {
          console.log(`Failure: Expected SIC - Industry: ${category.SIC_Code}`);
          categoryHasFailure = true;
          failureLogs.push(accessionNo);
        }

        resultsFound++;
      }
      const isSuccess = failureLogs.length === 0;
      console.log("failure logs", failureLogs);
      const finalReport =
        [
          `Status: ${isSuccess ? "Passed ✅" : "Failed ❌"}`,
          ``,
          `Filters Used:`,
          `Exhibits to Filings: Exclude`,
          `Company Type/Status: ${category.name}`,
          `Search For: Filings`,
          ``,
          `Failure IDs:`,
          `${isSuccess ? "None" : failureLogs.join("\n")}`,
        ].join("\n") +
        "\n--------------------------------------------------------------------------------";

      if (category.name == "Special Purpose Acquisition Co (SPAC)") {
        await updateGoogleSheet(finalReport, category.identifier, failureLogs);
      } else {
        finalCompanyTypeReport.push(finalReport);
      }
      failureLogs = [];
      // const activeTab = page.locator('//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]');
      // if (await activeTab.count() > 0) {
      //     try {
      //         await activeTab.first().click({ button: 'right', timeout: 5000 });
      //         // const closeAllBtn = page.locator('div.react-contextmenu-item--visible').filter({ hasText: 'Close all tabs' }).first();
      //         // await closeAllBtn.dispatchEvent('click');
      //         const closeAllBtn = page.locator('nav.react-contextmenu--visible .react-contextmenu-item')
      //             .filter({ hasText: /^Close all tabs$/i });
      //         try {
      //             await closeAllBtn.click({ force: true });
      //         } catch (e) {
      //             await closeAllBtn.dispatchEvent('click');
      //         }
      //         await expect(activeTab).toHaveCount(0, { timeout: 15000 });
      //     } catch (cleanupError) {
      //         await page.reload();
      //     }
      // }
      const activeTab = page
        .locator(
          '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
        )
        .first();
      try {
        if (await activeTab.isVisible()) {
          await activeTab.click({ button: "right" });
          await page
            .locator("text=/Close all tabs/i")
            .click()
            .catch(async () => {
              await page.reload();
            });
        }
      } catch (cleanupError) {
        await page.reload();
      }
      //await page.pause();
    }
    await updateGoogleSheet(
      finalCompanyTypeReport.join("\n"),
      "sf_companyType",
      failureLogs,
    );
  });
});
