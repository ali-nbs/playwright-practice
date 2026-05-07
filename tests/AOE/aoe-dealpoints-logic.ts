import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import {
  ensureLoggedIn,
  fillAndEnter,
  getTabText,
  parseCount,
  closeAllOpenTabs,
  configureDisplayColumns,
  closeTabsToTheRight,
  parseCurrency,
} from "../utils/helpers";

const IDENTIFIER = "aoe_dealPoints";

export const runDealPointsTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting AOE-Deal Points Report ---");

  const testCases = [
    {
      id: 1,
      docType: [
        "Asset Purchase Agreement",
        // "Stock Purchase Agreement",
        // "Merger Agreement",
      ],
      resultGridVerificationCount: 25,
      dealPoint: "Deal Size ($)",
      configureDealPoints: ["Purchase Price"],
      minRange: "$1M",
      maxRange: "$40M",
    },
    {
      id: 2,
      docType: ["Credit/Loan Agreement"],
      resultGridVerificationCount: 25,
      dealPoint: "Administrative Agent",
      configureDealPoints: ["Basic Loan Terms"],
      value: "Bank of Nova Scotia (Scotiabank)",
    },
    {
      id: 3,
      docType: ["Underwriting Agreement"],
      resultGridVerificationCount: 25,
      dealPoint: "Lead Underwriter",
      configureDealPoints: ["Lead Underwriter"],
      value: "BANC OF AMERICA SECURITIES LLC",
    },
  ];

  let tabIndex = 0;
  let selectCheckboxes = true;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];

  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });
  const searchBtn = page.getByRole("button", { name: /^Search$/i });

  const docTypeInput = page.getByTestId("documentType-input");

  for (const scenario of testCases) {
    await clearBtn.click();
    await page.waitForTimeout(1000);
    let findings = { text: "No Results Found", isValid: true };

    let searchInput = "";
    for (const docType of scenario.docType) {
      searchInput += docType + "; ";
    }

    await fillAndEnter(
      page,
      docTypeInput,
      searchInput.slice(0, -2), // Remove the trailing "; "
      200,
    );
    await page.waitForTimeout(500);
    await page.locator("body").click();

    const agreementSpecificFiltersPlsBtn = page
      .locator("div", {
        hasText: /^Agreement Specific Filters \(Deal Points\)$/i,
      })
      .locator("._icon_1jkal_249")
      .first();

    console.log(
      "count ",
      await page
        .locator("div", {
          hasText: /^Agreement Specific Filters \(Deal Points\)$/i,
        })
        .locator("._icon_1jkal_249")
        .count(),
    );

    await agreementSpecificFiltersPlsBtn.click({ timeout: 1000 }).catch(() => {
      console.log("Soft click timed out, moving to forced methods...");
    });

    const expansionlsBtn = page
      .locator(".styles__listHeader___1Ialc")
      .locator("._icon_1jkal_249")
      .first();
    await expansionlsBtn.click();

    const itemInputMinRange = page
      .locator(".styles__groupItemContainer___bjF4C")
      .filter({ hasText: scenario.dealPoint })
      .locator("input")
      .first();
    await fillAndEnter(
      page,
      itemInputMinRange,
      scenario.minRange != null && scenario.minRange !== ""
        ? scenario.minRange
        : scenario.value,
      100,
    );

    if (scenario.maxRange) {
      console.log(
        `Filling max range for scenario ${scenario.id}: ${scenario.maxRange}`,
      );
      const itemInputMaxRange = page
        .locator(".styles__groupItemContainer___bjF4C")
        .filter({ hasText: scenario.dealPoint })
        .locator("input")
        .nth(1);
      await fillAndEnter(page, itemInputMaxRange, scenario.maxRange, 100);
    }

    await page
      .locator("#AND")
      .locator("._radio__icon_12iu3_278 ")
      .click({ force: true });

    await page.getByRole("button", { name: /^OK$/i }).click();

    await searchBtn.click();

    const searchResultTextOnly = await getTabText(page, 0, logToFile);
    logToFile(`Baseline (${scenario.id}): ${searchResultTextOnly}`);

    if (searchResultTextOnly.includes("Docs")) {
      await configureDisplayColumns(page, {
        "Filing Info": ["Intelligize ID"],
        "Company Info": [],
        "Deal Points": scenario.configureDealPoints || [],
      });

      await page.waitForTimeout(500);
      const docsCount = parseCount(searchResultTextOnly);
      actualTarget = Math.min(scenario.resultGridVerificationCount, docsCount);
      console.log(`Actual target for scenario ${scenario.id}: ${actualTarget}`);
      findings = await scrapeResults(actualTarget, page, scenario, logToFile);
      await closeAllOpenTabs(page);
    }
    const scenarioBlock = [
      `Doc Count: ${actualTarget}`,
      `Deal Point: ${scenario.dealPoint}`,
      `Results:`,
      findings.text,
      ``,
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);
    await clearBtn.click();
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );

  try {
    console.log("Final Dump:\n", finalDump);
    await updateGoogleSheet(finalDump, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  } finally {
    logToFile("\n--- End of AOE-Deal Points Report ---");
    await closeAllOpenTabs(page);
  }
};

const scrapeResults = async (
  targetCount: number,
  page: Page,
  scenario: any,
  logToFile: Function,
) => {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount) {
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

          console.log("---------------------------------");
          for (const [index, text] of cleanContent.entries()) {
            console.log(index, text);
          }
          console.log("---------------------------------");
          const idIndex = cleanContent.findIndex((t) => /^\d{7,8}$/.test(t));

          const intelligizeId = idIndex !== -1 ? cleanContent[idIndex] : "N/A";

          const rowValues =
            idIndex !== -1 ? cleanContent.slice(idIndex + 1) : [];

          let foundValue = "N/A";
          let isMatch = false;

          if (scenario.minRange || scenario.maxRange) {
            const dealMatch = rowValues.find((t) => t.includes("Deal Size-"));

            foundValue = dealMatch
              ? dealMatch.split("Deal Size-")[1].trim()
              : "N/A";

            const actualNum = parseCurrency(foundValue);
            const minNum = parseCurrency(scenario.minRange || "0");
            const maxNum = parseCurrency(scenario.maxRange || "999B");

            isMatch = actualNum >= minNum && actualNum <= maxNum;
          } else {
            const target = scenario.value.toLowerCase();

            const match = rowValues.find((t) =>
              t.toLowerCase().includes(target),
            );

            foundValue = match || "N/A";

            isMatch = !!match;
          }

          if (!isMatch) {
            isScenarioValid = false;
            rowsData.push(
              `❌ VAL ERROR >> ID: ${intelligizeId} | Expected: ${scenario.value || scenario.minRange + "-" + scenario.maxRange} | Found: ${foundValue}`,
            );
          }
          console.log(
            `Row ${resultsFound + 1}: ID ${intelligizeId} | Value ${foundValue} | Match: ${isMatch}`,
          );

          processedIds.add(rowId);
          resultsFound++;

          if (resultsFound >= targetCount) break;
        } catch (e: any) {
          console.log(`Error processing row: ${e.message}`);
          isScenarioValid = false;
          processedIds.add(rowId);
          resultsFound++;
        }
      }
    }
    if (resultsFound < targetCount) {
      console.log(
        `Scrolling for more results... (${resultsFound}/${targetCount})`,
      );
      await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(1000);
    }
  }

  return { text: rowsData.join("\n"), isValid: isScenarioValid };
};
