import { test, expect } from "@playwright/test";
import { google } from "googleapis";
import {
  closeAllOpenTabs,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import path from "path";

const SPREADSHEET_ID = "1kl5H-9-6c7KrJN_h-CuDONR8e04Q558sgZkUfVTYXf4";
const SHEET_NAME = "4/29";
const KEY_FILE = path.resolve(process.cwd(), "credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const PROCESS_ALL_ROWS = false;

test("Cross-Reference Links Google Sheets Processor", async ({ page }) => {
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
    range: `'${SHEET_NAME}'!B2:N200`,
  });

  const rows = getResponse.data.values || [];
  await ensureLoggedIn(page);
  await navigateToSECFilings(page);
  for (let i = 0; i < rows.length; i++) {
    const accNum = rows[i][0];
    const existingValueJ = rows[i][8] ? parseInt(rows[i][8]) : 0;

    const valK = rows[i][9] ? String(rows[i][9]).trim() : "";
    const valL = rows[i][10] ? String(rows[i][10]).trim() : "";
    const valM = rows[i][11] ? String(rows[i][11]).trim() : "";
    const valN = rows[i][12] ? String(rows[i][12]).trim() : "";

    //const isRowFilled = valJ !== "" && valK !== "" && valM !== "";
    const isRowFilled =
      (valK !== "" && valL !== "FALSE" && valL !== "" && valN !== "") ||
      valM !== "";

    if (!accNum) continue;

    if (!PROCESS_ALL_ROWS && isRowFilled) {
      console.log(
        `--- [${i + 1}/${rows.length}] Skipping: ${accNum} ${
          valM == "" ? "(Already Processed)" : "Result Not Found"
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
      await page.getByTestId("ownershipForms-radio-INC").click();
      await page.getByRole("button", { name: /^Search$/i }).click();

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
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!K${i + 2}:N${i + 2}`, // Updating K, L, M, N
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[valK, valL, "No Result Found", "Playwright-Bot"]],
          },
        });
        continue;
      }

      console.log("Results Found", await resultsFound.innerText());

      const scroller = page.locator(".ReactVirtualized__Grid").last();
      let resultsContainer = scroller.locator('> div[role="rowgroup"]');
      const targetRow = resultsContainer
        .locator(`> div > div[data-test="resultRow"][id="0"]`)
        .first();
      console.log(`Found target row for ${accNum}.`);

      const viewBtn = targetRow.getByRole("button", { name: /View/i }).first();
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await page.waitForTimeout(1000);
        const docFrame = page.frameLocator("iframe").first();
        await docFrame
          .locator("body")
          .waitFor({ state: "visible", timeout: 15000 });
        const crossReferenceLinksCount = await docFrame
          .locator(".cross-reference-anchor")
          .count();
        console.log(`Cross Reference Links found: ${crossReferenceLinksCount}`);
        const resultLabelK = crossReferenceLinksCount;

        const isMatch = existingValueJ === resultLabelK;
        const statusL = isMatch ? "TRUE" : "FALSE";

        console.log(`Result K: ${resultLabelK} | Match: ${statusL}`);

        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!K${i + 2}:N${i + 2}`, // Updating K, L, M, N
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[crossReferenceLinksCount, statusL, "", "Playwright-Bot"]],
          },
        });
      }
    } catch (error: any) {
      console.error(`Error processing ${accNum}: ${error.message}`);
    } finally {
      await closeAllOpenTabs(page);
    }
  }
});
