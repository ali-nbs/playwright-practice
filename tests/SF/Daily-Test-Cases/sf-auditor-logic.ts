import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
  getTargetDateString,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_auditor";

export const runAuditorTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Auditor Report ---");

  const sf = new SfPage(page);


  const testCases = [{ date: getTargetDateString(), formType: "10-k", count: 15 }];

  let tabIndex = 0;
  let selectCheckboxes = true;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];

  for (const scenario of testCases) {
    await sf.clearFilters();
    await page.waitForTimeout(5000);
    let findings = { text: "No Results Found", isValid: true };

    let amendmentFillingsRadioButton = sf.amendmentFilingsExcludeRadio;
    // await amendmentFillingsRadioButton.click();

    let ownershipFormsRadioButton = sf.ownershipFormsIncludeRadio;
    await ownershipFormsRadioButton.click();

    logToFile(`\nTesting Scenario: ${scenario.date}`);
    await sf.fillAndEnter(sf.dateInput, scenario.date, 50);
    logToFile(`\nTesting Form Type: ${scenario.formType}`);
    await sf.fillAndEnter(sf.formsInput, scenario.formType, 3000);

    let exhibitsCheckbox = sf.exhibitsToFilingsLabel;
    await page.waitForTimeout(2000);
    await exhibitsCheckbox.click();
    await sf.search();

    const textDateOnly = await sf.getTabText(tabIndex++, logToFile);
    logToFile(`Baseline (${scenario.date}): ${textDateOnly}`);

    if (textDateOnly.includes("Docs")) {
      if (selectCheckboxes) {
        await sf.configureDisplayColumns({
          "Filing Info": ["Accession #", "Audited By"],
          "Company Info": ["Recent Auditor"],
        });
        selectCheckboxes = false;
      }
      await page.waitForTimeout(500);
      const docsCount = parseCount(textDateOnly);
      actualTarget = Math.min(scenario.count, docsCount);

      findings = await scrapeAuditorResults(actualTarget, page);
    }

    const scenarioBlock = [
      `Date: ${scenario.date}`,
      `Doc Count: ${actualTarget}`,
      ``,
      `Results:`,
      findings.text,
      ``,
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );

  try {
    await updateGoogleSheet(finalDump, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  }
  logToFile("\n--- End of Report ---");

  await sf.closeAllOpenTabs();
};

const scrapeAuditorResults = async (targetCount: number, page: Page) => {
  const sf = new SfPage(page);
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount || resultsFound == 24) {
    const scroller = sf.scroller;
    const rows = sf.rows;
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
          const cleanContent = await sf.rowSpanTextsClean(row);

          const accessionNo =
            cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
            "N/A";

          const auditorIndex = cleanContent.indexOf("Audited By");
          const recentAuditorIndex = cleanContent.indexOf("Recent Auditor");

          console.log("auditorIndex", auditorIndex);
          console.log("recentAuditorIndex", recentAuditorIndex);

          const recentAuditorName =
            recentAuditorIndex !== -1
              ? cleanContent[recentAuditorIndex + 1]
              : "No Recent Auditor Found";

          const auditorName =
            auditorIndex !== -1
              ? cleanContent[auditorIndex + 1]
              : "No Auditor Found";

          const isLineMissingData =
            (auditorName == "No Auditor Found" &&
              recentAuditorName == "No Recent Auditor Found") ||
            !accessionNo;

          if (isLineMissingData) {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> Acc.No: ${accessionNo} | auditorName: ${auditorName}`,
            );
          } else {
            rowsData.push(
              `Acc.No: ${accessionNo} | auditorName: ${auditorName != "No Auditor Found" ? auditorName : recentAuditorName}`,
            );
          }

          console.log(
            `Acc.No: ${accessionNo} || Auditor ${auditorName != "No Auditor Found" ? auditorName : recentAuditorName}`,
          );
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
      await rows.last().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(500);
    }
  }

  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
