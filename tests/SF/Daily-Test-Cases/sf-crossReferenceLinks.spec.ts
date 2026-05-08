import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import { runCrossReferenceLinksTest } from "./sf-crossReferenceLinks-logic";

test.describe("SF-Cross Reference Links Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Cross Reference Links Test", async ({ page }) => {
    const logToFile = setupLogger(
      "sf-crossReferenceLinks",
      "SF/Daily-Test-Cases",
    );
    await ensureLoggedIn(page, logToFile);
    await navigateToSECFilings(page);
    await runCrossReferenceLinksTest(page, logToFile);
  });
});
