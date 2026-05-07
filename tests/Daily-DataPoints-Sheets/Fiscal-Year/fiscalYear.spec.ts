import { test, expect } from "@playwright/test";
import { google } from "googleapis";
import path from "path";

const SPREADSHEET_ID = "1ArHNlvrv-4vMedIlz5cohymFZtMhHhEK6FRAg7KqlIU";
const SHEET_NAME = "4/29";
const KEY_FILE = path.resolve(process.cwd(), "credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const PROCESS_ALL_ROWS = false;

test("Fiscal-Year Google Sheets Processor", async ({ page }) => {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: SCOPES,
  });
  const sheets = google.sheets({
    version: "v4",
    auth: (await auth.getClient()) as any,
  });

  const getResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!B2:M100`,
  });

  const rows = getResponse.data.values || [];
  await page.goto("/");

  if (
    await page
      .locator("#userid")
      .isVisible({ timeout: 15000 })
      .catch(() => false)
  ) {
    await page.locator("#userid").fill(process.env.APP_USERNAME!);
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator("#password").fill(process.env.APP_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/.*apps.intelligize.com/);
  }

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

    console.log(`\n--- [${i + 1}/${rows.length}] Processing: ${accNum} ---`);

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
      const resultsFound = page.locator('//span[contains(text(), "Docs:")]');
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
      const viewBtn = targetRow.getByRole("button", { name: /View/i }).last();
      const isixbrlBtn = targetRow
        .getByRole("button", { name: /iXBRL/i })
        .first();
      if (!(await isixbrlBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
        console.log(
          `iXBRL doc not found for ${accNum}. Updating Sheet and skipping...`,
        );

        // Update Columns J, K, L, M (J=i+2, K=i+2, L=i+2, M=i+2)
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!L${i + 2}:M${i + 2}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["XBRL doc not found", "Playwright-Bot"]],
          },
        });

        // const activeTab = page.locator('//span[contains(text(), "Docs:")]').first();
        // if (await activeTab.isVisible()) {
        //     await activeTab.click({ button: 'right' });
        //     await page.locator('text=/Close all tabs/i').click().catch(() => { });
        // }
        const activeTab = page.locator(
          '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
        );
        if ((await activeTab.count()) > 0) {
          try {
            await activeTab.first().click({ button: "right", timeout: 5000 });
            const closeAllBtn = page
              .locator("div.react-contextmenu-item:visible")
              .filter({ hasText: "Close all tabs" })
              .first();
            await closeAllBtn.dispatchEvent("click");
            await expect(activeTab).toHaveCount(0, { timeout: 15000 });
          } catch (cleanupError) {
            await page.reload();
          }
        }

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
        await currentFYELocator.isVisible({ timeout: 30000 }).catch(() => false)
      ) {
        fiscalYearEndValue = await currentFYELocator.textContent({
          timeout: 60000,
        });
      } else {
        fiscalYearEndValue = await docPeriodLocator.textContent({
          timeout: 60000,
        });
      }
      const innerText =
        (await currentFYELocator
          .textContent({
            timeout: 60000,
          })
          .catch(() => "")) || "";

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
        // await page.waitForTimeout(3000); // Wait for the frame to load after clicking EX-101
        // const xbrlFrame = page
        //   .locator("div.HtmlViewer__viewer___ZSwJe iframe")
        //   .first()
        //   .contentFrame();
        // await xbrlFrame.locator("td.pl, .xbrl, table").first().waitFor({
        //   state: "visible",
        //   timeout: 40000,
        // });
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
        const iframes = page.locator("iframe");
        const count = await iframes.count();
        console.log(`Total iframes found: ${count}`);

        // Loop through and print the 'src' of each
        for (let i = 0; i < count; i++) {
          const src = await iframes.nth(i).getAttribute("src");
          console.log(`Iframe ${i} source: ${src}`);
        }
        console.log(`Waiting for XBRL content to load in frame...`);

        const getValue = async (labels: string[]) => {
          for (const label of labels) {
            const row = xbrlFrame
              .locator("tr")
              .filter({
                has: xbrlFrame.locator(`td.pl >> text=/^${label}$/i`),
              })
              .first();

            if ((await row.count()) > 0) {
              const valueCell = row.locator("td.text").first();
              return (await valueCell.textContent())?.trim() || "";
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
            range: `'${SHEET_NAME}'!J${i + 2}:M${i + 2}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [[resultLabelJ, statusK, "", "Playwright-Bot"]],
            },
          });
        } else {
          console.log(`row ${i} , fiscal year end date ${yearEnd} not found `);
        }
      } catch (e) {
        console.log(
          `Target row found for ${accNum}, but ex101Link never appeared.`,
        );
      }
    } catch (error: any) {
      console.error(`Error processing ${accNum}: ${error.message}`);
    } finally {
      const activeTab = page.locator(
        '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
      );
      if ((await activeTab.count()) > 0) {
        try {
          await activeTab.first().click({ button: "right", timeout: 5000 });
          const closeAllBtn = page
            .locator("div.react-contextmenu-item:visible")
            .filter({ hasText: "Close all tabs" })
            .first();
          await closeAllBtn.dispatchEvent("click");
          await expect(activeTab).toHaveCount(0, { timeout: 15000 });
        } catch (cleanupError) {
          await page.reload();
        }
      }
    }
  }
});

function calculateDynamicFiscal(periodStr: string, yearEndStr: string) {
  const periodDate = new Date(periodStr);
  const pMonth = periodDate.getMonth() + 1;
  const pYear = periodDate.getFullYear();

  const parts = yearEndStr.split("-");
  const fyEndMonth = parseInt(parts[parts.length - 2]);
  const fyStartMonth = (fyEndMonth % 12) + 1;
  console.log(`periodStrh: ${periodStr}, yearEndStr: ${yearEndStr}`);

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
  }
  console.log(`Cycle Years:`, yearCountMap);
  console.log(`Result: Q${quarterNum} ${finalFiscalYear}`);

  return {
    quarter: `Q${quarterNum}`.replace(/^Q4$/, `FY`),
    fiscalYear: finalFiscalYear,
  };
}
