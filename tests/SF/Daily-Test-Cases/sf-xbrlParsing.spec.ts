import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import { runXbrlParsingTest } from "./sf-xbrlParsing-logic";

test.describe("SF-XBRL Parsing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-XBRL Parsing", async ({ page }) => {
    const logToFile = setupLogger("sf-xbrlParsing", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await navigateToSECFilings(page);
    await runXbrlParsingTest(page, logToFile);
  });
});
