import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { DbmPage } from "../pages/DbmPage";

const IDENTIFIER = "dbm_matrix";

export const runMatrixTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting DBM Past Redline Version Report ---");
  let findings = { text: "Success", isValid: true };

  try {
    const loadMatrixBtn = page.getByRole("button", {
      name: "Create/Load New Matrix",
    });
    await loadMatrixBtn.click({force: true});

    // await page
    //   .locator("#savedList")
    //   .first()
    //   .locator("div")
    //   .first()
    //   .click({ force: true });

     const nextBtn = page.getByRole("button", { name: "Next" });
    // await nextBtn.click({ force: true });

    // try {
    //   await nextBtn.click({ force: true, timeout: 10000 });
    // } catch (e) {
    //   findings.isValid = false;
    //   findings.text = "Error: No Saved Companies found";
    //   logToFile("❌ Soft Failure: Next button step failed.");
    // }

    if (findings.isValid) {
      try {
        const firstRow = page
          .locator("#companyPopup_scrollableTarget")
          .locator('[id="1"]');
        await expect(firstRow).toBeVisible({ timeout: 20000 });

        const selectAllLabel = page
          .locator("#companyPopup_scrollableTarget")
          .locator("._checkbox__icon_1xotg_257")
          .first();
        await selectAllLabel.evaluate((el) => (el as HTMLElement).click());
        await nextBtn.click({ force: true });
      } catch (e) {
        findings.isValid = false;
        findings.text = "Error: No Companies list found.";
      }
    }

    if (findings.isValid) {
      try {
        const firstRow1 = page.locator('[data-test="resultRow"]').first();
        await expect(firstRow1).toBeVisible({ timeout: 20000 });

        const selectAllLabel2 = page
          .locator(".PopupBody__popup__body___1J_d3")
          .locator("._checkbox__icon_1xotg_257")
          .first();
        await selectAllLabel2.evaluate((el) => (el as HTMLElement).click());

        await page
          .getByRole("button", { name: "Create Matrix" })
          .click({ force: true });
      } catch (e) {
        findings.isValid = false;
        findings.text = "Error: Companies filings did not load.";
      }
    }

    if (findings.isValid) {
      const tableBody = page.locator(".rc-table-tbody");
      const firstDataRow = tableBody.locator("tr.rc-table-row").first();

      try {
        await firstDataRow.waitFor({ state: "visible", timeout: 30000 });
        await page
          .locator("#WordCount")
          .locator("._radio__icon_12iu3_278")
          .first()
          .click({ force: true });

        const dropdownTrigger = page
          .locator('div[data-notice="master-status-filter"] span')
          .filter({ hasText: "Show All" });
        await dropdownTrigger.click();

        const dropdownMenu = page.locator("#container-dropdown");
        await dropdownMenu.waitFor({ state: "visible" });
        await dropdownMenu.locator("li").filter({ hasText: "Changed" }).click();

        const redlineIcon = page.locator("i.fa-caret-left").first();
        try {
          await redlineIcon.waitFor({ state: "attached", timeout: 10000 });
        } catch (e) {
          logToFile("⚠️ No redline icons appeared after 10 seconds.");
        }

        const count = await page.locator("i.simple-icon.fa-caret-left").count();
        logToFile(`[LIVE] Total 'Changed' Redline Icons: ${count}`);

        if (count === 0) {
          findings.isValid = false;
          findings.text =
            "Failure: Matrix loaded but found 0 'Changed' redline icons.";
        } else {
          findings.text = `Successfully found ${count} redline changes.`;
        }
      } catch (e) {
        findings.isValid = false;
        findings.text = "Error: Final Matrix table failed to render.";
      }
    }
  } catch (globalError: any) {
    findings.isValid = false;
    findings.text = `Unexpected Script Error: ${globalError.message}`;
  }

  const scenarioBlock = [
    `Scenario: DBM Matrix`,
    `Results: ${findings.text}`,
    `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌"}`,
  ].join("\n");

  try {
    await updateGoogleSheet(scenarioBlock, IDENTIFIER);
    logToFile("✅ Results dumped to Google Sheet.");
  } catch (e: any) {
    logToFile(`❌ Sheet update failed: ${e.message}`);
  } finally {
    logToFile("\n--- End of DBM Report ---");
    await new DbmPage(page).closeAllOpenTabs();
  }
};
