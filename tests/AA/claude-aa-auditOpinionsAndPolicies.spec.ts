import { test } from "@playwright/test";
import { AaPage } from "../pages/AaPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runAAAuditOpinionsAndPoliciesTest } from "./claude-aa-auditOpinionsAndPolicies-logic";

test.describe("AA-AuditOpinionsAndPolicies Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AA-AuditOpinionsAndPolicies Test", async ({ page }) => {
    const logToFile = setupLogger("aa-auditOpinionsAndPolicies", "AA");
    await ensureLoggedIn(page, logToFile);
    await new AaPage(page).goto();
    await runAAAuditOpinionsAndPoliciesTest(page, logToFile);
  });
});
