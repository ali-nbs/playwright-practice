import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../../utils/helpers";
import { runAcceleratedStatusTest } from "./sf-acceleratedStatus-logic";

test.describe("SF-Accelerated Status Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Accelerated Status Test", async ({ page }) => {
    const logToFile = setupLogger(
      "sf-acceleratedStatus",
      "SF/Daily-Test-Cases",
    );
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runAcceleratedStatusTest(page, logToFile);
  });
});
