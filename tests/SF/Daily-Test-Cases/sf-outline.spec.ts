import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../../utils/helpers";
import { runOutlineTest } from "./sf-outline-logic";

test.describe("SF-Outline Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Outline Test", async ({ page }) => {
    const logToFile = setupLogger("sf-outline", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runOutlineTest(page, logToFile);
  });
});
