import { test } from "@playwright/test";
import * as fs from "fs";

import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToRegisteredOfferings,
} from "../utils/helpers";
import { runRoIndexingTest } from "./ro-indexing-logic";

test.describe("RO-Indexing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("RO-Indexing", async ({ page }) => {
    const logToFile = setupLogger("ro-indexing", "RO");
    await ensureLoggedIn(page, logToFile);
    await navigateToRegisteredOfferings(page);
    await runRoIndexingTest(page, logToFile);
  });
});
