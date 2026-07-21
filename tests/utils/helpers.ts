import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "./dumpDataOnGoogleSheet";

export const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");

export const setupLogger = (
  testName: string,
  logPath: string = "SF/Assigned-Components-Test-Cases",
) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 16)
    .replace("T", "_");
  const logDirectory = path.join(
    process.cwd(),
    "tests",
    logPath,
    "Results",
    testName,
  );
  console.log(`Logs will be saved to: ${logDirectory}`);

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const fileName = path.join(logDirectory, `${testName}-${timestamp}.txt`);

  return (message: string) => {
    fs.appendFileSync(fileName, message + "\n");
    console.log(message);
  };
};

export const ensureLoggedIn = async (
  page: Page,
  logToFile: Function = () => {},
) => {
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

export const typeValue = async (
  page: Page,
  locator: Locator,
  value: string,
  delay: number = 0,
) => {
  await locator.focus();
  // await locator.fill("");
  //await locator.pressSequentially(value, { delay });
  await page.keyboard.type(value, { delay });
};

export const fillAndEnter = async (
  page: Page,
  locator: Locator,
  value: string,
  delay: number = 0,
) => {
  await typeValue(page, locator, value, delay);
  await page.keyboard.press("Enter");
};

export const getTabText = async (
  page: Page,
  expectedIndex: number,
  logToFile: Function,
  isNeedLoadMoreResults: boolean = false,
) => {
  console.log("expected index ", expectedIndex);
  const tabLocator = page.locator(
    '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "Offerings:") or contains(text(), "No Results Found")]',
  );
  await expect(tabLocator.nth(expectedIndex)).toBeVisible({ timeout: 240000 });
  let text = await tabLocator.nth(expectedIndex).innerText();

  if (text.includes("Docs: 2,000+") && isNeedLoadMoreResults) {
    await page
      .locator('a:has-text("Load more results")')
      .last()
      .click({ force: true });

    text = await tabLocator.nth(expectedIndex).innerText();
  }

  return text;
};

export const parseCount = (text: string): number => {
  const digits = text.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export const parseCurrency = (value: string): number => {
  if (!value || value === "N/A") return 0;
  // Remove $, commas, and whitespace
  const clean = value.replace(/[$,\s]/g, "");
  const num = parseFloat(clean);

  if (clean.toLowerCase().includes("b")) return num * 1_000_000_000;
  if (clean.toLowerCase().includes("m")) return num * 1_000_000;
  return num;
};

type ConfigureOptions = {
  enableSnippets?: boolean;
  enableCrossReferenceLinks?: boolean;
  enableRedlinePastVersion?: boolean;
};

export const configureDisplayColumns = async (
  page: Page,
  selections: Record<string, string[]>,
  // enableSnippets: boolean = false,
  // enableCrossReferenceLinks: boolean = false,
  // enableRedlinePastVersion: boolean = false,
  options: ConfigureOptions = {},
) => {
  for (const [category, items] of Object.entries(selections)) {
    console.log(`Configuring category: ${category}`);

    const categoryTrigger = page
      .locator(".styles__popupContainer___36f60")
      .filter({ hasText: category })
      .locator("._checkbox__icon_1xotg_257");

    await categoryTrigger.click();

    const popupBody = page.locator(".PopupBody__popup__body___1J_d3");
    await popupBody.waitFor({ state: "visible" });

    const selectAllCheckbox = popupBody
      .locator("div")
      .filter({ hasText: new RegExp(`^${category}$`) })
      .locator("._checkbox__icon_1xotg_257");

    // await selectAllCheckbox.click();
    // // await page.waitForTimeout(300);
    // await selectAllCheckbox.click();
    const isMasterChecked = await selectAllCheckbox.evaluate((el) => {
      const nativeInput = el.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      return nativeInput ? nativeInput.checked : false;
    });

    if (isMasterChecked) {
      await selectAllCheckbox.click();
    } else {
      await selectAllCheckbox.click();
      await page.waitForTimeout(300);
      await selectAllCheckbox.click();
    }
    await page.waitForTimeout(300);

    for (const item of items) {
      console.log(`Selecting item: ${item}`);
      const itemCheckbox = popupBody
        .locator("div")
        .filter({ hasText: new RegExp(`^${item}$`) })
        .locator("._checkbox__icon_1xotg_257")
        .last();

      await itemCheckbox.scrollIntoViewIfNeeded();
      await itemCheckbox.click();
      await page.waitForTimeout(200);
    }
    await page.getByRole("button", { name: "Apply" }).click();
    await page.waitForTimeout(500);
  }

  const {
    enableSnippets = false,
    enableCrossReferenceLinks = false,
    enableRedlinePastVersion = false,
  } = options;

  if (enableSnippets) {
    const snippetsToggle = page
      .locator("._checkbox_1xotg_249")
      .filter({ hasText: "Snippets" })
      .locator("label")
      .first();
    await snippetsToggle.click();
  }
  if (enableCrossReferenceLinks) {
    const crossReferenceLinksToggle = page
      .locator("._checkbox_1xotg_249")
      .filter({ hasText: "Cross-Reference" })
      .locator("label")
      .first();
    await crossReferenceLinksToggle.click();
    await page
      .locator('a[href*="/SecuritiesRegulationAndCompliance?"]')
      .waitFor({ timeout: 15000 })
      .catch(() =>
        console.log("Toggle clicked but links didn't appear in results yet."),
      );
  }
  if (enableRedlinePastVersion) {
    const redlinePastVersionToggle = page
      .locator("._checkbox_1xotg_249")
      .filter({ hasText: "Redline Past Version" })
      .locator("label")
      .first();
    await redlinePastVersionToggle.click();
  }
};

export const navigateToSECFilings = async (page: Page) => {
  await page.locator("text=/SEC Filings/i").first().click();
};

export const navigateToAgreementsAndOtherExhibits = async (page: Page) => {
  await page.locator("text=/Agreements & Other Exhibits/i").first().click();
};
export const navigateToBoardProfilesAndCompensation = async (page: Page) => {
  await page.locator("text=/Board Profiles & Compensation/i").first().click();
};
export const navigateToSecuritiesRegulationAndCompliance = async (
  page: Page,
) => {
  await page
    .locator("text=/Securities Regulation & Compliance/i")
    .first()
    .click();
};

export const navigateToDisclosureBenchmarking = async (page: Page) => {
  await page.locator("text=/Disclosure Benchmarking/i").first().click();
};

export const navigateToNoActionLetters = async (page: Page) => {
  await page.locator("text=/No-Action Letters/i").first().click();
};

export const navigateToRegisteredOfferings = async (page: Page) => {
  await page.locator("text=/Registered Offerings/i").first().click();
};

export const navigateToSECEnforcement = async (page: Page) => {
  await page.locator("text=/SEC Enforcement/i").first().click();
};

export const navigateToSourceToTargetApp = async (
  page: Page,
  sourcePage: String,
  targetPage: String,
) => {
  await page.locator(`text=/${sourcePage}/i`).first().click({ force: true });
  const isChecked = await page.locator("input#sameWindow").isChecked();

  // 2. If it is checked, click the visible text label to cleanly turn it off
  if (isChecked) {
    await page.getByText("Open in a New Browser Tab").click();
    await page.waitForTimeout(200); // Small buffer for framework state to complete
  }
  await page.locator(`text=/${targetPage}/i`).first().click({ force: true });
};

export const getRandomIndices = (maxRange: number, count: number): number[] => {
  const arr = Array.from({ length: maxRange }, (_, i) => i);
  // Shuffle array and grab the first 'count' elements
  return arr.sort(() => 0.5 - Math.random()).slice(0, count);
};

export const closeAllOpenTabs = async (page: Page) => {
  const activeTab = page.locator(
    '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "No Results Found")]',
  );
  if ((await activeTab.count()) > 0) {
    try {
      await activeTab.first().click({ button: "right", timeout: 5000 });
      const closeAllBtn = page
        .locator(".react-contextmenu--visible")
        .getByRole("menuitem", { name: /Close all tabs/i });

      await closeAllBtn.click();
      await expect(activeTab).toHaveCount(0, { timeout: 15000 });
    } catch (cleanupError) {
      console.error("Error during cleanup (closing tabs):", cleanupError);
      await page.reload();
    }
  }
};

export const closeTabsToTheRight = async (page: Page) => {
  const activeTab = page.locator(
    '//span[contains(text(), "Docs:") or contains(text(), "No Results Found")]',
  );
  if ((await activeTab.count()) > 0) {
    try {
      await activeTab.first().click({ button: "right", timeout: 5000 });
      const closeTabsToTheRightBtn = page
        .locator(".react-contextmenu--visible")
        .getByRole("menuitem", { name: /Close tabs to the right/i });
      await page.waitForTimeout(1000);
      await closeTabsToTheRightBtn.click();
      await page.waitForTimeout(1000);
      await expect(activeTab).toHaveCount(1, { timeout: 15000 });
    } catch (cleanupError) {
      console.error("Error during cleanup (closing tabs):", cleanupError);
      await page.reload();
    }
  }
};
