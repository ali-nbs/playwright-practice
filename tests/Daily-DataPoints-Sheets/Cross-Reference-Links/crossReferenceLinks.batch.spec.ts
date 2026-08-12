import { test, expect, Page } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import { BasePage } from "../../pages/BasePage";
import { google } from "googleapis";
import path from "path";
import fs from "fs";
import {
  AUTH_PATH,
  ensureLoggedIn,
} from "../..//utils/helpers";

const SPREADSHEET_ID = "1kl5H-9-6c7KrJN_h-CuDONR8e04Q558sgZkUfVTYXf4";

const SHEET_NAMES = [
  //   "1/16",
  //   "4/1",
  //   "4/2",
  //   "4/3",
  //   "4/6",
  //   "4/7",
  //   "4/8",
  //   "4/9",
  //   "4/10",
  //   "4/13",
  //   "4/14",
  //   "4/15",
  //   "4/16",
  //   "4/17",
  //   "4/20",
  //   "4/21",
  //   "4/22",
  //   "4/23",

 "8/11",
];
const KEY_FILE = path.resolve(process.cwd(), "credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const PROCESS_ALL_ROWS = false;

test.describe("Batch Fiscal-Year Processor", () => {
  // Use the auth state if it exists
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("Process all sheets in a single session", async ({ page }) => {
    // 1. Initial Navigation (Only happens ONCE)
    await ensureLoggedIn(page);
    await new SfPage(page).goto();

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
        range: `'${sheetName}'!B2:N200`,
      });

      const rows = getResponse.data.values || [];

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

        console.log(
          `\n--- [${i + 1}/${rows.length}] Processing: ${accNum} ---`,
        );

        try {
          const accessionNoInput = page
            .locator("div")
            .filter({ hasText: /^Accession Number$/ })
            .locator("input");
          await accessionNoInput.waitFor({ state: "visible", timeout: 240000 });
          await accessionNoInput.fill(accNum);
          await page.getByTestId("ownershipForms-radio-INC").click();
          await page.getByRole("button", { name: /^Search$/i }).click();

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
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `'${sheetName}'!K${i + 2}:N${i + 2}`, // Updating K, L, M, N
              valueInputOption: "USER_ENTERED",
              requestBody: {
                values: [[valK, valL, "No Result Found", "Hafiz Ali"]],
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

          const viewBtn = targetRow
            .getByRole("button", { name: /View/i })
            .first();
          if (await viewBtn.isVisible()) {
            await viewBtn.click();
            await page.waitForTimeout(1000);
            const docFrame = page.frameLocator("iframe").first();
            await docFrame
              .locator("body")
              .waitFor({ state: "visible", timeout: 15000 });
            await docFrame
              .locator(".cross-reference-anchor")
              .first()
              .waitFor({ state: "attached", timeout: 15000 })
              .catch(() => {});
            const crossReferenceLinksCount = await docFrame
              .locator(".cross-reference-anchor")
              .count();
            console.log(
              `Cross Reference Links found: ${crossReferenceLinksCount}`,
            );
            const resultLabelK = crossReferenceLinksCount;

            const isMatch = existingValueJ === resultLabelK;
            const statusL = isMatch ? "TRUE" : "FALSE";

            console.log(`Result K: ${resultLabelK} | Match: ${statusL}`);

            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `'${sheetName}'!K${i + 2}:N${i + 2}`, // Updating K, L, M, N
              valueInputOption: "USER_ENTERED",
              requestBody: {
                values: [
                  [crossReferenceLinksCount, statusL, "", "Hafiz Ali"],
                ],
              },
            });
          }
        } catch (error: any) {
          console.error(`Error processing ${accNum}: ${error.message}`);
        } finally {
          await new BasePage(page).closeAllOpenTabs();
        }
      }
    }
  });
});
