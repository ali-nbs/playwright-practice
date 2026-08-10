import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { AUTH_PATH } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";
import {
  setupLogger,
  ensureLoggedIn,
} from "../../utils/helpers";
import { runBooleanKeywordsTest } from "./sf-booleanKeywords-logic";

test.describe("SF-Boolean Keywords Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Boolean Keywords", async ({ page }) => {
    const logToFile = setupLogger(
      "sf-booleanKeywords",
      "./SF/Assigned-Components-Test-Cases",
    );

    await ensureLoggedIn(page, logToFile);

    await new SfPage(page).goto();

    await runBooleanKeywordsTest(page, logToFile);
  });
});
