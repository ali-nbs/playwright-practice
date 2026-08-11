import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../../utils/helpers";
import { runAccountingStandardTest } from "./sf-accountingStandard-logic";

test.describe("SF-Accounting Standard Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Accounting Standard Test", async ({ page }) => {
    const logToFile = setupLogger(
      "sf-accountingStandard",
      "SF/Daily-Test-Cases",
    );
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runAccountingStandardTest(page, logToFile);
  });
});
