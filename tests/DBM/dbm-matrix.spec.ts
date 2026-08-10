import { test } from "@playwright/test";
import { DbmPage } from "../pages/DbmPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
} from "../utils/helpers";
import { runMatrixTest } from "./dbm-matrix-logic";

test.describe("DBM - Matrix Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("DBM - Matrixn Test", async ({ page }) => {
    const logToFile = setupLogger("dbm-matrix", "DBM");
    await ensureLoggedIn(page, logToFile);
    await new DbmPage(page).goto();
    await runMatrixTest(page, logToFile);
  });
});
