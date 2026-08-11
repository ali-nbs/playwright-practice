import { test } from "@playwright/test";
import { SfPage } from "../../pages/SfPage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../../utils/helpers";
import { runReleaseDateTest } from "./sf-releaseDate-logic";

test.describe("SF-Release Date Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF-Release Date Test", async ({ page }) => {
    const logToFile = setupLogger("sf-releaseDate", "SF/Daily-Test-Cases");
    await ensureLoggedIn(page, logToFile);
    await new SfPage(page).goto();
    await runReleaseDateTest(page, logToFile);
  });
});
