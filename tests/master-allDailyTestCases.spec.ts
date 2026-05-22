import { test } from "@playwright/test";
import * as fs from "fs";
import {
  AUTH_PATH,
  ensureLoggedIn,
  navigateToSECFilings,
  navigateToSourceToTargetApp,
  setupLogger,
} from "./utils/helpers";

import { runIndexingTest } from "./SF/Daily-Test-Cases/sf-indexing-logic";
import { run6kFormTypeTest } from "./SF/Daily-Test-Cases/sf-6kFormType-logic";
import { runAccountantTest } from "./SF/Daily-Test-Cases/sf-accountant-logic";
import { runAuditorTest } from "./SF/Daily-Test-Cases/sf-auditor-logic";
import { runBoilerPlateTest } from "./SF/Daily-Test-Cases/sf-boilerPlate-logic";
import { runCrawlingTest } from "./SF/Daily-Test-Cases/sf-crawling-logic";
import { runCrossReferenceLinksTest } from "./SF/Daily-Test-Cases/sf-crossReferenceLinks-logic";
import { runFilingAgentTest } from "./SF/Daily-Test-Cases/sf-filingAgent-logic";
import { runIxbrlTest } from "./SF/Daily-Test-Cases/sf-ixbrl-logic";
import { runPDEETest } from "./SF/Daily-Test-Cases/sf-pdee-logic";
import { runXbrlParsingTest } from "./SF/Daily-Test-Cases/sf-xbrlParsing-logic";
import { runCompanyType_SRC_Shell_WKSI_EGC_Test } from "./SF/Daily-Test-Cases/sf-companyType-SRC-Shell-WKSI-EGC-logic";
import { runCompanyType_SPAC_REIT_BDC_FPI_INV_Test } from "./SF/Daily-Test-Cases/sf-companyType-SPAC-REIT-BDC-FPI-INV-logic";
import { runFiscalYearTest } from "./SF/Daily-Test-Cases/sf-fiscalYear-logic";
import { runRoIndexingTest } from "./RO/ro-indexing-logic";
import { runSEIndexingTest } from "./SE/se-indexing-logic";
import { runNalIndexingTest } from "./NAL/nal-indexing-logic";
import { runSRCOutlineTest } from "./SRC/src-outline-logic";
import { runSRCDocViewTest } from "./SRC/src-docView-logic";
import { runSRCCrawlingTest } from "./SRC/src-crawling-logic";
import { runSRCIndexingTest } from "./SRC/src-indexing-logic";
import { runDealPointsTest } from "./AOE/aoe-dealpoints-logic";
import { runAccountantMappingTest } from "./AOE/aoe-accountantMapping-logic";
import { runDBMAnalyticsTest } from "./DBM/dbm-analytics-logic";
import { runMatrixTest } from "./DBM/dbm-matrix-logic";
import { runPastRedlineVersionTest } from "./DBM/dbm-pastRedline-logic";

