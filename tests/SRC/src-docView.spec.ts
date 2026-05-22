import { test } from "@playwright/test";
import * as fs from "fs";

import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSecuritiesRegulationAndCompliance,
} from "../utils/helpers";
import { runSRCDocViewTest } from "./src-docView-logic";

test.describe("SF-Indexing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Indexing", async ({ page }) => {
    const logToFile = setupLogger("sf-indexing", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await navigateToSecuritiesRegulationAndCompliance(page);
    await runSRCDocViewTest(page, logToFile);
  });
});
