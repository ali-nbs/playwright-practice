import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../../utils/helpers";
import { runAuditorTest } from "./sf-auditor-logic";

test.describe("SF-Auditor Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Auditor", async ({ page }) => {
    const logToFile = setupLogger("sf-auditor", "SF/Daily-Test-Cases");

    await ensureLoggedIn(page, logToFile);

    await new SfPage(page).goto();

    await runAuditorTest(page, logToFile);
  });
});
