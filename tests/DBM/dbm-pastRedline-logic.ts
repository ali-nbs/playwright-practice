import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { DbmPage } from "../pages/DbmPage";
import {
  parseCount,
  parseCurrency,
} from "../utils/helpers";

const IDENTIFIER = "dbm_pastRedline";

export const runPastRedlineVersionTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting DBM Past Redline Version Report ---");

  let tabIndex = 0;
  let selectCheckboxes = true;
  let actualTarget = 0;
  let allScenarioResults: string[] = [];

  const dbm = new DbmPage(page);
  const searchDate = "Today";

  await dbm.clearFilters();
  await page.waitForTimeout(1000);
  let findings = { text: "No Results Found", isValid: true };

  // await fillAndEnter(page, dbm.dateInput, searchDate, 200);

  await dbm.search();

  const searchResultTextOnly = await dbm.getTabText(0, logToFile);
  logToFile(`Baseline ${searchDate}: ${searchResultTextOnly}`);

  if (searchResultTextOnly.includes("Results")) {
    await dbm.configureDisplayColumns(
      {
        "Filing Info": ["Accession #"],
        "Company Info": [],
      },
      {
        enableRedlinePastVersion: true,
      },
    );

    await page.waitForTimeout(500);
    const docsCount = parseCount(searchResultTextOnly);
    actualTarget = Math.min(25, docsCount);
    console.log(`Actual target for scenario ${actualTarget}`);
    findings = await scrapeResults(actualTarget, page, logToFile);
    //await page.pause();
    await dbm.closeAllOpenTabs();

    const scenarioBlock = [
      `Doc Count: ${actualTarget}`,
      `Results:`,
      findings.text,
      ``,
      `Scenario Status: ${findings.isValid ? "VALID ✅" : "INVALID ❌"}`,
    ].join("\n");

    allScenarioResults.push(scenarioBlock);

    await dbm.clearFilters();
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
    await dbm.closeAllOpenTabs();
  }
};

const scrapeResults = async (
  targetCount: number,
  page: Page,
  logToFile: Function,
) => {
  const dbm = new DbmPage(page);
  let resultsFound = 0;
  const processedIds = new Set<string>();
  let rowsData: string[] = [];
  let isScenarioValid = true;

  while (resultsFound < targetCount) {
    const rows = dbm.rows;
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
          // for (const [index, text] of cleanContent.entries()) {
          //   console.log(index, text);
          // }
          console.log("---------------------------------");
          const accessionNo =
            cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
            "N/A";
          const firstIndex = 3;
          const target = cleanContent[firstIndex];

          const secondIndex = cleanContent.findIndex(
            (item, idx) =>
              idx > firstIndex &&
              item.toLowerCase().includes(target.toLowerCase()),
          );
          const docAndSection = cleanContent.slice(
            firstIndex,
            secondIndex === -1 ? cleanContent.length : secondIndex,
          );

          console.log(
            `Row: ${resultsFound + 1} || Accession ID: ${accessionNo} `,
          );

          const notSupportedDocTagLine = cleanContent[
            cleanContent.length - 1
          ].includes(
            "We do not support redline past version for this type of document",
          );

          const redlineSnippets = row
            .locator(".styles__redLineBody___1_VOS")
            .first();
          const snippetText = await redlineSnippets.allInnerTexts();
          const hasContent = snippetText.length > 0;
          const errorLabel = hasContent
            ? "Highlighting Issue"
            : "Missing Content";
          const insTags = await redlineSnippets.locator("ins").count();
          const delTags = await redlineSnippets.locator("del").count();
          console.log("ins tags ", insTags, "del tags ", delTags);

          let isMatch = notSupportedDocTagLine || insTags > 0 || delTags > 0;

          if (!isMatch) {
            isScenarioValid = false;
            rowsData.push(
              `❌ ${errorLabel} >> Accession No: ${accessionNo} | Doc & Section: ${docAndSection.join(" > ")}`,
            );
          }
          console.log(
            `Row ${resultsFound + 1}: ${!isMatch ? errorLabel : ""} >> Accession No: ${accessionNo}  | Doc Section: ${docAndSection.join(" > ")}  | Match: ${isMatch}`,
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
