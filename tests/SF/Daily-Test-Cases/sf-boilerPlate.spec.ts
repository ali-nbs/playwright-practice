import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import { runBoilerPlateTest } from "./sf-boilerPlate-logic";

test.describe("SF-BoilerPlate Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-BoilerPlate", async ({ page }) => {
    const logToFile = setupLogger("sf-boilerPlate", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await navigateToSECFilings(page);
    await runBoilerPlateTest(page, logToFile);
  });
});
