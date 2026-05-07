import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");
const IDENTIFIER = "sf_boilerPlate";

const TEST_COMBINATIONS = [
  {
    name: "Test Case 1: 10-K Only",
    forms: [
      {
        type: "10-K",
        sections: ["Item 1A. Risk Factors", "Item 4. Mine Safety Disclosures"],
      },
    ],
    exclude: ["Cross-References", "Reserved", "Other"],
  },
  {
    name: "Test Case 2: 10-K and 10-Q",
    forms: [
      {
        type: "10-K",
        sections: [
          "Item 5. Market for Registrant's Common Equity, Related Stockholder Matters and Issuer Purchases of Equity Securities",
          "Item 4. Mine Safety Disclosures",
        ],
      },
      {
        type: "10-Q",
        sections: ["Item 1. Financial Statements"],
      },
    ],
    exclude: ["Not Applicable", "Reserved", "Other"],
  },
  {
    name: "Test Case 3: 20-F and 8-K",
    forms: [
      {
        type: "20-F",
        sections: [
          "Item 4. Information On The Company",
          "Item 7. Major Shareholders and Related Party Transactions",
        ],
      },
      {
        type: "8-K",
        sections: [
          "Item 5.04 Temporary Suspension of Trading under Registrant's Employee Benefit Plans",
          "Item 5.07 Submission of Matters to a Vote of Security Holders",
        ],
      },
    ],
    exclude: ["Cross-References", "Not Applicable", "Other"],
  },
];
const ALL_BOILERPLATE_TYPES = [
  "Not Applicable",
  "Reserved",
  "Cross-References",
  "Other",
];
const BOILERPLATE_LENGTH_THRESHOLD = 600;
const KEYWORDS_NOT_APPLICABLE = [
  "none",
  "n/a",
  "not applicable",
  "no information",
  "not required",
  "no legal proceeding",
  "omitted",
  "not applicable.",
];
const KEYWORDS_CROSS_REFERENCE = [
  "refer",
  "by reference",
  "included",
  "added",
  "see",
];
const KEYWORDS_RESERVED = ["reserved"];
const TARGET_ROW_COUNT = 25;
const BOX_WIDTH = 65;
if (fs.existsSync(AUTH_PATH)) {
  test.use({ storageState: AUTH_PATH });
}

