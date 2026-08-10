import { test } from "@playwright/test";
import { SrcPage } from "../pages/SrcPage";
import * as fs from "fs";

import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runSRCIndexingTest } from "./src-indexing-logic";

test.describe("SF-Indexing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Indexing", async ({ page }) => {
    const logToFile = setupLogger("sf-indexing", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SrcPage(page).goto();
    await runSRCIndexingTest(page, logToFile);
  });
});
