import { test } from "@playwright/test";
import { SePage } from "../pages/SePage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runSeBooleanHighlightTest } from "./se-booleanHighlight-logic";

test.describe("SE-Boolean Highlight Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SE-Boolean Highlight Test", async ({ page }) => {
    const logToFile = setupLogger("se-booleanHighlight", "SE");
    await ensureLoggedIn(page, logToFile);
    await new SePage(page).goto();
    await runSeBooleanHighlightTest(page, logToFile);
  });
});
