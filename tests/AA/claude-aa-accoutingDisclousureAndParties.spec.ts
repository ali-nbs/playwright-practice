import { test } from "@playwright/test";
import { AaPage } from "../pages/AaPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runAAAccountingDisclosuresAndPoliciesTest } from "./claude-aa-accoutingDisclousureAndParties-logic";

test.describe("AA-AccountingDisclosuresAndPolicies Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AA-AccountingDisclosuresAndPolicies Test", async ({ page }) => {
    const logToFile = setupLogger("aa-accountingDisclosuresAndPolicies", "AA");
    await ensureLoggedIn(page, logToFile);
    await new AaPage(page).goto();
    await runAAAccountingDisclosuresAndPoliciesTest(page, logToFile);
  });
});
