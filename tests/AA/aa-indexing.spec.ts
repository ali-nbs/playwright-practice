import { test } from "@playwright/test";
import { AaPage } from "../pages/AaPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runAAIndexingAndDocViewTest } from "./aa-indexing-logic";

test.describe("AA-Indexing Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("AA-Indexing Test", async ({ page }) => {
    const logToFile = setupLogger("aa-indexing", "AA");
    await ensureLoggedIn(page, logToFile);
    await new AaPage(page).goto();
    await runAAIndexingAndDocViewTest(page, logToFile);
  });
});
