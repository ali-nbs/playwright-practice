import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToBoardProfilesAndCompensation,
} from "../utils/helpers";
import { runBpcProfileViewTest } from "./bpc-profileView-logic";
import { runBpcCrawlingTest } from "./bpc-crawling-logic";
import { runBpcDisplayBarTest } from "./bpc-displayBar-logic";
import { runBpcCompareTest } from "./bpc-profileCompare-logic";

test.describe("BPC-master suite Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("BPC-Profile View", async ({ page }) => {
    const logToFile = setupLogger("BPC-master", "BPC");
    await ensureLoggedIn(page, logToFile);
    await navigateToBoardProfilesAndCompensation(page);
    await runBpcCrawlingTest(page, logToFile);
    await runBpcDisplayBarTest(page, logToFile);
    await runBpcProfileViewTest(page, logToFile);
    await runBpcCompareTest(page, logToFile);
  });
});
