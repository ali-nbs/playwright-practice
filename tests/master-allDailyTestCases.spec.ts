import { test } from "@playwright/test";
import { BasePage } from "./pages/BasePage";
import { SfPage } from "./pages/SfPage";
import * as fs from "fs";
import {
  AUTH_PATH,
  ensureLoggedIn,
  recoverFromAppCrash,
  setupLogger,
} from "./utils/helpers";
import {
  saveCheckpoint,
  getCheckpoint,
  clearCheckpoint,
} from "./utils/checkpoint";

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
import { runBpcCrawlingTest } from "./BPC/bpc-crawling-logic";
import { runBpcDisplayBarTest } from "./BPC/bpc-displayBar-logic";
import { runBpcCompareTest } from "./BPC/bpc-profileCompare-logic";
import { runBpcProfileViewTest } from "./BPC/bpc-profileView-logic";
import { runAAIndexingAndDocViewTest } from "./AA/aa-indexing-logic";
import { runAAAccountingDisclosuresAndPoliciesTest } from "./AA/claude-aa-accoutingDisclousureAndParties-logic";
import { runAAAuditOpinionsAndPoliciesTest } from "./AA/claude-aa-auditOpinionsAndPolicies-logic";

test.describe("Daily Test Cases - Master Suite", () => {
  if (fs.existsSync(AUTH_PATH)) {
    test.use({ storageState: AUTH_PATH });
  }

  test("Run All Daily Test Cases", async ({ page }) => {
    const logToFile = setupLogger("master-suite", "Daily-Test-Cases");

    await ensureLoggedIn(page, logToFile);

    const isFreshRun = process.env.FreshRun;
    const checkpointData = isFreshRun ? null : getCheckpoint();
    let checkpointPassed = checkpointData === null;
    let firstStepReached = false;
    const resumeApp = checkpointData?.lastApp ?? null;

    if (isFreshRun) {
      logToFile("Fresh run — ignoring checkpoint");
    } else if (checkpointData) {
      logToFile(
        `Resuming from: "${checkpointData.lastCompleted}" (App: ${checkpointData.lastApp})`
      );
    } else {
      logToFile("No checkpoint found — running full suite");
    }
  
    const executeStep = async (
      stepName: string,
      testFn: () => Promise<void>,
      appName: string
    ) => {
     
      if (!checkpointPassed) {
        logToFile(`⏭ [SKIPPED] ${stepName}`);
        if (checkpointData?.lastCompleted === stepName) {
          checkpointPassed = true;
        }
        return;
      }

      if (!firstStepReached) {
          firstStepReached = true;
          if (appName !== "SEC Filings") {
            logToFile(`🎯 Resuming suite: Jumping directly from SEC Filings to app: ${appName}`);
            await new BasePage(page).navigateFromTo("SEC Filings", appName);
          }
        }

      await test.step(stepName, async () => {
        try {
          logToFile(`\n[RUNNING] ${stepName}...`);
          await testFn();
          saveCheckpoint(stepName, appName);
          logToFile(`✅ [PASSED] ${stepName}`);
        } catch (error: any) {
          logToFile(`❌ [FAILED] ${stepName}: ${error.message}`);

          if (error?.kind === "crash") {
            await recoverFromAppCrash(page, logToFile);
          }
        }
      });
    };

    const safeTransition = async (currentApp: string, targetApp: string) => {
     
      if (!checkpointPassed) {
        logToFile(`⏭ [SKIPPED TRANSITION] ${currentApp} ➡️ ${targetApp}`);
        return;
      }

      const actualCurrentApp = !firstStepReached && resumeApp ? "SEC Filings" : currentApp;

      if (!firstStepReached) {
        firstStepReached = true;
      }

      try {
        logToFile(`\n🔄 Navigating: [${actualCurrentApp}] ➡️ [${targetApp}]`);
        await new BasePage(page).navigateFromTo(actualCurrentApp, targetApp);
      } catch (error: any) {
        logToFile(
          `⚠️ Navigation Failed from ${currentApp} to ${targetApp}: ${error.message}`
        );
      }
    };

    try {
      logToFile("Navigating to SEC Filings...");
      await new SfPage(page).goto();
    } catch (e: any) {
      logToFile(`Initial load failed: ${e.message}`);
    }

    // ── SEC Filings Suite ──────────────────────────────────────────────────
    await executeStep("SF Crawling",                      () => runCrawlingTest(page, logToFile),                        "SEC Filings");
    await executeStep("SF Indexing",                      () => runIndexingTest(page, logToFile),                        "SEC Filings");
    await executeStep("SF 6K-Form Type",                  () => run6kFormTypeTest(page, logToFile),                      "SEC Filings");
    await executeStep("SF Accountant",                    () => runAccountantTest(page, logToFile),                      "SEC Filings");
    await executeStep("SF Auditor",                       () => runAuditorTest(page, logToFile),                         "SEC Filings");
    await executeStep("SF Boiler Plate",                  () => runBoilerPlateTest(page, logToFile),                     "SEC Filings");
    await executeStep("SF Cross Reference Links",         () => runCrossReferenceLinksTest(page, logToFile),             "SEC Filings");
    await executeStep("SF Filing Agent",                  () => runFilingAgentTest(page, logToFile),                     "SEC Filings");
    await executeStep("SF IXBRL",                         () => runIxbrlTest(page, logToFile),                           "SEC Filings");
    await executeStep("SF XBRL Parsing",                  () => runXbrlParsingTest(page, logToFile),                     "SEC Filings");
    await executeStep("SF CompanyType SRC Shell WKSI EGC",() => runCompanyType_SRC_Shell_WKSI_EGC_Test(page, logToFile),"SEC Filings");
    await executeStep("SF CompanyType SPAC REIT BDC FPI INV", () => runCompanyType_SPAC_REIT_BDC_FPI_INV_Test(page, logToFile), "SEC Filings");
    await executeStep("SF PDEE",                          () => runPDEETest(page, logToFile),                            "SEC Filings");
    //await executeStep("SF Fiscal Year",                   () => runFiscalYearTest(page, logToFile),                      "SEC Filings");

    // ── SEC Enforcement Suite ──────────────────────────────────────────────
    await safeTransition("SEC Filings", "SEC Enforcement");
    await executeStep("SEC Enforcement Indexing",         () => runSEIndexingTest(page, logToFile),                      "SEC Enforcement");

    // ── No Action Letters Suite ────────────────────────────────────────────
    await safeTransition("SEC Enforcement", "No-Action Letters");
    await executeStep("No-Action Letters Indexing",       () => runNalIndexingTest(page, logToFile),                     "No-Action Letters");

    // ── Registered Offerings Suite ─────────────────────────────────────────
    await safeTransition("No-Action Letters", "Registered Offerings");
    await executeStep("Registered Offerings Indexing",    () => runRoIndexingTest(page, logToFile),                      "Registered Offerings");

    // ── SRC Suite ──────────────────────────────────────────────────────────
    await safeTransition("Registered Offerings", "Securities Regulation & Compliance");
    await executeStep("SRC Indexing",                     () => runSRCIndexingTest(page, logToFile),                     "Securities Regulation & Compliance");
    await executeStep("SRC Crawling",                     () => runSRCCrawlingTest(page, logToFile),                     "Securities Regulation & Compliance");
    await executeStep("SRC Doc View",                     () => runSRCDocViewTest(page, logToFile),                      "Securities Regulation & Compliance");
    //await executeStep("SRC Outline",                      () => runSRCOutlineTest(page, logToFile),                      "Securities Regulation & Compliance");

    // ── AOE Suite ──────────────────────────────────────────────────────────
    await safeTransition("Securities Reg. & Compliance", "Agreements & Other Exhibits");
    await executeStep("AOE Accountant Mapping",           () => runAccountantMappingTest(page, logToFile),               "Agreements & Other Exhibits");
    await executeStep("AOE Deal Points",                  () => runDealPointsTest(page, logToFile),                      "Agreements & Other Exhibits");

    // ── DBM Suite ──────────────────────────────────────────────────────────
    await safeTransition("Agreements & Other Exhibits", "Disclosure Benchmarking");
    await executeStep("DBM Analytics",                    () => runDBMAnalyticsTest(page, logToFile),                    "Disclosure Benchmarking");
    await executeStep("DBM Past Redline Version",         () => runPastRedlineVersionTest(page, logToFile),              "Disclosure Benchmarking");
    //await executeStep("DBM Matrix",                       () => runMatrixTest(page, logToFile),                          "Disclosure Benchmarking");

    // ── BPC Suite ──────────────────────────────────────────────────────────
    await safeTransition("Disclosure Benchmarking", "Board Profiles & Compensation");
    await executeStep("BPC Crawling",                    () => runBpcCrawlingTest(page, logToFile),                    "Board Profiles & Compensation");
    await executeStep("BPC DisplayBar",         () => runBpcDisplayBarTest(page, logToFile),              "Board Profiles & Compensation");
    await executeStep("BPC Profile View",         () => runBpcProfileViewTest(page, logToFile),              "Board Profiles & Compensation");
    await executeStep("BPC Profile Compare",         () => runBpcCompareTest(page, logToFile),              "Board Profiles & Compensation");

     // ── AA Suite ──────────────────────────────────────────────────────────
    await safeTransition("Board Profiles & Comp.", "Accounting Analytics");
    await executeStep("AA Indexing",                    () => runAAIndexingAndDocViewTest(page, logToFile),                    "Accounting Analytics");
    await executeStep("AA Disclosure and Policies",         () => runAAAccountingDisclosuresAndPoliciesTest(page, logToFile),              "Accounting Analytics");
    await executeStep("BPC Audit Opinions and Policies",         () => runAAAuditOpinionsAndPoliciesTest(page, logToFile),              "Accounting Analytics");
  

    // ── Done ───────────────────────────────────────────────────────────────
   // clearCheckpoint();
    logToFile("\n🏁 Finished Master Automation Suite execution chain.");
  });
});