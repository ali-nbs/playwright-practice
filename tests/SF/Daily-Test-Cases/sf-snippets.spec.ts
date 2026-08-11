import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../../utils/helpers";
import { runSnippetsTest } from "./sf-snippets-logic";

test.describe("SF-Snippets Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Snippets Test", async ({ page }) => {
    const logToFile = setupLogger("sf-snippets", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runSnippetsTest(page, logToFile);
  });
});
