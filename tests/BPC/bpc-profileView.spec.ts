import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToBoardProfilesAndCompensation,
} from "../utils/helpers";
import { runBpcProfileViewTest } from "./bpc-profileView-logic";

test.describe("BPC-Profile View Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("BPC-Profile View", async ({ page }) => {
    const logToFile = setupLogger("BPC-Profile View", "BPC");
    await ensureLoggedIn(page, logToFile);
    await navigateToBoardProfilesAndCompensation(page);
    await runBpcProfileViewTest(page, logToFile);
  });
});
