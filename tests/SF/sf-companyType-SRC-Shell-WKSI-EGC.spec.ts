import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");
const TARGET_ROW_COUNT = 1;

const Categories = [
  {
    id: "IsSRC",
    label: "Entity Small Business",
    name: "SRC",
    identifier: "sf_companyType_SRC",
  },
  {
    id: "IsShellCompany",
    label: "Entity Shell Company",
    name: "Shell Company",
    identifier: "sf_companyType_ShellCompany",
  },
  {
    id: "IsWKSI",
    label: "Entity Well-known Seasoned Issuer",
    name: "WKSI",
    identifier: "sf_companyType_WKSI",
  },
  {
    id: "IsEGC",
    label: "Entity Emerging Growth Company",
    name: "EGC",
    identifier: "sf_companyType_EGC",
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

      const formsInput = page.locator("#Forms").getByRole("textbox");
      await formsInput.click();
      //await formsInput.pressSequentially("10-K", { delay: 500 });
      await page.keyboard.type("10-K", { delay: 100 });
      await page.waitForTimeout(500);
      await formsInput.press("Enter");
      let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
      //await page.waitForTimeout(2000);
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

      await filingInfoPopupCheckbox.first().click();
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

      await page
        .getByRole("button", {
          name: "Apply",
        })
        .click();

      let resultsFound = 0;
      let categoryHasFailure = false;
      let failureLogs: string[] = [];
      // await page.pause();

      while (resultsFound < TARGET_ROW_COUNT) {
        const scroller = page.locator(".ReactVirtualized__Grid").last();
        //let resultsContainer = scroller.locator('div[role="rowgroup"]').first();
        let resultsContainer = scroller.locator('> div[role="rowgroup"]');
        const rowHeight = await scroller.evaluate((el) => {
          const sampleRow = el.querySelector('[data-test="resultRow"]');
          return sampleRow ? sampleRow.getBoundingClientRect().height : 115;
        });

        // console.log(`Measured row height: ${rowHeight}px`);
        await scroller.evaluate(
          (el, { index, height }) => {
            el.scrollTop = index * height;
          },
          { index: resultsFound, height: rowHeight },
        );

        console.log(`Processing Row: ${1 + resultsFound}`);

        const currentRowCount = await resultsContainer
          .locator(`div[data-test="resultRow"][id="${resultsFound}"]`)
          .count();
        // console.log("current row count", resultsFound, currentRowCount);

        //let currentRow = resultsContainer.locator(`div[data-test="resultRow"][id="${resultsFound}"]`).first();
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

        const viewBtnCount = await currentRow
          .getByRole("button", { name: /View/i })
          .count();
        // console.log("view button count ", viewBtnCount);
        const viewBtn = currentRow
          .getByRole("button", { name: /View/i })
          .last();

        const fillingInforesultLabel = currentRow.locator("span", {
          hasText: "Accession #",
        });
        const AccNoContainer = fillingInforesultLabel
          .locator("xpath=..")
          .locator("span");
        const accValues = await AccNoContainer.all();
        let accessionNo = "";
        for (const val of accValues) {
          const text = await val.innerText();
          if (text.includes("-")) accessionNo = text.trim(); // Identify the actual ID
        }
        console.log(`Accession No: ${accessionNo}`);
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
        console.log(
          "--------------------------------------------------------------",
        );
        console.log(
          "--------------------------------------------------------------\n",
        );
        let uiMatchFound = false;
        for (const value of allValues) {
          const uiText = await value.innerText();
          // Check if current row UI matches the category we are testing
          if (
            uiText.toLowerCase().includes(category.name.toLowerCase()) ||
            uiText.toLowerCase().includes(category.label.toLowerCase())
          ) {
            uiMatchFound = true;
          }
        }
        console.log(
          "--------------------------------------------------------------\n",
        );

        if (await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          try {
            await viewBtn.click();
            await page.locator("text=/^iXBRL$/i").first().click();
            await page.locator("text=/^EX-101$/i").first().click();

            const xbrlFrame = page
              .frameLocator('iframe[src*="/SECFilings/Documents/"]')
              .first();
            const getValue = async (labels: string[]) => {
              const combinedSelector = labels
                .map((label) => `tr:has-text("${label}")`)
                .join(", ");
              const row = xbrlFrame.locator(combinedSelector).first();

              return await row.evaluate((tr) => {
                const textCells = Array.from(tr.querySelectorAll("td.text"));
                const booleanCell = textCells.find((c) => {
                  const content = c.textContent?.trim().toLowerCase();
                  return (
                    content === "true" ||
                    content === "false" ||
                    content === "yes" ||
                    content === "no"
                  );
                });

                return booleanCell
                  ? booleanCell.textContent?.trim()
                  : "value not found";
              });
            };

            const EntitySmallBuisinesValue = await getValue([
              `${category.label}`,
            ]);
            const xbrlMatch =
              EntitySmallBuisinesValue.toLowerCase() === "true" ||
              EntitySmallBuisinesValue.toLowerCase() === "yes";
            if (
              !uiMatchFound ||
              !xbrlMatch ||
              EntitySmallBuisinesValue === "value not found"
            ) {
              categoryHasFailure = true;
              const reason = !uiMatchFound
                ? "UI Status Mismatch"
                : `XBRL Error: ${EntitySmallBuisinesValue}`;
              failureLogs.push(`Acc# ${accessionNo}: ${reason}`);
            }
            //const EntitySmallBuisinesValue = await getValue(["Entity Shell Company"]);
            // const EntitySmallBuisinesValue = await getValue(["Entity Well-known Seasoned Issuer"]);
            //const EntitySmallBuisinesValue = await getValue(["Entity Emerging Growth Company"]);
            console.log("EntitySmallBuisinesValue", EntitySmallBuisinesValue);
            console.log(
              "--------------------------------------------------------------",
            );
            console.log(
              "--------------------------------------------------------------",
            );
            if (failureLogs.length > 0) {
              console.log("Failure Logs:", failureLogs);
            }
            const isSuccess = failureLogs.length === 0;
            const finalReport = [
              `Status: ${isSuccess ? "Passed ✅" : "Failed ❌"}`,
              ``,
              `Filters Used:`,
              `Form: 10-k`,
              `Exhibits to Filings: Exclude`,
              `Company Type/Status: ${category.name}`,
              `Search For: Filings`,
              ``,
              `Failure IDs:`,
              `${isSuccess ? "None" : failureLogs.join("\n")}`,
            ].join("\n");

            // Use category.identifier (or identifier) for the Sheet Column E match
            await updateGoogleSheet(
              finalReport,
              category.identifier,
              failureLogs,
            );
          } catch {
            console.log("XBRL content not found for row", resultsFound);
          } finally {
            const activeTab = page.locator('//span[contains(text(), "Docs:")]');
            if (await activeTab.first().isVisible()) {
              await activeTab.first().click();
            }

            await page.waitForTimeout(2000);
          }
        } else {
          console.log(`Row ${resultsFound} has no XBRL Doc`);
        }
        resultsFound++;
      }
      const activeTab = page
        .locator(
          '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
        )
        .first();
      try {
        if (await activeTab.isVisible()) {
          await activeTab.click({ button: "right" });
          await page.waitForTimeout(500);
          await page
            .locator("text=/Close all tabs/i")
            .click()
            .catch(async () => {
              await page.reload();
            });
          await page.waitForTimeout(500);
        }
      } catch (cleanupError) {
        await page.reload();
      }
      //await page.pause();
    }
  });
});
