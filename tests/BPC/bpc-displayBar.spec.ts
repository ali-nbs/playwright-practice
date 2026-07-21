import { test } from "@playwright/test";
import * as fs from "fs";

import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToBoardProfilesAndCompensation,
} from "../utils/helpers";
import { runBpcDisplayBarTest } from "./bpc-displayBar-logic";


test.describe("BPC-Crawler Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("BPC-Crawler", async ({ page }) => {
    const logToFile = setupLogger("BPC-Crawler", "BPC");
    await ensureLoggedIn(page, logToFile);
    await navigateToBoardProfilesAndCompensation(page);
    await runBpcDisplayBarTest(page, logToFile);
  });
});
