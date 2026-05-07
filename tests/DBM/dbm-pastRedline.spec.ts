import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToDisclosureBenchmarking,
} from "../utils/helpers";
import { runPastRedlineVersionTest } from "./dbm-pastRedline-logic";

test.describe("DBM - PastRedline Version Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("DBM - PastRedline Version Test", async ({ page }) => {
    const logToFile = setupLogger("dbm-pastRedline", "DBM");
    await ensureLoggedIn(page, logToFile);
    await navigateToDisclosureBenchmarking(page);
    await runPastRedlineVersionTest(page, logToFile);
  });
});
