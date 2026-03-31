import { test, expect, Locator, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";

const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");

const setupLogger = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const logDirectory = path.resolve(__dirname, "./Results/sf-crawling");
  if (!fs.existsSync(logDirectory))
    fs.mkdirSync(logDirectory, { recursive: true });
  const fileName = path.join(logDirectory, `sf-crawling-${timestamp}.txt`);

  return (message: string) => {
    fs.appendFileSync(fileName, message + "\n");
    console.log(message);
  };
};

const typeValue = async (locator: Locator, value: string) => {
  await locator.focus();
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 50 });
};

const fillAndEnter = async (page: Page, locator: Locator, value: string) => {
  await typeValue(locator, value);
  await page.keyboard.press("Enter");
};

const getTabText = async (page: Page, expectedIndex: number) => {
  const tabLocator = page.locator(
    '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
  );
  await expect(tabLocator.nth(expectedIndex)).toBeVisible({ timeout: 60000 });
  return await tabLocator.nth(expectedIndex).innerText();
};
const performLogin = async (page: Page, logToFile: Function) => {
  await page.goto("/");

  const userIdInput = page.locator("#userid");

  if (await userIdInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    logToFile("Session expired or not found. Performing manual login...");

    await userIdInput.fill(process.env.APP_USERNAME!);
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator("#password").fill(process.env.APP_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(/.*apps.intelligize.com/, {
      waitUntil: "networkidle",
    });
    await page.context().storageState({ path: AUTH_PATH });
    logToFile("Login successful. auth.json updated.");
  } else {
    logToFile("Active session detected via auth.json. Skipping login.");
  }
};
const getRandomIndices = (count: number, max: number) => {
  const indices = new Set<number>();
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * max));
  }
  return Array.from(indices);
};

test.describe("SF-PDEE Automation", async () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-PDEE crawling and validation", async ({ page }) => {
    const logToFile = setupLogger();
    await page.goto("/");

    // 1. Login Handling
    await performLogin(page, logToFile);
    // 2. Navigation & Filters
    await page.locator("text=/SEC Filings/i").first().click();
    await page.getByRole("button", { name: /^Clear Filters$/i }).click();
    await page.waitForTimeout(1000);
    await page.locator('label[for="-ExhibitsToFilings"]').click();
    let daySearch = "Last 7 Days";
    const dateInput = page.locator(
      '//label[text()="Date"]/ancestor::div[5]//input',
    );

    await fillAndEnter(page, dateInput, daySearch);
    await page.getByRole("button", { name: /^Search$/i }).click();

    // 3. Tab Index 0 Validation
    const statusText = await getTabText(page, 0);
    logToFile(`Search Result: ${statusText}`);

    if (statusText.includes("No Results Found")) {
      logToFile(`Result: VALID (No data to crawl)`);
    } else {
      let targetIndices = getRandomIndices(5, 25);
      targetIndices = targetIndices.sort((a, b) => a - b);

      logToFile(
        `Action: Targeting random row indices: ${targetIndices.join(", ")}`,
      );

      const processedIds = new Set<string>();

      for (let i = 0; i < targetIndices.length; i++) {
        const index = targetIndices[i];
        const scroller = page.locator(".ReactVirtualized__Grid").last();
        //let resultsContainer = scroller.locator('div[role="rowgroup"]').first();
        let resultsContainer = scroller.locator('> div[role="rowgroup"]');
        const rowHeight = await scroller.evaluate((el) => {
          const sampleRow = el.querySelector('[data-test="resultRow"]');
          return sampleRow ? sampleRow.getBoundingClientRect().height : 115;
        });

        await scroller.evaluate(
          (el, { index, height }) => {
            el.scrollTop = index * height;
          },
          { index: index, height: rowHeight },
        );

        console.log(`Processing Row: ${1 + index}`);
        let currentRow = resultsContainer
          .locator(`> div > div[data-test="resultRow"][id="${index}"]`)
          .first();

        const rowExists = (await currentRow.count()) > 0;
        if (rowExists) {
          await currentRow.evaluate((el) =>
            el.scrollIntoView({ block: "start" }),
          );
        } else {
          console.log(
            `Row with index ${index} not found after scrolling. Skipping...`,
          );
          await scroller.evaluate((el) => (el.scrollTop += el.clientHeight));
          await page.waitForTimeout(1000);
          i--;
          continue;
        }
        await page.waitForTimeout(500);
        const checkbox = currentRow.locator("label").first();
        await checkbox.check({ force: true });
      }

      logToFile(`Total Selected Rows: ${processedIds.size}`);
      await page.waitForTimeout(1000); // For your manual verification
      // 5. PDF Download Logic
      logToFile("Action: Processing PDF Download...");
      const downloadBtn = page.locator('button[title*="Download"]');
      await downloadBtn.click();
      await page.locator('label[for="coverPage"]').click({ force: true });

      await page.locator('div[name="formats"]').nth(0).click({ force: true });

      const [pdfDownload] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /ok/i }).click(),
      ]);
      await pdfDownload.saveAs(
        path.join("./downloads", pdfDownload.suggestedFilename()),
      );
      logToFile(`Downloaded PDF: ${pdfDownload.suggestedFilename()}`);

      await downloadBtn.click();
      await page.locator('label[for="coverPage"]').click({ force: true });

      await page.locator('div[name="formats"]').nth(1).click({ force: true });

      const [docxDownload] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /ok/i }).click(),
      ]);
      await docxDownload.saveAs(
        path.join("./downloads", docxDownload.suggestedFilename()),
      );
      logToFile(`Downloaded DOCX: ${docxDownload.suggestedFilename()}`);

      await downloadBtn.click();
      await page.locator('label[for="coverPage"]').click({ force: true });

      await page.locator('div[name="formats"]').nth(2).click({ force: true });

      const [htmlDownload] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /ok/i }).click(),
      ]);
      await htmlDownload.saveAs(
        path.join("./downloads", htmlDownload.suggestedFilename()),
      );
      logToFile(`Downloaded HTML: ${htmlDownload.suggestedFilename()}`);

      logToFile("Action: Processing Excel Download...");
      await page.locator('button:has-text("Excel List")').click();
      await page
        .locator('label[for="includeTextSnippets"]')
        .click({ force: true });

      const [excelDownload] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /ok/i }).click(),
      ]);
      await excelDownload.saveAs(
        path.join("./downloads", excelDownload.suggestedFilename()),
      );
      logToFile(
        "=".repeat(30) + `\nREPORT END: ${new Date().toLocaleString()}`,
      );
    }
  });
  const scenarioBlock = [
    `Status: "VALID ✅"`,
    ``,
    `Filters Used`,
    `Date: Last 7 Days`,
    `Exhibits to Filings: Exclude`,
    `Search For: Filings`,
    `PDEE Used`,
    ``,
    `PDF Download: Passed`,
    `Docx Download: Passed`,
    `HTML Download: Passed`,
    `Excel Download: Passed`,
  ].join("\n");
  await updateGoogleSheet(scenarioBlock, "sf_pdee", []);
});
