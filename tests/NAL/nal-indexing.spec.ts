import { test } from "@playwright/test";
import { NalPage } from "../pages/NalPage";
import * as fs from "fs";

import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runNalIndexingTest } from "./nal-indexing-logic";

test.describe("NAL-Indexing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("NAL-Indexing", async ({ page }) => {
    const logToFile = setupLogger("nal-indexing", "NAL");
    await ensureLoggedIn(page, logToFile);
    await new NalPage(page).goto();
    await runNalIndexingTest(page, logToFile);
  });
});
