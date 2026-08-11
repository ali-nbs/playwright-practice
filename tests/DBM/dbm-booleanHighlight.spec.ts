import { test } from "@playwright/test";
import { DbmPage } from "../pages/DbmPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runDbmBooleanHighlightTest } from "./dbm-keywordHighlight-logic";

test.describe("DBM-Boolean Highlight Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("DBM-Boolean Highlight Test", async ({ page }) => {
    const logToFile = setupLogger("dbm-booleanHighlight", "DBM");
    await ensureLoggedIn(page, logToFile);
    await new DbmPage(page).goto();
    await runDbmBooleanHighlightTest(page, logToFile);
  });
});
