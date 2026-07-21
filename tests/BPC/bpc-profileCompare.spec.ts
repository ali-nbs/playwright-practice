import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToBoardProfilesAndCompensation,
} from "../utils/helpers";
import { runBpcCompareTest } from "./bpc-profileCompare-logic";


test.describe("BPC-Profile Compare Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("BPC-Profile Compare", async ({ page }) => {
    const logToFile = setupLogger("BPC-Profile Compare", "BPC");
    await ensureLoggedIn(page, logToFile);
    await navigateToBoardProfilesAndCompensation(page);
    await runBpcCompareTest(page, logToFile);
  });
});
