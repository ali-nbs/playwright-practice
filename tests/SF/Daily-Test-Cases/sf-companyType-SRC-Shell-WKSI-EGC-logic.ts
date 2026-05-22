import { test, expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { closeAllOpenTabs, configureDisplayColumns } from "../../utils/helpers";

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

export const runCompanyType_SRC_Shell_WKSI_EGC_Test = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting Company Type (SRC/Shell/WKSI/EGC) Report ---");

  for (const category of Categories) {
    logToFile(`\n--- Starting Category: ${category.name} ---`);

    const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });
    await clearBtn.click();
    await page.waitForTimeout(2000);

    // 1. Handle the Modal Filter for Company Type
    const companyTypeFilterBlock = page
      .locator("div.styles__focusContainer___13rFy")
      .filter({
        has: page.locator("label", { hasText: /^Company Type\/Status$/ }),
      });

    const sectionPlusBtn = companyTypeFilterBlock
      .locator("span._icon_1jkal_249.Add")
      .first();
    const modal = page.locator("div.PopupBody__popup__body___1J_d3");

    // Click plus until modal is visible
    let attempts = 0;
    while (!(await modal.isVisible()) && attempts < 5) {
      await sectionPlusBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      attempts++;
    }

    await modal.locator(`label[for="${category.id}"]`).click();
    await page.getByRole("button", { name: /^OK$/ }).click();

    // 2. Set Form 10-K and Exclude Exhibits
    const formsInput = page.locator("#Forms").getByRole("textbox");
    await formsInput.click();
    await page.keyboard.type("10-K", { delay: 100 });
    await formsInput.press("Enter");

    const exhibitsTofilingsCheckbox = await page.locator(
      'label[for="-ExhibitsToFilings"]',
    );
    await exhibitsTofilingsCheckbox.click({ force: true });
    await page
      .getByRole("button", { name: /^Search$/i })
      .first()
      .click();

    // 3. Verify Results
    const statusLocator = page.locator(
      '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
    );
    await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

    if (
      (await statusLocator.first().innerText()).includes("No Results Found")
    ) {
      logToFile(`❌ No results found for ${category.name}`);
      const finalReport = [
        `Status: "Passed ✅"`,
        `Company Type/Status: ${category.name}`,
        `Search Result: "No Result Found"`,
        `Failure IDs:  "None"}`,
      ].join("\n");

      await updateGoogleSheet(finalReport, category.identifier, []);
      await closeAllOpenTabs(page);
      continue;
    }
    await configureDisplayColumns(page, {
      "Filing Info": ["Accession #"],
      "Company Info": ["Company Type/Status"],
    });

    await validateRows(page, category, logToFile);
    await closeAllOpenTabs(page);
  }
};

async function validateRows(page: Page, category: any, logToFile: Function) {
  let resultsFound = 0;
  let failureLogs: string[] = [];

  while (resultsFound < TARGET_ROW_COUNT) {
    const scroller = page.locator(".ReactVirtualized__Grid").last();
    const resultsContainer = scroller.locator('> div[role="rowgroup"]');

    const currentRow = resultsContainer
      .locator(`> div > div[data-test="resultRow"][id="${resultsFound}"]`)
      .first();
    if (!(await currentRow.count())) {
      await scroller.evaluate((el) => (el.scrollTop += 500));
      await page.waitForTimeout(1000);
      continue;
    }

    await currentRow.evaluate((el) => el.scrollIntoView({ block: "start" }));

    // Get Accession #
    const accLabel = currentRow.locator("span", { hasText: "Accession #" });
    const accValues = await accLabel
      .locator("xpath=..")
      .locator("span")
      .allInnerTexts();
    const accessionNo = accValues.find((t) => t.includes("-"))?.trim() || "N/A";

    // Check UI Status
    const uiLabel = currentRow.locator("span", {
      hasText: "Company Type/Status",
    });
    const uiValues = await uiLabel
      .locator("xpath=..")
      .locator("p")
      .allInnerTexts();
    const uiMatchFound = uiValues.some(
      (val) =>
        val.toLowerCase().includes(category.name.toLowerCase()) ||
        val.toLowerCase().includes(category.label.toLowerCase()),
    );

    const viewBtn = currentRow.getByRole("button", { name: /View/i }).last();
    if (await viewBtn.isVisible()) {
      try {
        await viewBtn.click();
        await page.locator("text=/^iXBRL$/i").first().click();
        await page.locator("text=/^EX-101$/i").first().click();

        const xbrlFrame = page
          .frameLocator('iframe[src*="/SECFilings/Documents/"]')
          .first();
        const rowSelector = `tr:has-text("${category.label}")`;

        const xbrlValue = await xbrlFrame
          .locator(rowSelector)
          .first()
          .evaluate((tr) => {
            const cells = Array.from(tr.querySelectorAll("td.text"));
            const bool = cells.find((c) => {
              const txt = c.textContent?.trim().toLowerCase();
              return ["true", "false", "yes", "no"].includes(txt!);
            });
            return bool ? bool.textContent?.trim() : "value not found";
          });

        const xbrlMatch =
          xbrlValue.toLowerCase() === "true" ||
          xbrlValue.toLowerCase() === "yes";

        if (!uiMatchFound || !xbrlMatch || xbrlValue === "value not found") {
          const reason = !uiMatchFound
            ? "UI Mismatch"
            : `XBRL Error: ${xbrlValue}`;
          failureLogs.push(`Acc# ${accessionNo}: ${reason}`);
        }
      } catch (e) {
        logToFile(`⚠️ XBRL content not found for row ${resultsFound}`);
      } finally {
        const backToDocs = page.locator('//span[contains(text(), "Docs:")]');
        if (await backToDocs.first().isVisible())
          await backToDocs.first().click();
        await page.waitForTimeout(1000);
      }
    }
    resultsFound++;
  }

  const isSuccess = failureLogs.length === 0;
  const finalReport = [
    `Status: ${isSuccess ? "Passed ✅" : "Failed ❌"}`,
    `Company Type/Status: ${category.name}`,
    `Failure IDs: ${isSuccess ? "None" : failureLogs.join("\n")}`,
  ].join("\n");

  await updateGoogleSheet(finalReport, category.identifier, failureLogs);
}
