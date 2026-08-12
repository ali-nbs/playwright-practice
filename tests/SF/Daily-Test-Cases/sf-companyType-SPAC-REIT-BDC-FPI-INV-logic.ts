import { Page, expect } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { SfPage } from "../../pages/SfPage";

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

export const runCompanyType_SPAC_REIT_BDC_FPI_INV_Test = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile(
    "--- Starting Extended Company Type Report (SPAC/REIT/BDC/FPI/INV) ---",
  );

  let finalSummaryReport: string[] = [];

  const sf = new SfPage(page);

  for (const category of Categories) {
    logToFile(`\n--- Starting Category: ${category.name} ---`);

    const clearBtn = sf.clearFiltersBtn;
    await clearBtn.click({ force: true });

    const companyTypeFilterBlock = sf.filterBlock(/^Company Type\/Status$/);

    const sectionPlusBtn = sf.addIconIn(companyTypeFilterBlock);
    const modal = sf.popupBody;

    // Open Modal
    let attempts = 0;
    while (!(await modal.isVisible()) && attempts < 5) {
      await sectionPlusBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      attempts++;
    }

    await sf.companyTypeOption(category.id).click();
    await sf.okBtn.click();

    const exhibitsTofilingsCheckbox = sf.exhibitsToFilingsLabel;
    await exhibitsTofilingsCheckbox.uncheck({ force: true });
    await page
      .getByRole("button", { name: /^Search$/i })
      .first()
      .click();

    // 2. Verify Results Exist
    const statusLocator = sf.statusTabLabels;
    await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

    if (
      (await statusLocator.first().innerText()).includes("No Results Found")
    ) {
      logToFile(`⚠️ No results found for ${category.name}. Skipping.`);
      const reportBlock = [
        `Status: Passed ✅}`,
        `Company Type/Status: ${category.name}`,
        `Search Result: No Result Found`,
        `Failure IDs: None`,
      ].join("\n");

      // SPAC is updated immediately per original logic, others are bundled
      if (category.id === "IsSPAC") {
        await updateGoogleSheet(reportBlock, category.identifier, []);
      } else {
        finalSummaryReport.push(reportBlock);
      }
      await sf.closeAllOpenTabs();
      continue;
    }

    await sf.configureDisplayColumns({
      "Filing Info": ["Accession #"],
      "Company Info": ["Company Type/Status", "SIC - Industry"],
    });
    const failureLogs = await validateExtendedRows(page, category, logToFile);

    // 5. Prepare Report Block
    const isSuccess = failureLogs.length === 0;
    const reportBlock = [
      `Status: ${isSuccess ? "Passed ✅" : "Failed ❌"}`,
      `Company Type/Status: ${category.name}`,
      `Failure IDs: ${isSuccess ? "None" : failureLogs.join("\n")}`,
    ].join("\n");

    // SPAC is updated immediately per original logic, others are bundled
    if (category.id === "IsSPAC") {
      await updateGoogleSheet(reportBlock, category.identifier, failureLogs);
    } else {
      finalSummaryReport.push(reportBlock);
    }
    await sf.closeAllOpenTabs();
  }

  // Final dump for REIT/BDC/FPI/INV
  if (finalSummaryReport.length > 0) {
    await updateGoogleSheet(
      finalSummaryReport.join("\n" + "-".repeat(40) + "\n"),
      "sf_companyType",
      [],
    );
  }
};

async function validateExtendedRows(
  page: Page,
  category: any,
  logToFile: Function,
) {
  const sf = new SfPage(page);
  let resultsFound = 0;
  let failureLogs: string[] = [];

  while (resultsFound < TARGET_ROW_COUNT) {
    const scroller = sf.scroller;
    const currentRow = scroller
      .locator(`div[data-test="resultRow"][id="${resultsFound}"]`)
      .first();

    if (!(await currentRow.count())) {
      await scroller.evaluate((el) => (el.scrollTop += 500));
      await page.waitForTimeout(1000);
      continue;
    }

    await currentRow.scrollIntoViewIfNeeded();

    const uiText = await currentRow
      .locator('span:has-text("Company Type/Status")')
      .locator("p")
      .allInnerTexts();
    const typeMatch = uiText.some((t) =>
      t.toLowerCase().includes(category.name.toLowerCase()),
    );

    let sicMatch = true;
    // if (category.SIC_Code !== "") {
    //   const sicText = await currentRow
    //     .locator('span:has-text("SIC - Industry")')
    //     .locator("p")
    //     .allInnerTexts();
    //   sicMatch = sicText.some((t) => t.includes(category.SIC_Code));
    // }
    if (category.SIC_Code !== "") {
      const sicLocator = currentRow
        .locator('span:has-text("SIC - Industry")')
        .locator("p");

      await expect
        .soft(sicLocator.first())
        .toContainText(category.SIC_Code, { timeout: 5000 });

      const sicText = await sicLocator.allInnerTexts();
      sicMatch = sicText.some((t) => t.includes(category.SIC_Code));
    }

    if (!typeMatch || !sicMatch) {
      const accNo = await currentRow
        .locator('span:has-text("Accession #")')
        .locator("xpath=following-sibling::span")
        .innerText();
      failureLogs.push(accNo.trim());
      logToFile(
        `❌ Failure on Acc# ${accNo}: TypeMatch=${typeMatch}, SICMatch=${sicMatch}`,
      );
    }

    resultsFound++;
  }
  return failureLogs;
}
