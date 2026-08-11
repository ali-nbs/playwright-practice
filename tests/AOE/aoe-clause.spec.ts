import { test } from "@playwright/test";
import { AoePage } from "../pages/AoePage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runAoeClauseTest } from "./aoe-clause-logic";

test.describe("AOE-Clause Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AOE-Clause Test", async ({ page }) => {
    const logToFile = setupLogger("aoe-clause", "AOE");
    await ensureLoggedIn(page, logToFile);
    await new AoePage(page).goto();
    await runAoeClauseTest(page, logToFile);
  });
});
