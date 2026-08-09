import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  closeAllOpenTabs,
  configureDisplayColumns,
  fillAndEnter,
  getTabText,
  getTargetDateString,
  parseCount,
} from "../../utils/helpers";

const IDENTIFIER = "sf_filingAgent";

export const runFilingAgentTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Filing Agent Report ---");

  const dateInput = page.locator(
    '//label[text()="Date"]/ancestor::div[5]//input',
  );
  const searchBtn = page.getByRole("button", { name: /^Search$/i }).first();
  const clearBtn = page.getByRole("button", { name: /^Clear Filters$/i });

  const testCases = [
    {
      date: getTargetDateString(),
      agent: "Akin Gump Strauss Hauer & Feld LLP",
      alias: ["Akin Gump Strauss Hauer & Feld LLP"],
      count: 15,
    },
    {
      date: getTargetDateString(),
      agent: "Broadridge Financial Solutions, Inc",
      alias: ["Broadridge Financial Solutions, Inc./FA", "Broadridge Investor Communication Solutions, Inc"],
      count: 15,
    },
    {
      date: getTargetDateString(),
      agent: "Donnelley Financial Solutions",
      alias: [
        "Donnelley Financial /ArcFiling/",
        "DONNELLEY FINANCIAL SOLUTIONS",
        "DONNELLEY FINANCIAL SOLUTIONS /FA/",
        "DONNELLEY FINANCIAL SOLUTIONS 03/FA",
        "DONNELLEY FINANCIAL SOLUTIONS/NY",
      ],
      count: 15
    },
  ];

  let tabIndex = 0;
  let selectCheckboxes = true;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];

  for (const scenario of testCases) {
    await clearBtn.click();
    await page.waitForTimeout(300);
    let findings = { text: "No Results Found", isValid: true };

    await page.getByTestId("amendmentFilings-radio-EXC").click();
    await page.getByTestId("ownershipForms-radio-INC").click();

    logToFile(`\nTesting Scenario: ${scenario.date}`);
    await fillAndEnter(page, dateInput, scenario.date, 50);

    let filingAgentInput = page.getByTestId("filingAgentAndSoftware-input");
    await fillAndEnter(page, filingAgentInput, scenario.agent, 50);

    let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
    await exhibitsCheckbox.click({ force: true });
    await page.waitForTimeout(300);
    await searchBtn.click();

    const textDateOnly = await getTabText(page, tabIndex++, logToFile);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    if (textDateOnly.includes("Docs")) {
      if (selectCheckboxes) {
        await configureDisplayColumns(page, {
          "Filing Info": ["Accession #", "Filing Agent"],
          "Company Info": [],
        });
        selectCheckboxes = false;
      }
      await page.waitForTimeout(500);
      const docsCount = parseCount(textDateOnly);
      actualTarget = Math.min(scenario.count, docsCount);

      findings = await scrapeFilingAgentResults(
        actualTarget,
        page,
        scenario,
      );
    }

    const scenarioBlock = [
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
      `Date: ${scenario.date}`,
      `Agent Name: ${scenario.agent}`,
      ``,
      `${findings.text.includes("No Results Found") ? "Results:" : "Failure Accession IDs:"}`,
      `${findings.text.trim().length > 0 ? findings.text : "None"}`,
      ``,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );

  try {
    await updateGoogleSheet(finalDump, IDENTIFIER, []);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }
  logToFile("\n--- End of Report ---");

  await closeAllOpenTabs(page);
};

async function scrapeFilingAgentResults(
  targetCount: number,
  page: Page,
  scenario: any,
) {
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount || resultsFound == 24) {
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

          const accessionNo =
            cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
            "N/A";
          const filingAgentIndex = cleanContent.indexOf("Filing Agent");
          const filingAgent =
            filingAgentIndex !== -1
              ? cleanContent[filingAgentIndex + 1]
              : "No Filing Agent Found";

          const isLineMissingData =
            filingAgent == "No Filing Agent Found" || !accessionNo;
         
          const names = [scenario.agent, ...scenario.alias];
          const match = names.some(name =>
            filingAgent.toLowerCase().includes(name.toLowerCase())
          );

          if (isLineMissingData) {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> Acc.No: ${accessionNo} | Filing Agent: ${filingAgent}`,
            );
          } else if (!match || filingAgent === "No Filing Agent Found") {
            isScenarioValid = false;
            rowsData.push(
              `❌ WRONG Filing Agent >> Acc.No: ${accessionNo} | Filing Agent: ${filingAgent}`,
            );
          }

          console.log(`Acc.No: ${accessionNo} || Filing Agent ${filingAgent}`);
          processedIds.add(rowId);
          await page.waitForTimeout(500);
          resultsFound++;
        } catch (e) {
          console.log(`Skipping Row ${rowId} due to re-render.`);
        }
      }

      if (resultsFound >= targetCount) break;
    }
    if (resultsFound < targetCount) {
      await page.waitForTimeout(500);
      await rows.last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
  }

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
}
