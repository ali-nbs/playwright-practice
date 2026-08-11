import { test } from "@playwright/test";
import { DbmPage } from "../pages/DbmPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runDbmConceptualHighlightTest } from "./dbm-keywordHighlight-logic";

test.describe("DBM-Conceptual Highlight Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("DBM-Conceptual Highlight Test", async ({ page }) => {
    const logToFile = setupLogger("dbm-conceptualHighlight", "DBM");
    await ensureLoggedIn(page, logToFile);
    await new DbmPage(page).goto();
    await runDbmConceptualHighlightTest(page, logToFile);
  });
});
