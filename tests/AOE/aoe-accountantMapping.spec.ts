import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToAgreementsAndOtherExhibits,
} from "../utils/helpers";
import { runAccountantMappingTest } from "./aoe-accountantMapping-logic";

test.describe("AOE-Accountant Mapping Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AOE-Accountant Mapping Test", async ({ page }) => {
    const logToFile = setupLogger("aoe-accountantMapping", "AOE");
    await ensureLoggedIn(page, logToFile);
    await navigateToAgreementsAndOtherExhibits(page);
    await runAccountantMappingTest(page, logToFile);
  });
});
