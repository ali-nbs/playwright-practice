import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { AUTH_PATH } from "../../utils/sf-helpers";
import {
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/sf-helpers";
import { runConceptualSearchTest } from "./sf-conceptualKeywords-logic";

test.describe("SF-Conceptual Keywords Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Conceptual Keywords", async ({ page }) => {
    const logToFile = setupLogger("sf-conceptualKeywords");

    await ensureLoggedIn(page, logToFile);

    await navigateToSECFilings(page);

    await runConceptualSearchTest(page, logToFile);
  });
});
