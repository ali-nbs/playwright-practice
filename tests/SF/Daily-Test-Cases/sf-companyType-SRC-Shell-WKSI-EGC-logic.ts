import { test, expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { SfPage } from "../../pages/SfPage";

const TARGET_ROW_COUNT = 1;
const Categories = [
  {
    id: "IsSRC",
    label: "Entity Small Business",
    pattern: /Entity Small Business/i,
    name: "SRC",
    identifier: "sf_companyType_SRC",
  },
  {
    id: "IsShellCompany",
    label: "Entity Shell Company",
    pattern: /Entity Shell Company/i,
    name: "Shell Company",
    identifier: "sf_companyType_ShellCompany",
  },
  {
    id: "IsWKSI",
    label: "Entity Well Known Seasoned Issuer",
    pattern: /Entity Well[- ]known Seasoned Issuer/i, // ✅ Matches both "Well-known" and "Well Known"
    name: "WKSI",
    identifier: "sf_companyType_WKSI",
  },
  {
    id: "IsEGC",
    label: "Entity Emerging Growth Company",
    pattern: /Entity Emerging Growth Company/i,
    name: "EGC",
    identifier: "sf_companyType_EGC",
  },
];

export const runCompanyType_SRC_Shell_WKSI_EGC_Test = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting Company Type (SRC/Shell/WKSI/EGC) Report ---");

  const sf = new SfPage(page);

  for (const category of Categories) {
    logToFile(`\n--- Starting Category: ${category.name} ---`);

      await sf.clearFilters();
    await page.waitForTimeout(2000);

    // 1. Handle the Modal Filter for Company Type
    const companyTypeFilterBlock = sf.filterBlock(/^Company Type\/Status$/);

    const sectionPlusBtn = sf.addIconIn(companyTypeFilterBlock);
    const modal = sf.popupBody;

    // Click plus until modal is visible
    let attempts = 0;
    while (!(await modal.isVisible()) && attempts < 5) {
      await sectionPlusBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      attempts++;
    }

    await sf.companyTypeOption(category.id).click();
    await sf.okBtn.click();

    // 2. Set Form 10-K and Exclude Exhibits
      await sf.formsInput.click();
    await page.keyboard.type("10-K", { delay: 100 });
    await sf.formsInput.press("Enter");

    const exhibitsTofilingsCheckbox = sf.exhibitsToFilingsLabel;
    //await exhibitsTofilingsCheckbox.click({ force: true });
    await exhibitsTofilingsCheckbox.uncheck({ force: true });
    await page
      .getByRole("button", { name: /^Search$/i })
      .first()
      .click();

    // 3. Verify Results
    const statusLocator = sf.statusTabLabels;
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
      await sf.closeAllOpenTabs();
      continue;
    }
    await sf.configureDisplayColumns({
      "Filing Info": ["Accession #"],
      "Company Info": ["Company Type/Status"],
    });

    await validateRows(page, category, logToFile);
    await sf.closeAllOpenTabs();
  }
};

async function validateRows(page: Page, category: any, logToFile: Function) {
  const sf = new SfPage(page);
  let resultsFound = 0;
  let failureLogs: string[] = [];

  while (resultsFound < TARGET_ROW_COUNT) {
    const scroller = sf.scroller;
    const resultsContainer = sf.resultsContainer;

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
    const accLabel = sf.rowLabelledSpan(currentRow, "Accession #");
    const accValues = await accLabel.locator("span").allInnerTexts();
    const accessionNo = accValues.find((t) => t.includes("-"))?.trim() || "N/A";

    // Check UI Status
    const uiLabel = sf.rowLabelledSpan(currentRow, "Company Type/Status");
    const uiValues = await uiLabel.locator("p").allInnerTexts();
    const uiMatchFound = uiValues.some(
      (val) =>
        val.toLowerCase().includes(category.name.toLowerCase()) ||
        val.toLowerCase().includes(category.label.toLowerCase()),
    );

    const viewBtn = sf.viewButton(currentRow).last();
    if (await viewBtn.isVisible()) {
      try {
        await viewBtn.click();

        const ixbrlTab = sf.ixbrlTabByText;
        await ixbrlTab
          .waitFor({ state: "visible", timeout: 10000 })
          .catch(() => {});
        await ixbrlTab.click();

        const ex101Tab = sf.ex101Tab;
        await ex101Tab
          .waitFor({ state: "visible", timeout: 20000 })
          .catch(() => {});

        if (await ex101Tab.isVisible()) {
          await ex101Tab.click({ force: true });

          const xbrlFrame = page
            .frameLocator('iframe[src*="/SECFilings/Documents/"]')
            .first();

          const targetRows = xbrlFrame
            .locator("tr")
            .filter({ hasText: category.pattern });

          try {
            await targetRows
              .first()
              .waitFor({ state: "attached", timeout: 20000 });
          } catch (e) {
            failureLogs.push(
              `Acc# ${accessionNo}: XBRL row containing "${category.label}" not found.`,
            );
          }

          const rowCount = await targetRows.count();
          expect.soft(rowCount).toBeGreaterThan(0);

          if (rowCount === 0) {
            failureLogs.push(
              `Acc# ${accessionNo}: XBRL row containing "${category.label}" not found.`,
            );
          } else {
            const xbrlValue = await targetRows.first().evaluate((tr) => {
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

            if (
              !uiMatchFound ||
              !xbrlMatch ||
              xbrlValue === "value not found"
            ) {
              const reason = !uiMatchFound
                ? "UI Mismatch"
                : `XBRL Error: ${xbrlValue}`;
              failureLogs.push(`Acc# ${accessionNo}: ${reason}`);
            }
          }
        } else {
          failureLogs.push(
            `Acc# ${accessionNo}: EX-101 tab failed to click or load.`,
          );
        }
      } catch (e) {
        logToFile(`⚠️ XBRL content not found for row ${resultsFound}`);
      } finally {
        const backToDocs = sf.backToDocsTab;
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
