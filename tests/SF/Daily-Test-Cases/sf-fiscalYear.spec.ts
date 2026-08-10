import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../../utils/helpers";
import { runFiscalYearTest } from "./sf-fiscalYear-logic";

test.describe("SF-fiscalYear Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-fiscalYear validation", async ({ page }) => {
    const logToFile = setupLogger("sf-fiscalYear", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runFiscalYearTest(page, logToFile);
  });
});
