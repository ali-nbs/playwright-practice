import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { AUTH_PATH } from "../../utils/helpers";
import { SfPage } from "../../pages/SfPage";
import {
  setupLogger,
  ensureLoggedIn,
} from "../../utils/helpers";
import { runConceptualSearchTest } from "./sf-conceptualKeywords-logic";

test.describe("SF-Conceptual Keywords Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Conceptual Keywords", async ({ page }) => {
    const logToFile = setupLogger("sf-conceptualKeywords");

    await ensureLoggedIn(page, logToFile);

    await new SfPage(page).goto();

    await runConceptualSearchTest(page, logToFile);
  });
});
