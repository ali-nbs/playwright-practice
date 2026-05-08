import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import { runFilingAgentTest } from "./sf-filingAgent-logic";

test.describe("SF-FilingAgent Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-FilingAgent", async ({ page }) => {
    const logToFile = setupLogger("sf-filingAgent", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await navigateToSECFilings(page);
    await runFilingAgentTest(page, logToFile);
  });
});
