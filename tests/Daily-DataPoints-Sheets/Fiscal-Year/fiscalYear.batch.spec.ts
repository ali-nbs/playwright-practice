import { test, expect, Page } from "@playwright/test";
import { google } from "googleapis";
import path from "path";
import fs from "fs";
import {
  AUTH_PATH,
} from "../..//utils/helpers";
import { BasePage } from "../../pages/BasePage";

const SPREADSHEET_ID = "1ArHNlvrv-4vMedIlz5cohymFZtMhHhEK6FRAg7KqlIU";

const SHEET_NAMES = [
  // "1/20",
  // "1/23",
  // "1/26",
  // "1/27",
  // "1/28",
  // "1/29",
  // "1/30",
  // "7/2",
  // "2/2",
  // "2/3",
  // "2/4",
  // "2/5",
  // "2/6",
  // "2/9",
  // "2/10",
  // "2/11",
  // "2/12",
  // "2/13",
  // "2/17",
  // "2/19",
  // "2/20",
  // "2/23",
  // "2/24",
  // "2/25",
  // "2/27",
  // "2/26",
  // "2/27",
  // "3/3",
  // "3/4",
  // "3/5",
  // "3/6",
  // "3/9",
  // "3/10",
  // "3/11",
  // "3/12",
  // "3/13",
  // "3/16",
  // "3/17",
  // "3/18",
  // "3/19",
  // "3/20",
  // "3/23",
  // "3/24",
  // "3/25",
  // "3/26",
  // "3/27",
  // "3/30",
  // "3/31",
  // "7/1",
  // "4/1",
  // "3/2",
  // "3/3",
  // "3/4",
  // "3/5",
  // "3/6",
  // "3/9",
  // "3/10",
  // "3/11",
  // "3/12",
  // "3/13",
  // "3/16",
  // "3/17",
  // "3/18",
  // "3/19",
  // "3/20", 
  // "3/23",
  // "3/25",
  // "3/26",
  // "3/27",
  // "3/30",
  "8/11",
];
const KEY_FILE = path.resolve(process.cwd(), "credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const PROCESS_ALL_ROWS = false;

// export const runFiscalYearBatch = async (page: Page) => {
test.describe("Batch Fiscal-Year Processor", () => {
  // Use the auth state if it exists
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("Process all sheets in a single session", async ({ page }) => {
    // 1. Initial Navigation (Only happens ONCE)
    await page.goto("/");

    // 2. Handle Login only if redirected to login page
    if (
      page.url().includes("login") ||
      (await page
        .locator("#userid")
        .isVisible()
        .catch(() => false))
    ) {
      console.log("Session expired or missing. Logging in...");
      await page.locator("#userid").fill(process.env.APP_USERNAME!);
      await page.getByRole("button", { name: "Next" }).click();
      await page.locator("#password").fill(process.env.APP_PASSWORD!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/.*apps.intelligize.com/, {
        waitUntil: "networkidle",
      });
      await page.context().storageState({ path: AUTH_PATH });
    }

    // 3. Navigate to the starting point (SEC Filings) ONCE
    const secLink = page.locator("text=/SEC Filings/i").first();
    await secLink.click();

    for (const sheetName of SHEET_NAMES) {
      // await page.goto("/");

      const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE,
        scopes: SCOPES,
      });
      const sheets = google.sheets({
        version: "v4",
        auth: (await auth.getClient()) as any,
      });
      console.log(
        `\n========== STARTING BATCH: SHEET [${sheetName}] ==========`,
      );

      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetName}'!B2:M100`,
      });

      const rows = getResponse.data.values || [];
      const secLink = page.locator("text=/SEC Filings/i").first();
      await secLink.click();

      for (let i = 0; i < rows.length; i++) {
        const accNum = rows[i][0];
        const existingValueI = rows[i][7] ? String(rows[i][7]).trim() : "";

        const valJ = rows[i][8] ? String(rows[i][8]).trim() : "";
        const valK = rows[i][9] ? String(rows[i][9]).trim() : "";
        const valL = rows[i][10] ? String(rows[i][10]).trim() : "";
        const valM = rows[i][11] ? String(rows[i][11]).trim() : "";

        //const isRowFilled = valJ !== "" && valK !== "" && valM !== "";
        const isRowFilled =
          (valJ !== "" && valK !== "FALSE" && valK !== "" && valM !== "") ||
          valL !== "";

        if (!accNum) continue;

        if (!PROCESS_ALL_ROWS && isRowFilled) {
          console.log(
            `--- [${i + 1}/${rows.length}] Skipping: ${accNum} ${
              valL == "" ? "(Already Processed)" : "xbrl doc not found"
            } ---`,
          );
          continue;
        }

        console.log(
          `\n--- Sheet Name [${sheetName}] -> Row: [${i + 1}/${rows.length}] Processing: ${accNum} ---`,
        );

        try {
          const accessionNoInput = page
            .locator("div")
            .filter({ hasText: /^Accession Number$/ })
            .locator("input");
          await accessionNoInput.waitFor({ state: "visible", timeout: 240000 });
          await accessionNoInput.fill(accNum);
          await page.getByRole("button", { name: /^Search$/i }).click();

          // const allViewBtns = page.locator('button', { hasText: 'View' });
          // const noResults = page.locator('text=/No Results Found/i');
          const resultsFound = page.locator(
            '//span[contains(text(), "Docs:")]',
          );
          const noResults = page.locator(
            '//span[contains(text(), "No Results Found")]',
          );

          await Promise.race([
            resultsFound.first().waitFor({ state: "visible", timeout: 45000 }),
            noResults.waitFor({ state: "visible", timeout: 45000 }),
          ]);

          if (await noResults.isVisible()) {
            console.log(`No results for ${accNum}, skipping...`);
            continue;
          }

          console.log("Results Found", await resultsFound.innerText());

          // const targetRow = page.locator('div[data-test="resultRow"]').filter({ hasText: accNum });
          const scroller = page.locator(".ReactVirtualized__Grid").last();
          let resultsContainer = scroller.locator('> div[role="rowgroup"]');
          //const targetRow = page.locator(`div[data-test="resultRow"][id="0"]`);
          const targetRow = resultsContainer
            .locator(`> div > div[data-test="resultRow"][id="0"]`)
            .first();
          console.log(`Found target row for ${accNum}.`);
          const viewBtn = targetRow
            .getByRole("button", { name: /View/i })
            .last();
          const isixbrlBtn = targetRow
            .getByRole("button", { name: /iXBRL/i })
            .first();
          if (
            !(await isixbrlBtn.isVisible({ timeout: 5000 }).catch(() => false))
          ) {
            console.log(
              `iXBRL doc not found for ${accNum}. Updating Sheet and skipping...`,
            );

            // Update Columns J, K, L, M (J=i+2, K=i+2, L=i+2, M=i+2)
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `'${sheetName}'!L${i + 2}:M${i + 2}`,
              valueInputOption: "USER_ENTERED",
              requestBody: {
                values: [["XBRL doc not found", "Hafiz Ali"]],
              },
            });

            // const activeTab = page
            //   .locator('//span[contains(text(), "Docs:")]')
            //   .first();
            // if (await activeTab.isVisible()) {
            //   await activeTab.click({ button: "right" });
            //   await page
            //     .locator("text=/Close all tabs/i")
            //     .click()
            //     .catch(() => {});
            // }
            await new BasePage(page).closeAllOpenTabs();

            continue;
          }
          await viewBtn.click();
          // try {
          //     await viewBtn.waitFor({ state: 'visible', timeout: 30000 });
          //     console.log(`View button found for ${accNum}. Clicking...`);
          //     await viewBtn.click();
          // } catch (e) {
          //     console.log(`Target row found for ${accNum}, but View button never appeared.`);
          // }

          const docFrame = page
            .locator('iframe[src*="/SECFilings/Documents/"]')
            .first()
            .contentFrame();
          const currentFYELocator = docFrame
            .locator('ix\\:nonnumeric[name="dei:CurrentFiscalYearEndDate"]')
            .first();
          const docPeriodLocator = docFrame
            .locator('ix\\:nonnumeric[name="dei:DocumentPeriodEndDate"]')
            .first();

          let fiscalYearEndValue: string | null = null;

          if (
            await currentFYELocator
              .isVisible({ timeout: 10000 })
              .catch(() => false)
          ) {
            fiscalYearEndValue = await currentFYELocator.textContent();
          } else {
            await docPeriodLocator.waitFor({
              state: "attached",
              timeout: 2400000,
            });
            fiscalYearEndValue = await docPeriodLocator.textContent();
          }
          const innerText =
            (await currentFYELocator.textContent().catch(() => "")) || "";

          // 2. The Logic: If inner has the value AND a year, use it.
          // Otherwise, grab the outer tag which always has the "full" picture.
          if (innerText.match(/\d{4}/)) {
            fiscalYearEndValue = innerText.trim();
          } else {
            // This captures the split edge case AND the case where only the outer exists
            const outerText =
              (await docPeriodLocator.textContent().catch(() => "")) || "";
            fiscalYearEndValue = outerText.replace(/\s+/g, " ").trim();
          }
          const periodEndValue = fiscalYearEndValue?.trim() || "";

          console.log(`Period End Value: ${periodEndValue}`);
          const ixbrlBtn = page.locator("text=/^iXBRL$/i").first();
          await ixbrlBtn.waitFor({ state: "visible", timeout: 30000 });
          await ixbrlBtn.click();

          //const ex101Link = page.locator('text=/^EX-101$/i').first();
          //  const ex101Link = page.locator('a').filter({ hasText: /^EX-101$/ }).first();
          try {
            await page.locator("text=/^EX-101$/i").first().click();

            const xbrlFrame = page.frameLocator(
              "div.HtmlViewer__viewer___ZSwJe iframe",
            );

            // wait for XBRL-specific element
            await xbrlFrame
              .locator(".HtmlViewer-styles__xbrl-report-table-attribs___2OtRf")
              .first()
              .waitFor({
                state: "visible",
                timeout: 40000,
              });

            // const xbrlTab = page
            //     .locator('.toolTipWraper')
            //     .locator('//span[contains(text(), "XBRL")]');
            // if (await xbrlTab.count() > 0) {
            //     try {
            //         await xbrlTab.first().click({ button: 'left', timeout: 5000 });
            //     }
            //     catch (e) {

            //     }
            // }

            // Find all iframe elements
            const iframes = page.locator("iframe");
            const count = await iframes.count();
            console.log(`Total iframes found: ${count}`);

            // Loop through and print the 'src' of each
            for (let i = 0; i < count; i++) {
              const src = await iframes.nth(i).getAttribute("src");
              console.log(`Iframe ${i} source: ${src}`);
            }
            //  const xbrlFrame = page.frameLocator('iframe[src*="/SECFilings/Documents/"]').first();
            // const xbrlFrameLocator = page.locator('iframe').filter({
            //     has: page.locator('tr').filter({ hasText: /Current Fiscal Year End Date|Fiscal Year End/i })
            // }).first();
            // const src = await xbrlFrameLocator.getAttribute('src');
            // console.log(`Iframe source: ${src}`);
            // const xbrlFrame = xbrlFrameLocator.contentFrame();

            // 2. IMPORTANT: You MUST wait for the content to actually appear inside the frame.
            // If you don't wait, getValue() runs on an empty frame and returns "".
            console.log(`Waiting for XBRL content to load in frame...`);
            // await xbrlFrame.locator('tr').filter({
            //     hasText: /Current Fiscal Year End Date|Fiscal Year End/i
            // }).first().waitFor({ state: 'visible', timeout: 240000 });
            // const getValue = async (labels: string[]) => {
            //     const combinedSelector = labels.map(label => `tr:has-text("${label}")`).join(', ');
            //     const row = xbrlFrame.locator(combinedSelector).first();
            //     return await row.evaluate(tr => {
            //         const cells = Array.from(tr.querySelectorAll('td'));
            //         const dataCells = cells.map(c => c.textContent?.trim()).filter(text => text);
            //         console.log("data cells" , dataCells);
            //         const xbrlDateCell = dataCells.find(text => text?.startsWith('--'));
            //         return xbrlDateCell || (dataCells.length > 0 ? dataCells[dataCells.length - 1] : "");
            //     });
            // };
            const getValue = async (labels: string[]) => {
              for (const label of labels) {
                const row = xbrlFrame
                  .locator("tr")
                  .filter({
                    has: xbrlFrame.locator(`td.pl >> text=/^${label}$/i`),
                  })
                  .first();

                if ((await row.count()) > 0) {
                  const cells = row.locator("td.text");
                  const cellCount = await cells.count();

                  for (let i = 0; i < cellCount; i++) {
                    const text =
                      (await cells.nth(i).textContent())?.trim() || "";
                    if (/\d+/.test(text)) {
                      return text;
                    }
                  }
                }
              }
              return "";
            };

            const yearEnd = await getValue([
              "Current Fiscal Year End Date",
              "Fiscal Year End",
            ]);

            if (periodEndValue && yearEnd) {
              const calc = calculateDynamicFiscal(periodEndValue, yearEnd);
              const resultLabelJ = String(
                `${calc.quarter} ${calc.fiscalYear}`,
              ).trim();

              const isMatch = String(existingValueI) === String(resultLabelJ);
              const statusK = isMatch ? "TRUE" : "FALSE";

              console.log(`Result J: ${resultLabelJ} | Match: ${statusK}`);

              await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheetName}'!J${i + 2}:M${i + 2}`,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                  values: [[resultLabelJ, statusK, "", "Hafiz Ali"]],
                },
              });
            } else {
              console.log(
                `row ${i} , fiscal year end date ${yearEnd} not found `,
              );
            }
          } catch (e) {
            console.log(
              `Target row found for ${accNum}, but ex101Link never appeared.`,
            );
             await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheetName}'!J${i + 2}:M${i + 2}`,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                  values: [["", "", "", "Hafiz Ali"]],
                },
              });

          }
        } catch (error: any) {
          console.error(`Error processing ${accNum}: ${error.message}`);
        } finally {
          //   const activeTab = page.locator(
          //     '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
          //   );
          //   if ((await activeTab.count()) > 0) {
          //     try {
          //       await activeTab.first().click({ button: "right", timeout: 5000 });
          //       const closeAllBtn = page
          //         .locator("div.react-contextmenu-item:visible")
          //         .filter({ hasText: "Close all tabs" })
          //         .first();
          //       await closeAllBtn.dispatchEvent("click");
          //       await expect(activeTab).toHaveCount(0, { timeout: 15000 });
          //     } catch (cleanupError) {
          //       await page.reload();
          //     }
          //   }
          await new BasePage(page).closeAllOpenTabs();
        }
      }
    }
  }

)
});

