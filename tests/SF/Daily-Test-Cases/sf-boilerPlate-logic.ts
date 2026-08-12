import { Page, expect } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

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
      { type: "10-Q", sections: ["Item 1. Financial Statements"] },
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

export const runBoilerPlateTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-BoilerPlate Report ---");

  const sf = new SfPage(page);

  const allScenarioResults: string[] = [];
  let isFirstSearch = true;
  let index = 0;
  for (const combo of TEST_COMBINATIONS) {
    try {
      console.log(`\n STARTING COMBINATION: ${combo.name}`);
      let comboFindings: string[] = [];
      let isScenarioValid = true;

      await selectSectionFilters(page, combo);

      await sf.searchBtn.click();

      const statusText = await sf.getTabText(index++, logToFile, false);
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
        await sf.configureDisplayColumns({
          "Filing Info": ["Accession #"],
          "Company Info": [],
        });
        isFirstSearch = false;
      }

      const docCountMatch = statusText.match(/Docs:\s*([\d,]+)/i);
      let totalAvailableDocs = 0;
      if (docCountMatch) {
        totalAvailableDocs = parseInt(docCountMatch[1].replace(/,/g, ""), 10);
      }

      const label = `[${combo.name}]`;
      const countInfo = `Total Documents Found: ${totalAvailableDocs.toLocaleString()}`;
      console.log(`\n╔${"═".repeat(BOX_WIDTH)}╗`);
      console.log(`║ ${label.padEnd(BOX_WIDTH - 2)} ║`);
      console.log(`╚${"═".repeat(BOX_WIDTH)}╝\n`);

      const loopLimit = Math.min(TARGET_ROW_COUNT, totalAvailableDocs);
      let resultsFound = 0;

      while (resultsFound < loopLimit) {
        const scroller = sf.scroller;
        let resultsContainer = sf.resultsContainer;
        let currentRow = resultsContainer
          .locator(`> div > div[data-test="resultRow"][id="${resultsFound}"]`)
          .first();

        if (!((await currentRow.count()) > 0)) {
          await page.mouse.wheel(0, 600);
          await page.waitForTimeout(1000);
          if (resultsFound > 0 && !((await currentRow.count()) > 0)) break;
          continue;
        }

        const { spans: cleanContent } = await sf.rowData(currentRow);
        const fillingInforesultLabel = sf.rowLabelledSpan(currentRow, "Accession #");
        const accessionNo = await fillingInforesultLabel
          .locator("xpath=following-sibling::span")
          .innerText();

        const allContent = sf.rowLinksAndParagraphs(currentRow);
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
          console.log(`[Accession No , ${accessionNo}]`);
          console.log(`╚${combo.name}] Row ${resultsFound}: ${lastAnchorText}`);
          console.log(`╚${type || "Substantive"} from anchor tag`);
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
            console.log(`[Accession No , ${accessionNo}]`);
            console.log(`╚${combo.name}] Row ${resultsFound}: ${text}`);
            console.log(`╚${type || "Substantive"} from ${tagName} tag`);
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

      await sf.clearFilters();
    } catch (error: any) {
      console.error(`Error processing ${combo}: ${error.message}`);
    }
  }

  const finalDump = allScenarioResults.join("\n" + "═".repeat(30) + "\n");
  try {
    await updateGoogleSheet(finalDump, IDENTIFIER);
    console.log("Successfully updated Google Sheet.", finalDump);
  } catch (sheetError) {
    console.error("Failed to update Google Sheet:", sheetError);
  }

  logToFile("\n--- End of Report ---");
  await sf.closeAllOpenTabs();
};

async function selectSectionFilters(page: Page, combo: any) {
  const sf = new SfPage(page);
  const sectionFilterBlock = sf.filterBlock(/^Section$/);
  const sectionPlusBtn = sf.filterAddIcon(/^Section$/);
  const modal = sf.popupBody;

  while (!(await modal.isVisible())) {
    await sectionPlusBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  for (const formEntry of combo.forms) {
    console.log(`Selecting Form: ${formEntry.type}`);
    const formTypeItem = sf.sectionItems.filter({
      has: sf.elementWithText("span", new RegExp(`^${formEntry.type}$`, "i")),
    });
    await formTypeItem.click();
    await page.waitForTimeout(800);

    for (const sectionName of formEntry.sections) {
      const checkbox = sf.sectionCheckbox(sectionName);
      await checkbox.evaluate((node: HTMLInputElement) => {
        node.checked = true;
        node.dispatchEvent(new Event("click", { bubbles: true }));
      });
    }
  }

  await sf.elementWithText("label", /^Only$/).last().click();
  const popupBody = sf.tabbedPopupBody;
  const nonMaterialRow = popupBody.locator("div").filter({
    has: sf.elementWithText("span", /^Non-Material Sections$/),
  });
  await sf.addIconIn(nonMaterialRow).click({ force: true });

  for (const excludeName of combo.exclude) {
    const row = sf.pickerListItem(new RegExp(excludeName));
    await sf.pickerCheckboxIcon(row).click({ force: true });
  }

  await popupBody.getByRole("button", { name: /^OK$/ }).click();
  await sectionFilterBlock.getByRole("button", { name: /^OK$/ }).click();
}

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
