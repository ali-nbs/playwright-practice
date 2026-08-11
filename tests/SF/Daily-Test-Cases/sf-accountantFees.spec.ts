import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../../utils/helpers";
import { runAccountantFeesTest } from "./sf-accountantFees-logic";

test.describe("SF-Accountant Fees Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Accountant Fees Test", async ({ page }) => {
    const logToFile = setupLogger("sf-accountantFees", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runAccountantFeesTest(page, logToFile);
  });
});
