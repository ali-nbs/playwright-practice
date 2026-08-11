import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../../utils/helpers";
import { runBooleanHighlightTest } from "./sf-booleanHighlight-logic";

test.describe("SF-Boolean Highlight Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Boolean Highlight Test", async ({ page }) => {
    const logToFile = setupLogger("sf-booleanHighlight", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runBooleanHighlightTest(page, logToFile);
  });
});