// function calculateDynamicFiscal(periodStr: string, yearEndStr: string) {
//   const periodDate = new Date(periodStr);
//   const pMonth = periodDate.getMonth() + 1;
//   const pYear = periodDate.getFullYear();

//   const parts = yearEndStr.split("-");
//   const fyEndMonth = parseInt(parts[parts.length - 2]);
//   const fyEndDay = parseInt(parts[parts.length - 1]) || 31; // Capture custom day
//   const fyStartMonth = (fyEndMonth % 12) + 1;
//   console.log(`periodStrh: ${periodStr}, yearEndStr: ${yearEndStr}, fyEndDay: ${fyEndDay}`);

//   let monthsSinceStart = (pMonth - fyStartMonth + 12) % 12;
//   let quarterNum = Math.floor(monthsSinceStart / 3) + 1;

//   let yearOfCycleStart = pMonth < fyStartMonth ? pYear - 1 : pYear;

//   let yearCountMap: Record<number, number> = {};

//   for (let i = 0; i < 12; i++) {
//     let m = ((fyStartMonth + i - 1) % 12) + 1;
//     let yearOfTrailingMonth =
//       m < fyStartMonth ? yearOfCycleStart + 1 : yearOfCycleStart;

//     yearCountMap[yearOfTrailingMonth] =
//       (yearCountMap[yearOfTrailingMonth] || 0) + 1;
//   }

