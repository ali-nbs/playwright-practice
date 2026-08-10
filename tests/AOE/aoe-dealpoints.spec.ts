// Asset Purchase Agreement -- Purchase Price  -- Deal Size ($)
// Stock Purchase Agreement -- Purchase Price  -- Deal Size ($)
// Merger Agreementt -- Purchase Price  -- Deal Size ($)
// Credit/Loan Agreement -- Basic Loan Terms  -- Facility Size ($)
// Underwriting Agreement -- Lead Underwriter  -- BANC OF AMERICA SECURITIES LLC
// Employment Agreement -- Compensation and Benefits  -- Salary ($/yr

import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { AoePage } from "../pages/AoePage";
import { runDealPointsTest } from "./aoe-dealpoints-logic";

test.describe("AOE-Deal Points Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AOE-Deal Points Test", async ({ page }) => {
    const logToFile = setupLogger("aoe-dealpoints", "AOE");
    await ensureLoggedIn(page, logToFile);
    await new AoePage(page).goto();
    await runDealPointsTest(page, logToFile);
  });
});
