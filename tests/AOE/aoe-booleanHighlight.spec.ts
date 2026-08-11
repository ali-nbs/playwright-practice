import { test } from "@playwright/test";
import { AoePage } from "../pages/AoePage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runAoeBooleanHighlightTest } from "./aoe-keywordHighlight-logic";

test.describe("AOE-Boolean Highlight Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AOE-Boolean Highlight Test", async ({ page }) => {
    const logToFile = setupLogger("aoe-booleanHighlight", "AOE");
    await ensureLoggedIn(page, logToFile);
    await new AoePage(page).goto();
    await runAoeBooleanHighlightTest(page, logToFile);
  });
});