test("SF-BoilerPlate", async ({ page }) => {
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

  const allScenarioResults: string[] = [];
  let isFirstSearch = true;

  for (const combo of TEST_COMBINATIONS) {
    try {
      console.log(`\n STARTING COMBINATION: ${combo.name}`);
      let comboFindings: string[] = [];
      let isScenarioValid = true;

      const sectionFilterBlock = page
        .locator("div.styles__focusContainer___13rFy")
        .filter({ has: page.locator("label", { hasText: /^Section$/ }) });
      const sectionPlusBtn = sectionFilterBlock
        .locator("span._icon_1jkal_249.Add")
        .first();
      const modal = page.locator("div.PopupBody__popup__body___1J_d3");

      while (!(await modal.isVisible())) {
        await sectionPlusBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }

      for (const formEntry of combo.forms) {
        console.log(`Selecting Form: ${formEntry.type}`);

        const formTypeItem = modal
          .locator("li.styles__item-list___17b6k")
          .filter({
            has: page.locator("span", {
              hasText: new RegExp(`^${formEntry.type}$`, "i"),
            }),
          });
        await formTypeItem.click();
        await page.waitForTimeout(800);

        for (const sectionName of formEntry.sections) {
          const checkbox = page.locator(`input[name="${sectionName}"]`);
          await checkbox.evaluate((node: HTMLInputElement) => {
            node.checked = true;
            node.dispatchEvent(new Event("click", { bubbles: true }));
          });
          await page.locator("label").filter({ hasText: sectionName }).click();
        }
      }

      await page
        .locator("label")
        .filter({ hasText: /^Only$/ })
        .last()
        .click();
      const popupBody = page.locator(
        "div.PopupBody__popup__body___1J_d3.styles__tabs-container___1kNEn",
      );
      const nonMaterialRow = popupBody.locator("div").filter({
        has: page.locator("span", { hasText: /^Non-Material Sections$/ }),
      });
      await nonMaterialRow
        .locator("span._icon_1jkal_249.Add")
        .first()
        .click({ force: true });

      for (const excludeName of combo.exclude) {
        const row = page
          .locator("li.styles__check-list-item__container___233d9")
          .filter({ hasText: new RegExp(excludeName) });
        await row
          .locator("label._checkbox__icon_1xotg_257")
          .click({ force: true });
      }

      await popupBody.getByRole("button", { name: /^OK$/ }).click();

      await sectionFilterBlock.getByRole("button", { name: /^OK$/ }).click();
      //  await page.pause();
      await page
        .getByRole("button", { name: /^Search$/i })
        .first()
        .click();
      // await page.pause();

      const statusLocator = page
        .locator(
          '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
        )
        .last();
      await expect(statusLocator.last()).toBeVisible({ timeout: 60000 });

      const statusText = await statusLocator.innerText();
      //console.log(`[${combo.name}] Status: ${statusText}`);
      if (statusText.toLowerCase().includes("no results found")) {
        console.log(`\n╔${"═".repeat(BOX_WIDTH)}╗`);
        console.log(
          `║ ⚠️  SKIPPING: No results found for ${combo.name.padEnd(BOX_WIDTH - 36)} ║`,
        );
        console.log(`╚${"═".repeat(BOX_WIDTH)}╝\n`);
        allScenarioResults.push(`[${combo.name}]\nStatus: (No Results Found)`);

        continue;
      }
      if (isFirstSearch) {
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
        isFirstSearch = false;
      }
      const docCountMatch = statusText.match(/Docs:\s*([\d,]+)/i);
      let totalAvailableDocs = 0;
      if (docCountMatch) {
        const cleanNumberString = docCountMatch[1].replace(/,/g, "");
        totalAvailableDocs = parseInt(cleanNumberString, 10);
      }

      const label = `[${combo.name}]`;
      const countInfo = `Total Documents Found: ${totalAvailableDocs.toLocaleString()}`;

      console.log(`\n╔${"═".repeat(BOX_WIDTH)}╗`);
      console.log(`║ ${label.padEnd(BOX_WIDTH - 2)} ║`);
      console.log(`╠${"═".repeat(BOX_WIDTH)}╣`);
      console.log(`║ ${countInfo.padEnd(BOX_WIDTH - 2)} ║`);
      console.log(`╚${"═".repeat(BOX_WIDTH)}╝\n`);

      let resultsFound = 0;
      const loopLimit = Math.min(TARGET_ROW_COUNT, totalAvailableDocs);
      while (resultsFound < loopLimit) {
        const scroller = page.locator(".ReactVirtualized__Grid").last();
        let resultsContainer = scroller.locator('> div[role="rowgroup"]');
        let currentRow = resultsContainer
          .locator(`> div > div[data-test="resultRow"][id="${resultsFound}"]`)
          .first();
        if (!((await currentRow.count()) > 0)) {
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(1000);
          if (resultsFound > 0 && !((await currentRow.count()) > 0)) break;
          continue;
        }
        const texts = await currentRow.locator("span").allInnerTexts();
        const cleanContent = texts
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        const fillingInforesultLabel = currentRow.locator("span", {
          hasText: "Accession #",
        });
        const accessionNo = await fillingInforesultLabel
          .locator("xpath=following-sibling::span")
          .innerText();

        //  console.log(`Accession No : ${accessionNo}`);
        // const accessionNo = cleanContent.find(text =>
        //     /^\d{10}-?\d{2}-?\d{6}$/.test(text)
        // ) || "N/A";

        const allContent = currentRow.locator("a, p");
        const totalItems = await allContent.count();
        let rowMatchedAnyExclude = false;
        const lastAnchorText = (
          await currentRow
            .locator("a")
            .last()
            .innerText()
            .catch(() => "")
        ).toLowerCase();
        const shouldTrackReserved = !combo.exclude.includes("Reserved");
        if (lastAnchorText && shouldTrackReserved) {
          const type = getBoilerplateType(lastAnchorText);
          if (type && !combo.exclude.includes(type)) {
            rowMatchedAnyExclude = true;
          }
          console.log(`[Accession No , ${accessionNo}`);
          console.log(`╚${combo.name}] Row ${resultsFound}: ${lastAnchorText}`);
          console.log(
            "-------------------------------------------------------------",
          );
          console.log(`╚${type || "Substantive"} from anchor tag`);
          console.log(
            "-------------------------------------------------------------",
          );
          console.log("");
        }
        let startIdx = totalItems < 4 ? 0 : 2;

        for (let j = startIdx; j < totalItems; j++) {
          const element = allContent.nth(j);
          const tagName = await element.evaluate((node) =>
            node.tagName.toLowerCase(),
          );
          const text = (await element.innerText()).trim();

          if (text && tagName === "p") {
            const type = getBoilerplateType(text);
            if (type && !combo.exclude.includes(type)) {
              rowMatchedAnyExclude = true;
            }
            console.log(`[Accession No , ${accessionNo}`);
            console.log(`╚${combo.name}] Row ${resultsFound}: ${text}`);
            console.log(
              "-------------------------------------------------------------",
            );
            console.log(`╚${type || "Substantive"} from ${tagName} tag`);
            console.log(
              "-------------------------------------------------------------",
            );
            console.log("");
          }
        }
        if (!rowMatchedAnyExclude) {
          isScenarioValid = false;
          comboFindings.push(accessionNo);
        }
        resultsFound++;
        await currentRow.last().scrollIntoViewIfNeeded();
      }
      const includedTypes = ALL_BOILERPLATE_TYPES.filter(
        (type) => !combo.exclude.includes(type),
      );
      const formDetails = combo.forms
        .map((f) => `${f.type} (${f.sections.join(", ")})`)
        .join(" | ");
      const scenarioBlock = [
        `Scenario Status: ${isScenarioValid ? "VALID ✅" : "INVALID ❌"}`,
        `Test Case: ${formDetails}`,
        `Included Types: ${includedTypes.length > 0 ? includedTypes.join(", ") : "None"}`,
        `Docs Checked: ${resultsFound}`,
        `Failure IDs: ${comboFindings.length > 0 ? comboFindings.join(", ") : "None"}`,
      ].join("\n");

      allScenarioResults.push(scenarioBlock);

      if (
        await page.getByRole("button", { name: /Clear Filters/i }).isVisible()
      ) {
        await page.getByRole("button", { name: /Clear Filters/i }).click();
      }

      //  await page.waitForTimeout(1000);
    } catch (error: any) {
      console.error(`Error processing ${combo}: ${error.message}`);
    } finally {
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
            .catch(() => {});
        }
      } catch (cleanupError) {
        await page.reload();
      }
    }
  }
  const finalDump = allScenarioResults.join("\n" + "═".repeat(30) + "\n");
  try {
    await updateGoogleSheet(finalDump, IDENTIFIER);
    console.log("Successfully updated Google Sheet.", finalDump);
  } catch (sheetError) {
    console.error("Failed to update Google Sheet:", sheetError);
  }
  //await page.pause();
});

function getBoilerplateType(text: string): string | null {
  const cleanText = text.trim();
  const lowerText = cleanText.toLowerCase();
  if (cleanText.length === 0) return "Empty";
  if (cleanText.length >= BOILERPLATE_LENGTH_THRESHOLD) return null;
  if (
    KEYWORDS_NOT_APPLICABLE.some(
      (kw) => lowerText === kw || lowerText === kw + ".",
    )
  )
    return "Not Applicable";
  if (KEYWORDS_CROSS_REFERENCE.some((kw) => lowerText.includes(kw)))
    return "Cross-References";
  if (KEYWORDS_RESERVED.some((kw) => lowerText.includes(kw))) return "Reserved";
  return "Other";
}
