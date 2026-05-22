import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import { runCompanyType_SRC_Shell_WKSI_EGC_Test } from "./sf-companyType-SRC-Shell-WKSI-EGC-logic";

test.describe("SF-CompanyType Automation - Isolated Mode", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF Company Type: SRC, Shell, WKSI, EGC Validation", async ({
    page,
  }) => {
    const logToFile = setupLogger(
      "sf-companyType-SRC-Shell-WKSI-EGC",
      "SF/Daily-Test-Cases",
    );
    await ensureLoggedIn(page, logToFile);
    await navigateToSECFilings(page);
    await runCompanyType_SRC_Shell_WKSI_EGC_Test(page, logToFile);
  });
});
