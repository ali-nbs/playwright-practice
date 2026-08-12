import { Page } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import {
  parseCount,
} from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_accountant";

export const runAccountantTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-Accountant Report ---");

  const sf = new SfPage(page);


  const testCases = [
    { id: 1, formType: "10-k", accountant: "Deloitte & Touche", count: 15 },
    { id: 2, formType: "10-k", accountant: "Ernst & Young", count: 15 },
    { id: 3, formType: "10-k", accountant: "KPMG", count: 15 },
    {
      id: 4,
      formType: "10-k",
      accountant: "PriceWaterhouseCoopers",
      count: 15,
    },
  ];

  let tabIndex = 0;
  let selectCheckboxes = true;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];

  for (const scenario of testCases) {
    await sf.clearFilters();
    await page.waitForTimeout(1000);
    let findings = { text: "No Results Found", isValid: true };

    const sectionFilterBlock = sf.filterBlock(/^Accountant$/);
    const sectionPlusBtn = sf.filterAddIcon(/^Accountant$/);
    const modal = sf.popupBody;

    while (!(await modal.isVisible())) {
      await sectionPlusBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
    const auditorSelection = modal
      .locator("label._checkbox__icon_1xotg_257 ")
      .nth(scenario.id);
    await auditorSelection.click();

    await modal
      .locator('div[id="Audited the filing (10-K, 20-F, 40-F)"]')
      .locator("div")
      .nth(0)
      .click();

    //  await page.pause();
    await sf.okBtn.click();

    logToFile(`\nTesting Form Type: ${scenario.formType}`);
    await sf.fillAndEnter(sf.formsInput, scenario.formType, 200);
    //await sf.formsInput.press('Enter');
    let exhibitsCheckbox = sf.exhibitsToFilingsLabel;
    await exhibitsCheckbox.click({ force: true });
    await page.waitForTimeout(1000);
    await sf.searchBtn.click();

    const textDateOnly = await sf.getTabText(tabIndex++, logToFile);
    logToFile(`Baseline (${scenario.id}): ${textDateOnly}`);

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

      findings = await scrapeResults(actualTarget, page, scenario.accountant);
    }
    const scenarioBlock = [
      `Doc Count: ${actualTarget}`,
      `Auditor: ${scenario.accountant}`,
      `Scope: Audited the filing (10-K, 20-F, 40-F)`,
      `Exhibits to Filings: Exclude`,
      `Results:`,
      findings.text,
      ``,
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌ (Missing Data)"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);
    // await sf.clearFilters();
  }

  const finalDump = allScenarioResults.join(
    "\n---------------------------------\n",
  );

  try {
    await updateGoogleSheet(finalDump, IDENTIFIER);
    logToFile("Sheet updated successfully.");
  } catch (e: any) {
    logToFile(`Sheet update failed: ${e.message}`);
  } finally {
    logToFile("\n--- End of SF-Accountant Report ---");
    await sf.closeAllOpenTabs();
  }
};
const scrapeResults = async (
  targetCount: number,
  page: Page,
  targetAuditor: string,
) => {
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
          const { spans: cleanContent } = await sf.rowData(row);
          console.log("```````````````````````````````````````");
          // for (const [index, text] of cleanContent.entries()) {
          //   console.log(index, text);
          // }
          console.log("```````````````````````````````````````");
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

          const splitAuditors = (str: string) =>
            (str || "")
              .split("●")
              .map((s) => s.trim())
              .filter(Boolean);
          const normalize = (s: string) =>
            s
              .toLowerCase()
              .replace(/\u00A0/g, " ")
              .replace(/[^a-z& ]/g, "")
              .replace(/\s+/g, " ")
              .trim();
          const auditors =
            auditorName !== "No Auditor Found"
              ? splitAuditors(auditorName)
              : splitAuditors(recentAuditorName);

          const isMatch = auditors.some(
            (a) => normalize(a) === normalize(targetAuditor),
          );

          if (isLineMissingData) {
            isScenarioValid = false;
            rowsData.push(
              `❌ MISSING DATA >> Acc.No: ${accessionNo} | auditorName: ${auditorName}`,
            );
          } else if (!isMatch) {
            isScenarioValid = false;
            rowsData.push(
              `❌ WRONG AUDITOR >> Acc.No: ${accessionNo} | auditorName: ${auditorName !== "No Auditor Found" ? auditorName : recentAuditorName}`,
            );
          } else {
            rowsData.push(
              `Acc.No: ${accessionNo} | auditorName: ${auditorName !== "No Auditor Found" ? auditorName : recentAuditorName}`,
            );
          }
          console.log(
            `Acc.No: ${accessionNo} || Auditor: ${auditorName !== "No Auditor Found" ? auditorName : recentAuditorName}`,
          );
          console.log("```````````````````````````````````````");
          processedIds.add(rowId);
          await page.waitForTimeout(700);
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
      //  await rows.last().scroll({ block: "start" });
      await page.waitForTimeout(500);
    }
  }
  console.log(`Successfully scraped ${resultsFound} rows.`);
  return {
    text: rowsData.join("\n"),
    isValid: isScenarioValid,
  };
};
