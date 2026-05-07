import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");

test.describe("SF-iXBRL Automation", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-iXBRL", async ({ page }) => {
    await page.goto("/");

    const userField = page.locator("#userid");
    if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userField.fill(process.env.APP_USERNAME!);
      await page.getByRole("button", { name: "Next" }).click();
      await page.locator("#password").fill(process.env.APP_PASSWORD!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/.*apps.intelligize.com/, { timeout: 60000 });
      await page.context().storageState({ path: AUTH_PATH });
    }

    await page.locator("text=/SEC Filings/i").first().click();
    await page.getByRole("button", { name: /^Clear Filters$/i }).click();
    await page.waitForTimeout(1000);

    const formsInput = page.locator("#Forms").getByRole("textbox");
    await formsInput.click();
    await formsInput.pressSequentially("10-K", { delay: 700 });

    await page.waitForTimeout(500);
    await formsInput.press("Enter");

    await page.locator('label[for="-ExhibitsToFilings"]').click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /^Search$/i }).click();

    const statusLocator = page.locator(
      '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
    );
    await expect(statusLocator.first()).toBeVisible({ timeout: 60000 });

    if (
      (await statusLocator.first().innerText()).includes("No Results Found")
    ) {
      throw new Error("No results found.");
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

    await page
      .getByRole("button", {
        name: "Apply",
      })
      .click();
    await page.waitForTimeout(500);

    const totalToProcess = 24;
    let processedCount = 0;
    let failureLogs: string[] = [];
    let isFailed = false;

    while (processedCount < totalToProcess) {
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
        { index: processedCount, height: rowHeight },
      );

      let currentRow = resultsContainer
        .locator(`> div > div[data-test="resultRow"][id="${processedCount}"]`)
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
      console.log(`Processing Row: ${1 + processedCount}`);
      const texts = await currentRow.locator("span").allInnerTexts();
      const cleanContent = texts
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const accessionNo =
        cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
        "N/A";
      console.log(`Accession No: ${accessionNo}`);

      const viewBtn = currentRow.getByRole("button", { name: /View/i }).last();

      const hasiXBRLbtn = currentRow
        .getByRole("button", { name: /iXBRL/i })
        .first();

      const hasiXBRLLabel = await hasiXBRLbtn.isVisible();
      console.log(`iXBRL Label on Grid: ${hasiXBRLLabel ? "YES" : "NO"}`);

      try {
        if (processedCount < 4) {
          if (await viewBtn.isVisible({ timeout: 5000 })) {
            await viewBtn.click();

            // Locate the iXBRL button inside the viewer
            const ixbrlTab = page.locator("#ixbrl");
            await ixbrlTab.waitFor({ state: "attached", timeout: 10000 });
            //  await page.waitForTimeout(5000);

            // 2. Check for the disabled class from your screenshot (styles__disabled___mfjwS)
            const className = (await ixbrlTab.getAttribute("class")) || "";
            const isGreyedOut = className.includes("styles__disabled");

            if (!hasiXBRLLabel) {
              await expect(page.locator("#ixbrl")).toHaveClass(/disabled/, {
                timeout: 60000,
              });
              // EXPECTATION: Should be greyed out
              if (isGreyedOut) {
                console.log(
                  `✅ Success: iXBRL is correctly greyed out (Class: ${className})`,
                );
              } else {
                console.log(
                  `❌ Failure: iXBRL should be greyed out but is ACTIVE for ${accessionNo}`,
                );
                isFailed = true;
                failureLogs.push(
                  `${accessionNo} (Expected Greyed Out - Found Active)`,
                );
              }
            } else {
              await expect(page.locator("#ixbrl")).not.toHaveClass(/disabled/, {
                timeout: 60000,
              });
              console.log(
                "SCENARIO: Label WAS on grid -> Section MUST be active",
              );
              // SCENARIO: Label WAS on grid -> Section MUST be active
              try {
                // This 'expect' will wait up to 5s for Row 14/15 to "un-grey"
                await expect(ixbrlTab).not.toHaveClass(/disabled/, {
                  timeout: 60000,
                });
                console.log(
                  `SCENARIO: Label WAS on grid -> Section is active.`,
                );

                await ixbrlTab.click();
                const ex101Link = page.locator("text=/^EX-101$/i").first();
                if (!(await ex101Link.isVisible({ timeout: 5000 }))) {
                  isFailed = true;
                  failureLogs.push(
                    `${accessionNo} (Active iXBRL but EX-101 missing)`,
                  );
                }
                const infoTabLink = page
                  .locator("text=/^Info$/i")
                  .first()
                  .click();
                const SECLink = page
                  .locator(".styles__panel-row___uCFjv")
                  .filter({ hasText: "SEC Link" })
                  .locator("a")
                  .first();
                const [secTab] = await Promise.all([
                  page.context().waitForEvent("page"),
                  SECLink.click(),
                ]);
                await secTab.waitForLoadState();
                console.log("Opened SEC Tab:", await secTab.title());
                const tableRows = secTab.locator("table.tableFile tr");
                if ((await tableRows.count()) > 0) {
                  const ixbrlCell = tableRows
                    .nth(1)
                    .locator("td")
                    .filter({ hasText: "iXBRL" });
                  await expect(ixbrlCell).toBeVisible({ timeout: 10000 });

                  console.log(
                    "✅ iXBRL confirmation found in SEC table.",
                    ixbrlCell,
                  );
                } else {
                  console.log(
                    "⚠️ No rows found in the SEC Filing Detail table.",
                  );
                }
                await secTab.close();
              } catch (e) {
                console.log(
                  `❌ Failure: iXBRL is GREYED OUT despite badge on grid for ${accessionNo}`,
                );
                isFailed = true;
                failureLogs.push(
                  `${accessionNo} (Expected Active - Found Greyed Out)`,
                );
              }
            }
          }
        }
      } catch (e: any) {
        console.log(`Extraction error for ${accessionNo}`);
        isFailed = true;
        failureLogs.push(`${accessionNo}`);
      }

      const resultsTab = page
        .locator('//span[contains(text(), "Docs:")]')
        .first();
      if (await resultsTab.isVisible()) {
        await resultsTab.click();
      }
      await page.waitForTimeout(500);
      processedCount++;
    }
    const scenarioBlock = [
      `Status: ${!isFailed ? "VALID ✅" : "INVALID ❌"}`,
      `Filters Used`,
      `Form: 10-K`,
      `Exhibits to Filings: Exclude`,
      `Search For: Filings`,
      `Failure IDs:`,
      `${failureLogs.length === 0 ? "None" : failureLogs.join("\n")}`,
    ].join("\n");

    await updateGoogleSheet(scenarioBlock, "sf_ixbrl", failureLogs);
  });
});
