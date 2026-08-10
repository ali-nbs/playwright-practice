import { test } from "@playwright/test";
import { SrcPage } from "../pages/SrcPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";

import { runSRCOutlineTest } from "./src-outline-logic";

test.describe("SF-Outline Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Outline", async ({ page }) => {
    const logToFile = setupLogger("src-outline", "SRC");
    await ensureLoggedIn(page, logToFile);
    await new SrcPage(page).goto();
    await runSRCOutlineTest(page, logToFile);
  });
});
