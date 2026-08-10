import { test } from "@playwright/test";
import { RoPage } from "../pages/RoPage";
import * as fs from "fs";

import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runRoIndexingTest } from "./ro-indexing-logic";

test.describe("RO-Indexing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("RO-Indexing", async ({ page }) => {
    const logToFile = setupLogger("ro-indexing", "RO");
    await ensureLoggedIn(page, logToFile);
    await new RoPage(page).goto();
    await runRoIndexingTest(page, logToFile);
  });
});
