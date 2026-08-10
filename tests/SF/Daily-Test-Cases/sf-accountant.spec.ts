import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../../utils/helpers";
import { runAccountantTest } from "./sf-accountant-logic";

test.describe("SF-Accountant Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Accountant Test", async ({ page }) => {
    const logToFile = setupLogger("sf-accountant", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runAccountantTest(page, logToFile);
  });
});
