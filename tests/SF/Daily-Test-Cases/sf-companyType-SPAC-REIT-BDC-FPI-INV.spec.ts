import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  setupLogger,
  ensureLoggedIn,
  navigateToSECFilings,
} from "../../utils/helpers";
import { runCompanyType_SPAC_REIT_BDC_FPI_INV_Test } from "./sf-companyType-SPAC-REIT-BDC-FPI-INV-logic";

test.describe("SF-CompanyType Extended Automation", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("SF Company Type: SPAC, REIT, BDC, FPI, INV Validation", async ({
    page,
  }) => {
    const logToFile = setupLogger(
      "sf-companyType-extended",
      "SF/Daily-Test-Cases",
    );

    await ensureLoggedIn(page, logToFile);
    await navigateToSECFilings(page);

    // Execute the grouped category logic
    await runCompanyType_SPAC_REIT_BDC_FPI_INV_Test(page, logToFile);
  });
});
