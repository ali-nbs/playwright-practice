import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSecuritiesRegulationAndCompliance,
} from "../utils/helpers";
import { runSRCCrawlingTest } from "./src-crawling-logic";

test.describe("SF-Crawling Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Crawling", async ({ page }) => {
    const logToFile = setupLogger("sf-crawling", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await navigateToSecuritiesRegulationAndCompliance(page);
    await runSRCCrawlingTest(page, logToFile);
  });
});
