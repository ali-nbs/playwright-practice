import { test } from "@playwright/test";
import { SrcPage } from "../pages/SrcPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runSrcConceptualHighlightTest } from "./src-conceptualHighlight-logic";

test.describe("SRC-Conceptual Highlight Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SRC-Conceptual Highlight Test", async ({ page }) => {
    const logToFile = setupLogger("src-conceptualHighlight", "SRC");
    await ensureLoggedIn(page, logToFile);
    await new SrcPage(page).goto();
    await runSrcConceptualHighlightTest(page, logToFile);
  });
});
