import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToDisclosureBenchmarking,
} from "../utils/helpers";
import { runDBMAnalyticsTest } from "./dbm-analytics-logic";

test.describe("DBM - Analytics Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("DBM - Analytics Test", async ({ page }) => {
    const logToFile = setupLogger("dbm-analytics", "DBM");
    await ensureLoggedIn(page, logToFile);
    await navigateToDisclosureBenchmarking(page);
    await runDBMAnalyticsTest(page, logToFile);
  });
});
