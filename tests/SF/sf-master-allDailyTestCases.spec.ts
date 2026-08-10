import { test } from "@playwright/test";
import { SfPage } from "../pages/SfPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  ensureLoggedIn,
  setupLogger,
} from "../utils/helpers";
import { runIndexingTest } from "./Daily-Test-Cases/sf-indexing-logic";
import { run6kFormTypeTest } from "./Daily-Test-Cases/sf-6kFormType-logic";
import { runAccountantTest } from "./Daily-Test-Cases/sf-accountant-logic";
import { runAuditorTest } from "./Daily-Test-Cases/sf-auditor-logic";
import { runBoilerPlateTest } from "./Daily-Test-Cases/sf-boilerPlate-logic";
import { runCrawlingTest } from "./Daily-Test-Cases/sf-crawling-logic";
import { runCrossReferenceLinksTest } from "./Daily-Test-Cases/sf-crossReferenceLinks-logic";
import { runFilingAgentTest } from "./Daily-Test-Cases/sf-filingAgent-logic";
import { runIxbrlTest } from "./Daily-Test-Cases/sf-ixbrl-logic";
import { runPDEETest } from "./Daily-Test-Cases/sf-pdee-logic";
import { runFiscalYearTest } from "./Daily-Test-Cases/sf-fiscalYear-logic";
import { runXbrlParsingTest } from "./Daily-Test-Cases/sf-xbrlParsing-logic";
import { runCompanyType_SRC_Shell_WKSI_EGC_Test } from "./Daily-Test-Cases/sf-companyType-SRC-Shell-WKSI-EGC-logic";
import { runCompanyType_SPAC_REIT_BDC_FPI_INV_Test } from "./Daily-Test-Cases/sf-companyType-SPAC-REIT-BDC-FPI-INV-logic";

test.describe("SF Daily Test Cases - Master Suite", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("Run All Daily Test Cases", async ({ page }) => {
    const logToFile = setupLogger("sf-master-suite", "SF/Daily-Test-Cases");

    await ensureLoggedIn(page, logToFile);

    logToFile("🚀 Navigating to SEC Filings for the first and only time...");
    await new SfPage(page).goto();

    await test.step("Test Case: SF Indexing", async () => {
      await runIndexingTest(page, logToFile);
    });
    await test.step("Test Case: SF 6K-Form Type", async () => {
      await run6kFormTypeTest(page, logToFile);
    });
    await test.step("Test Case: SF Accountant", async () => {
      await runAccountantTest(page, logToFile);
    });
    await test.step("Test Case: SF Auditor", async () => {
      await runAuditorTest(page, logToFile);
    });
    await test.step("Test Case: SF Boiler Plate", async () => {
      await runBoilerPlateTest(page, logToFile);
    });
    await test.step("Test Case: SF Crawling", async () => {
      await runCrawlingTest(page, logToFile);
    });
    await test.step("Test Case: SF Cross Reference Links", async () => {
      await runCrossReferenceLinksTest(page, logToFile);
    });
    await test.step("Test Case: SF Filing Agent", async () => {
      await runFilingAgentTest(page, logToFile);
    });
    await test.step("Test Case: SF IXBRL", async () => {
      await runIxbrlTest(page, logToFile);
    });
    await test.step("Test Case: SF PDEE", async () => {
      await runPDEETest(page, logToFile);
    });
    await test.step("Test Case: SF XBRL PArsing", async () => {
      await runXbrlParsingTest(page, logToFile);
    });
    await test.step("Test Case: SF CompanyType SRC Shell WKSI EGC", async () => {
      await runCompanyType_SRC_Shell_WKSI_EGC_Test(page, logToFile);
    });
    await test.step("Test Case: SF CompanyType SPAC REIT BDC FPI INV", async () => {
      await runCompanyType_SPAC_REIT_BDC_FPI_INV_Test(page, logToFile);
    });

    await test.step("Test Case: SF Fiscal Year", async () => {
      await runFiscalYearTest(page, logToFile);
    });

    logToFile("\n✅ All SF Daily Test Cases completed in a single session.");
  });
});