//   const years = Object.keys(yearCountMap)
//     .map(Number)
//     .sort((a, b) => b - a);
//   let finalFiscalYear = years[0];

//   if (years.length > 1) {
//     const latestYear = years[0];
//     const earlierYear = years[1];

//     if (yearCountMap[earlierYear] > yearCountMap[latestYear]) {
//       finalFiscalYear = earlierYear;
//     }
//   }
//   console.log(`Cycle Years:`, yearCountMap);
//   console.log(`Result: Q${quarterNum} ${finalFiscalYear}`);

//   return {
//     quarter: `Q${quarterNum}`.replace(/^Q4$/, `FY`),
//     fiscalYear: finalFiscalYear,
//   };
// }


export function calculateDynamicFiscal(periodStr: string, yearEndStr: string, leverageDays: number = 30) {
  const periodDate = new Date(periodStr);
  let pMonth = periodDate.getMonth() + 1;
  let pYear = periodDate.getFullYear();

  const parts = yearEndStr.split("-");
  const fyEndMonth = parseInt(parts[parts.length - 2]);
  const fyEndDay = parseInt(parts[parts.length - 1]) || 31; // Capture custom day
  const fyStartMonth = (fyEndMonth % 12) + 1;

  console.log(`periodStr: ${periodStr}, yearEndStr: ${yearEndStr}`);

  // 🎯 THE LEVERAGE SHORTCUT (No Loops)
  // Find the closest previous quarter-end month relative to the current pMonth
  let monthsPast = (pMonth - fyEndMonth + 12) % 3;
  let qEndMonth = pMonth - monthsPast;
  let qEndYear = pYear;

  if (qEndMonth <= 0) {
    qEndMonth += 12;
    qEndYear -= 1;
  }

  // Construct that specific quarter-end date
  const maxDays = new Date(qEndYear, qEndMonth, 0).getDate();
  const targetQuarterEnd = new Date(qEndYear, qEndMonth - 1, Math.min(fyEndDay, maxDays));

  // Calculate day difference
  const diffDays = (periodDate.getTime() - targetQuarterEnd.getTime()) / (1000 * 60 * 60 * 24);

  // If it falls within the late-filing grace period, snap the parameters back
  if (diffDays >= 0 && diffDays <= leverageDays) {
    console.log(`👉 Late filing detected (${Math.round(diffDays)} days). Snapping back to Month ${qEndMonth}`);
    pMonth = qEndMonth;
    pYear = qEndYear;
  }

  // ── Core Calculations (100% Preserved from your original script) ──────────────────
  let monthsSinceStart = (pMonth - fyStartMonth + 12) % 12;
  let quarterNum = Math.floor(monthsSinceStart / 3) + 1;

  let yearOfCycleStart = pMonth < fyStartMonth ? pYear - 1 : pYear;
  let yearCountMap: Record<number, number> = {};

  for (let i = 0; i < 12; i++) {
    let m = ((fyStartMonth + i - 1) % 12) + 1;
    let yearOfTrailingMonth =
      m < fyStartMonth ? yearOfCycleStart + 1 : yearOfCycleStart;

    yearCountMap[yearOfTrailingMonth] =
      (yearCountMap[yearOfTrailingMonth] || 0) + 1;
  }

  const years = Object.keys(yearCountMap)
    .map(Number)
    .sort((a, b) => b - a);
  let finalFiscalYear = years[0];

  if (years.length > 1) {
    const latestYear = years[0];
    const earlierYear = years[1];

    if (yearCountMap[earlierYear] > yearCountMap[latestYear]) {
      finalFiscalYear = earlierYear;
    }
    console.log("lastest year" , latestYear , yearCountMap[latestYear]);
    console.log("earlierYear " , earlierYear , yearCountMap[earlierYear] );
  }
  
  console.log(`Result: Q${quarterNum} ${finalFiscalYear}`);

  return {
    quarter: `Q${quarterNum}`.replace(/^Q4$/, `FY`),
    fiscalYear: finalFiscalYear,
  };
}