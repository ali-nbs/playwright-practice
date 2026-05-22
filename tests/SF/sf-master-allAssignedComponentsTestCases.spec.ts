import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  ensureLoggedIn,
  navigateToSECFilings,
  setupLogger,
} from "../utils/helpers";
import { runBooleanKeywordsTest } from "./Assigned-Components-Test-Cases/sf-booleanKeywords-logic";
import { runConceptualSearchTest } from "./Assigned-Components-Test-Cases/sf-conceptualKeywords-logic";

test.describe("SF Assigned Components - Master Suite", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("Run All Assigned Component Tests", async ({ page }) => {
    const logToFile = setupLogger("sf-master-suite");

    await ensureLoggedIn(page, logToFile);

    logToFile("🚀 Navigating to SEC Filings for the first and only time...");
    await navigateToSECFilings(page);

    await test.step("Module: Boolean Keywords", async () => {
      await runBooleanKeywordsTest(page, logToFile);
    });

    await test.step("Module: Conceptual Search", async () => {
      await runConceptualSearchTest(page, logToFile);
    });

    logToFile("\n✅ All assigned modules completed in a single session.");
  });
});
