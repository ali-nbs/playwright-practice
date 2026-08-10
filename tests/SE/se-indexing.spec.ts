import { test } from "@playwright/test";
import { SePage } from "../pages/SePage";
import * as fs from "fs";

import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runSEIndexingTest } from "./se-indexing-logic";

test.describe("SE-Indexing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SE-Indexing", async ({ page }) => {
    const logToFile = setupLogger("se-indexing", "SE");
    await ensureLoggedIn(page, logToFile);
    await new SePage(page).goto();
    await runSEIndexingTest(page, logToFile);
  });
});
