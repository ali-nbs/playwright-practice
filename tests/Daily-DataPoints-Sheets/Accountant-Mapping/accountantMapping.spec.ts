import { test, expect, Page } from "@playwright/test";
import { BasePage } from "../../pages/BasePage";
import { google } from "googleapis";
import * as fs from "fs";
import {
  ensureLoggedIn,
  AUTH_PATH,
  navigateToAgreementsAndOtherExhibits,
} from "../../utils/helpers";
import path from "path";

const SPREADSHEET_ID = "1DOnzSxSjCQYeQKewr0JDQiMzq_w4LM1dWHvMSW-9QUg";
const SHEET_NAME = "8/7";
const KEY_FILE = path.resolve(process.cwd(), "credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const PROCESS_ALL_ROWS = false;

if (fs.existsSync(AUTH_PATH)) {
  test.use({ storageState: AUTH_PATH });
}

//export const runAccountantMappingSheet = async (page: Page) => {
test("Accountant Mapping Google Sheets Processor", async ({ page }) => {
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
    range: `'${SHEET_NAME}'!A2:L200`,
  });

  const rows = getResponse.data.values || [];
  await ensureLoggedIn(page);
  await navigateToAgreementsAndOtherExhibits(page);

  let isFirstSearch = true;

  for (let i = 0; i < rows.length; i++) {
    const intelligizeNo = rows[i][0];
    const existingValueH = rows[i][7] ? String(rows[i][7]).trim() : "";

    const valI = rows[i][8] ? String(rows[i][8]).trim() : "";
    const valJ = rows[i][9] ? String(rows[i][9]).trim() : "";
    const valK = rows[i][10] ? String(rows[i][10]).trim() : "";
    const valL = rows[i][11] ? String(rows[i][11]).trim() : "";

    //const isRowFilled = valJ !== "" && valK !== "" && valM !== "";
    const isRowFilled =
      (valI !== "" && valJ !== "FALSE" && valJ !== "" && valL !== "") ||
      valK !== "";

    if (!intelligizeNo) continue;

    if (!PROCESS_ALL_ROWS && isRowFilled) {
      console.log(
        `--- [${i + 1}/${rows.length}] Skipping: ${intelligizeNo} ${
          valK == "" ? "(Already Processed)" : "Result Not Found"
        } ---`,
      );
      continue;
    }

    console.log(
      `\n--- [${i + 1}/${rows.length}] Processing: ${intelligizeNo} ---`,
    );

    try {
      const intelligizeIDInput = page.locator("input[id=intelligizeId-input]");
      await intelligizeIDInput.waitFor({ state: "visible", timeout: 240000 });
      await intelligizeIDInput.fill(intelligizeNo);

      await page.getByRole("button", { name: /^Search$/i }).click();

      const searchResult = await new BasePage(page).getTabText(0, () => {}, false);

      if (searchResult.includes("No Results Found")) {
        console.log(`No results for ${intelligizeNo}, skipping...`);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!I${i + 2}:L${i + 2}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["", "FALSE", "No Result Found", "Hafiz Ali"]],
          },
        });
        await new BasePage(page).closeAllOpenTabs();
        continue;
      }
      if (isFirstSearch) {
        await new BasePage(page).configureDisplayColumns({
          "Filing Info": [],
          "Company Info": [],
          "Deal Points": ["Financial Firms", "Law Firms"],
        });
        isFirstSearch = false;
      }
      const scroller = page.locator(".ReactVirtualized__Grid").last();
      let resultsContainer = scroller.locator('> div[role="rowgroup"]');
      const targetRow = resultsContainer
        .locator(`div[data-test="resultRow"][id="0"]`)
        .first();
      console.log(`Found target row for ${intelligizeNo}.`);
      const allFirms = targetRow.locator("td span");

      const count = await allFirms.count();
      console.log("count", count);

      let firmMatched = false;
      let errorMessage = "";
      let firmFoundInPopUp = "";
      if (count === 0) {
        errorMessage = "No Law/Financial Firm found on Result Grid";
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `'${SHEET_NAME}'!I${i + 2}:L${i + 2}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [
              ["", "FALSE", "No Firm Found in Result Grid", "Hafiz Ali"],
            ],
          },
        });
        await new BasePage(page).closeAllOpenTabs();
      } else {
        for (let i = 0; i < count; i++) {
          const firm = allFirms.nth(i);
          const firmText = (await firm.innerText()).trim().toLowerCase();

          if (existingValueH.toLowerCase() === firmText) {
            console.log("index matched ", i + 1);
            firmMatched = true;

            await firm.click();

            const snippetWrapper = page.locator(
              ".SnippetContent-styles__wrapper___ZxZH_",
            );

            try {
              try {
                await snippetWrapper.waitFor({
                  state: "visible",
                  timeout: 8000,
                });
              } catch {
                errorMessage = "Empty Pop-Up";
                continue;
              }

              const popupText = (await snippetWrapper.textContent())?.trim();

              if (!popupText) {
                errorMessage = "Empty Pop-Up";
                continue;
              }

              //   const highlightedFirm = snippetWrapper.locator("span", {
              //     hasText: existingValueH,
              //   });
              const highlightedFirm = page.locator(
                'span[style*="background-color"]',
              );

              const isVisible = await highlightedFirm
                .isVisible({ timeout: 5000 })
                .catch(() => false);

              if (!isVisible) {
                errorMessage = "No content highlighted in pop up";
                continue;
              }
              firmFoundInPopUp = (await highlightedFirm.innerText()).trim();
              if (
                existingValueH.toLowerCase() !==
                (await highlightedFirm.innerText()).trim().toLowerCase()
              ) {
                errorMessage = "Firm not matched in pop up";
                continue;
              }

              try {
                await expect(highlightedFirm).toHaveCSS(
                  "background-color",
                  "rgb(255, 255, 0)",
                  { timeout: 5000 },
                );
              } catch (err) {
                errorMessage = "Highlight Missing";
                continue;
              }
            } catch (err) {
              errorMessage = err.message || "Highlight Missing";
              continue;
            } finally {
              await page
                .locator(".draggableCancel span")
                .click({
                  force: true,
                })
                .catch(() => {});
            }
          }
        }

        if (!firmMatched) {
          errorMessage = "Firm not matched on Result Grid";
        }
      }
      if (errorMessage.trim() != "") {
        console.log("Final Error:", errorMessage);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!I${i + 2}:L${i + 2}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              firmFoundInPopUp,
              errorMessage.length > 0 ? "FALSE" : "TRUE",
              errorMessage,
              "Hafiz Ali",
            ],
          ],
        },
      });
      firmFoundInPopUp = "";

      await new BasePage(page).closeAllOpenTabs();
    } catch (e) {
      console.log("error: ", e);
    }
  }
});
//};