test.describe("Daily Test Cases - Master Suite", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("Run All Daily Test Cases", async ({ page }) => {
    const logToFile = setupLogger("master-suite", "Daily-Test-Cases");

    await ensureLoggedIn(page, logToFile);

    const executeStep = async (
      stepName: string,
      testFn: () => Promise<void>,
    ) => {
      await test.step(stepName, async () => {
        try {
          logToFile(`\n[RUNNING] ${stepName}...`);
          await testFn();
          logToFile(`✅ [PASSED] ${stepName}`);
        } catch (error: any) {
          logToFile(`❌ [FAILED] ${stepName}: ${error.message}`);
        }
      });
    };

    const safeTransition = async (currentApp: string, targetApp: string) => {
      try {
        logToFile(`\n🔄 Navigating: [${currentApp}] ➡️ [${targetApp}]`);
        await navigateToSourceToTargetApp(page, currentApp, targetApp);
      } catch (error: any) {
        logToFile(
          `⚠️ Navigation Failed from ${currentApp} to ${targetApp}: ${error.message}`,
        );
      }
    };

    try {
      logToFile("🚀 Navigating to SEC Filings for the first and only time...");
      await navigateToSECFilings(page);
    } catch (e: any) {
      logToFile(`🚨 Initial load failed: ${e.message}`);
    }

    // --- SEC Filings App Suite ---
    await executeStep("SF Indexing", () => runIndexingTest(page, logToFile));
    await executeStep("SF 6K-Form Type", () =>
      run6kFormTypeTest(page, logToFile),
    );
    await executeStep("SF Accountant", () =>
      runAccountantTest(page, logToFile),
    );
    await executeStep("SF Auditor", () => runAuditorTest(page, logToFile));
    await executeStep("SF Boiler Plate", () =>
      runBoilerPlateTest(page, logToFile),
    );
    await executeStep("SF Crawling", () => runCrawlingTest(page, logToFile));
    await executeStep("SF Cross Reference Links", () =>
      runCrossReferenceLinksTest(page, logToFile),
    );
    await executeStep("SF Filing Agent", () =>
      runFilingAgentTest(page, logToFile),
    );
    await executeStep("SF IXBRL", () => runIxbrlTest(page, logToFile));
    await executeStep("SF PDEE", () => runPDEETest(page, logToFile));
    await executeStep("SF XBRL Parsing", () =>
      runXbrlParsingTest(page, logToFile),
    );
    await executeStep("SF CompanyType SRC Shell WKSI EGC", () =>
      runCompanyType_SRC_Shell_WKSI_EGC_Test(page, logToFile),
    );
    await executeStep("SF CompanyType SPAC REIT BDC FPI INV", () =>
      runCompanyType_SPAC_REIT_BDC_FPI_INV_Test(page, logToFile),
    );
    await executeStep("SF Fiscal Year", () =>
      runFiscalYearTest(page, logToFile),
    );

    // --- SEC Enforcement Suite ---
    await safeTransition("SEC Filings", "SEC Enforcement");
    await executeStep("SEC Enforcement Indexing", () =>
      runSEIndexingTest(page, logToFile),
    );

    // --- No Action Letters Suite ---
    await safeTransition("SEC Enforcement", "No-Action Letters");
    await executeStep("No-Action Letters Indexing", () =>
      runNalIndexingTest(page, logToFile),
    );

    // --- Registered Offerings Suite ---
    await safeTransition("No-Action Letters", "Registered Offerings");
    await executeStep("Registered Offerings Indexing", () =>
      runRoIndexingTest(page, logToFile),
    );

    // --- SRC Suite ---
    await safeTransition(
      "Registered Offerings",
      "Securities Regulation & Compliance",
    );
    await executeStep("SRC Indexing", () =>
      runSRCIndexingTest(page, logToFile),
    );
    await executeStep("SRC Crawling", () =>
      runSRCCrawlingTest(page, logToFile),
    );
    await executeStep("SRC Doc View", () => runSRCDocViewTest(page, logToFile));
    await executeStep("SRC Outline", () => runSRCOutlineTest(page, logToFile));

    // --- AOE Suite ---
    await safeTransition(
      "Securities Reg. & Compliance",
      "Agreements & Other Exhibits",
    );
    await executeStep("AOE Accountant Mapping", () =>
      runAccountantMappingTest(page, logToFile),
    );
    await executeStep("AOE Deal Points", () =>
      runDealPointsTest(page, logToFile),
    );

    // --- DBM Suite ---
    await safeTransition(
      "Agreements & Other Exhibits",
      "Disclosure Benchmarking",
    );
    await executeStep("DBM Analytics", () =>
      runDBMAnalyticsTest(page, logToFile),
    );
    await executeStep("DBM Past Redline Version", () =>
      runPastRedlineVersionTest(page, logToFile),
    );
    await executeStep("DBM Matrix", () => runMatrixTest(page, logToFile));

    logToFile("\n🏁 Finished Master Automation Suite execution chain.");
  });
});
