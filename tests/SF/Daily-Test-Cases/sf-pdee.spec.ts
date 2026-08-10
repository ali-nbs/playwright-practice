import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../../utils/helpers";
import { runPDEETest } from "./sf-pdee-logic";

test.describe("SF-PDEE Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-PDEE: Downloads and Random Row Validation", async ({ page }) => {
    const logToFile = setupLogger("sf-pdee", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runPDEETest(page, logToFile);
  });
});
