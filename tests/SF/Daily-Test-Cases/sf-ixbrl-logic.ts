import { Page, expect } from "@playwright/test";
import { updateGoogleSheet } from "../../utils/dumpDataOnGoogleSheet";
import { SfPage } from "../../pages/SfPage";

const IDENTIFIER = "sf_ixbrl";

export const runIxbrlTest = async (page: Page, logToFile: Function) => {
  logToFile("--- Starting SF-iXBRL Report ---");

  const sf = new SfPage(page);

  const clearBtn = sf.clearFiltersBtn;
  await sf.clearFiltersBtn.click({ force: true });
  await page.waitForTimeout(300);

  await sf.fillAndEnter(sf.formsInput, "10-K", 20);

  const exhibtsToFilingsCheckbox =  sf.exhibitsToFilingsLabel;
  await exhibtsToFilingsCheckbox.uncheck({ force: true });
  await page.waitForTimeout(300);
  await sf.searchBtn.click();

  const searchResult = await sf.getTabText(0, logToFile, false);
  const totalToProcess = 4;
  let processedCount = 0;
  let failureLogs: string[] = [];
  let isFailed = false;
  if (searchResult.includes("Docs")) {
    await sf.configureDisplayColumns({
      "Filing Info": ["Accession #"],
      "Company Info": [],
    });
    while (processedCount < totalToProcess) {
      const scroller = sf.scroller;
      const rowHeight = await sf.rowHeight();

      await sf.scrollToRowIndex(processedCount, rowHeight);

      let currentRow = sf.rowById(processedCount);

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
      const cleanContent = await sf.rowSpanTextsClean(currentRow);
      const accessionNo =
        cleanContent.find((text) => /^\d{10}-?\d{2}-?\d{6}$/.test(text)) ||
        "N/A";
      console.log(`Accession No: ${accessionNo}`);

      const viewBtn = sf.viewButton(currentRow).last();
      const hasiXBRLbtn = currentRow
        .getByRole("button", { name: /iXBRL/i })
        .first();
      const hasiXBRLLabel = await hasiXBRLbtn.isVisible();
      console.log(`iXBRL Label on Grid: ${hasiXBRLLabel ? "YES" : "NO"}`);

      try {
        if (await viewBtn.isVisible({ timeout: 5000 })) {
          await viewBtn.click();

          const ixbrlTab = sf.ixbrlTabById;
          await ixbrlTab.waitFor({ state: "attached", timeout: 10000 });

          const className = (await ixbrlTab.getAttribute("class")) || "";
          const isGreyedOut = className.includes("styles__disabled");

          if (!hasiXBRLLabel) {
            await expect(sf.ixbrlTabById).toHaveClass(/disabled/, {
              timeout: 60000,
            });
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
            await expect(sf.ixbrlTabById).not.toHaveClass(/disabled/, {
              timeout: 60000,
            });
            console.log(
              "SCENARIO: Label WAS on grid -> Section MUST be active",
            );

            try {
              await expect(ixbrlTab).not.toHaveClass(/disabled/, {
                timeout: 60000,
              });
              console.log(`SCENARIO: Label WAS on grid -> Section is active.`);

              await ixbrlTab.click();
              const ex101Link = sf.ex101Tab;
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
                console.log("⚠️ No rows found in the SEC Filing Detail table.");
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
      } catch (e: any) {
        console.log(`Extraction error for ${accessionNo}`);
        isFailed = true;
        failureLogs.push(`${accessionNo}`);
      }

      const resultsTab = sf.docsTabLabels.first();
      await sf.clickResultsTabIfVisible(resultsTab);
      await page.waitForTimeout(500);
      processedCount++;
    }
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

  await updateGoogleSheet(scenarioBlock, IDENTIFIER, failureLogs);

  logToFile("\n--- End of Report ---");
  await sf.closeAllOpenTabs();
};
