import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import { run6kFormTypeTest } from "./sf-6kFormType-logic";

test.describe("SF-6K Form Type Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-6K Subform Type", async ({ page }) => {
    const logToFile = setupLogger("sf-6kFormType", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await navigateToSECFilings(page);
    await run6kFormTypeTest(page, logToFile);
  });
});
