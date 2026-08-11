import { test } from "@playwright/test";
import { AoePage } from "../pages/AoePage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runAoeConceptualHighlightTest } from "./aoe-keywordHighlight-logic";

test.describe("AOE-Conceptual Highlight Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AOE-Conceptual Highlight Test", async ({ page }) => {
    const logToFile = setupLogger("aoe-conceptualHighlight", "AOE");
    await ensureLoggedIn(page, logToFile);
    await new AoePage(page).goto();
    await runAoeConceptualHighlightTest(page, logToFile);
  });
});
