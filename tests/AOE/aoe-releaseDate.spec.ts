import { test } from "@playwright/test";
import { AoePage } from "../pages/AoePage";
import * as fs from "fs";
import { AUTH_PATH, setupLogger, ensureLoggedIn } from "../utils/helpers";
import { runAoeReleaseDateTest } from "./aoe-releaseDate-logic";

test.describe("AOE-Release Date Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AOE-Release Date Test", async ({ page }) => {
    const logToFile = setupLogger("aoe-releaseDate", "AOE");
    await ensureLoggedIn(page, logToFile);
    await new AoePage(page).goto();
    await runAoeReleaseDateTest(page, logToFile);
  });
});
