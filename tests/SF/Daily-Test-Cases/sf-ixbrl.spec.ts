import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../../utils/helpers";
import { runIxbrlTest } from "./sf-ixbrl-logic";

test.describe("SF-iXBRL Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-iXBRL", async ({ page }) => {
    const logToFile = setupLogger("sf-ixbrl", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runIxbrlTest(page, logToFile);
  });
});
