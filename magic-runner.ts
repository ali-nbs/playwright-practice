import { chromium } from "playwright";
import { BasePage } from "./tests/pages/BasePage";
import { test } from "@playwright/test";
import { run6kFormTypeTest } from "./tests/SF/Daily-Test-Cases/sf-6kFormType-logic";
import { runAccountantTest } from "./tests/SF/Daily-Test-Cases/sf-accountant-logic";
import { runAuditorTest } from "./tests/SF/Daily-Test-Cases/sf-auditor-logic";
import { runBoilerPlateTest } from "./tests/SF/Daily-Test-Cases/sf-boilerPlate-logic";
import { runCrawlingTest } from "./tests/SF/Daily-Test-Cases/sf-crawling-logic";
import { runCrossReferenceLinksTest } from "./tests/SF/Daily-Test-Cases/sf-crossReferenceLinks-logic";
import { runFilingAgentTest } from "./tests/SF/Daily-Test-Cases/sf-filingAgent-logic";
import { runIndexingTest } from "./tests/SF/Daily-Test-Cases/sf-indexing-logic";
import { runIxbrlTest } from "./tests/SF/Daily-Test-Cases/sf-ixbrl-logic";
import { runXbrlParsingTest } from "./tests/SF/Daily-Test-Cases/sf-xbrlParsing-logic";
import { runPDEETest } from "./tests/SF/Daily-Test-Cases/sf-pdee-logic";
import { runDBMAnalyticsTest } from "./tests/DBM/dbm-analytics-logic";
import { runPastRedlineVersionTest } from "./tests/DBM/dbm-pastRedline-logic";
import { runAccountantMappingTest } from "./tests/AOE/aoe-accountantMapping-logic";
import { runDealPointsTest } from "./tests/AOE/aoe-dealpoints-logic";
import { runFiscalYearTest } from "./tests/SF/Daily-Test-Cases/sf-fiscalYear-logic";
import { runCompanyType_SPAC_REIT_BDC_FPI_INV_Test } from "./tests/SF/Daily-Test-Cases/sf-companyType-SPAC-REIT-BDC-FPI-INV-logic";
import { runMatrixTest } from "./tests/DBM/dbm-matrix-logic";
import { runSRCIndexingTest } from "./tests/SRC/src-indexing-logic";
import { runSRCCrawlingTest } from "./tests/SRC/src-crawling-logic";
import { runSRCDocViewTest } from "./tests/SRC/src-docView-logic";
import { runSRCOutlineTest } from "./tests/SRC/src-outline-logic";
import { runNalIndexingTest } from "./tests/NAL/nal-indexing-logic";
import { runRoIndexingTest } from "./tests/RO/ro-indexing-logic";
import { setupLogger } from "./tests/utils/helpers";
import { runSEIndexingTest } from "./tests/SE/se-indexing-logic";
import { runCompanyType_SRC_Shell_WKSI_EGC_Test } from "./tests/SF/Daily-Test-Cases/sf-companyType-SRC-Shell-WKSI-EGC-logic";
import { runBpcCrawlingTest } from "./tests/BPC/bpc-crawling-logic";

import { runBpcDisplayBarTest } from "./tests/BPC/bpc-displayBar-logic";

import { runBpcCompareTest } from "./tests/BPC/bpc-profileCompare-logic";
import { runAAIndexingAndDocViewTest } from "./tests/AA/aa-indexing-logic";
// import { runAccountingPoliciesAndDisclosureTest } from "./tests/AA/aa-accountingPoliciesAndDisclosure-logic";
import { runAAAccountingDisclosuresAndPoliciesTest } from "./tests/AA/claude-aa-accoutingDisclousureAndParties-logic";
import { runBpcProfileViewTest } from "./tests/BPC/bpc-profileView-logic";
import { runAAAuditOpinionsAndPoliciesTest } from "./tests/AA/claude-aa-auditOpinionsAndPolicies-logic";

// ---- Test cases ported from the peer repo ----
import { runBooleanHighlightTest } from "./tests/SF/Daily-Test-Cases/sf-booleanHighlight-logic";
import { runAccountingStandardTest } from "./tests/SF/Daily-Test-Cases/sf-accountingStandard-logic";
import { runAcceleratedStatusTest } from "./tests/SF/Daily-Test-Cases/sf-acceleratedStatus-logic";
import { runAccountantFeesTest } from "./tests/SF/Daily-Test-Cases/sf-accountantFees-logic";
import { runSnippetsTest } from "./tests/SF/Daily-Test-Cases/sf-snippets-logic";
import { runReleaseDateTest } from "./tests/SF/Daily-Test-Cases/sf-releaseDate-logic";
import { runOutlineTest } from "./tests/SF/Daily-Test-Cases/sf-outline-logic";
import {
  runAoeBooleanHighlightTest,
  runAoeConceptualHighlightTest,
} from "./tests/AOE/aoe-keywordHighlight-logic";
import { runAoeReleaseDateTest } from "./tests/AOE/aoe-releaseDate-logic";
import { runAoeClauseTest } from "./tests/AOE/aoe-clause-logic";
import {
  runDbmBooleanHighlightTest,
  runDbmConceptualHighlightTest,
} from "./tests/DBM/dbm-keywordHighlight-logic";
import { runSrcConceptualHighlightTest } from "./tests/SRC/src-conceptualHighlight-logic";
import { runSeBooleanHighlightTest } from "./tests/SE/se-booleanHighlight-logic";


async function devSandbox() {
  const CDP_URL = "http://localhost:9222";

  try {
    console.log(`🔍 Connecting to Chrome at ${CDP_URL}...`);

    const browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    const allPages = context.pages();
    console.log(`Found ${allPages.length} tabs.`);

    let page = allPages.find((p) => {
      const url = p.url();

      return url.startsWith("http") && !url.includes("chrome-extension");
    });

    if (!page) {
      page = allPages[allPages.length - 1];
    }

    console.log(`🚀 Connected to: ${await page.title()} (${page.url()})`);

    if (page.url().includes("about:blank")) {
      console.warn(
        "⚠️ Warning: You are on a blank page. Navigate to the app in Chrome first!",
      );
    }
    console.log("---------------------------------------------------");
    const logToFile = setupLogger("master-suite", "Daily-Test-Cases");

    const liveLog = (msg: string) => console.log(`[LIVE] ${msg}`);

    //await runMatrixTest(page, liveLog);
   // await new BasePage(page).navigateFromTo("SEC Filings" ,"Board Profiles & Compensation");
   // await runAAAccountingDisclosuresAndPoliciesTest(page, liveLog);
     //await runSRCDocViewTest(page, logToFile);
    // await runBpcDisplayBarTest(page, logToFile);
    // await runBpcProfileViewTest(page, logToFile);
   // await runBpcCompareTest(page, logToFile);
  //  await runAAIndexingAndDocViewTest(page, liveLog);
   // await runAAAccountingDisclosuresAndPoliciesTest(page, liveLog);
    // await runAAAuditOpinionsAndPoliciesTest(page, liveLog);

    // ---- Ported from the peer repo. Uncomment one to drive it. ----
    //
    // IMPORTANT: these flows start from an app that is ALREADY open - they
    // do not navigate themselves (the .spec.ts files call `goto()` for
    // that). So whatever tab this connects to must be showing the right
    // app first, otherwise the flow happily runs against the wrong one and
    // reports meaningless passes.
    //
    // Uncomment the matching navigation line for the app you need, using
    // whatever app is loaded in Chrome right now as the source:
    //
    // await new BasePage(page).navigateFromTo("SEC Filings", "Securities Regulation & Compliance");
    // await new BasePage(page).navigateFromTo("SEC Filings", "Agreements & Other Exhibits");
    // await new BasePage(page).navigateFromTo("SEC Filings", "Disclosure Benchmarking");
    // await new BasePage(page).navigateFromTo("SEC Filings", "SEC Enforcement");

    // SEC Filings
    // await runBooleanHighlightTest(page, liveLog);
    // await runAccountingStandardTest(page, liveLog);
    // await runAcceleratedStatusTest(page, liveLog);
    // await runAccountantFeesTest(page, liveLog);
    // await runSnippetsTest(page, liveLog);
    // await runReleaseDateTest(page, liveLog);
    // await runOutlineTest(page, liveLog);

    // Agreements & Other Exhibits
    // await runAoeBooleanHighlightTest(page, liveLog);
    // await runAoeConceptualHighlightTest(page, liveLog);
    // await runAoeReleaseDateTest(page, liveLog);
    // await runAoeClauseTest(page, liveLog);

    // Disclosure Benchmarking
    // await runDbmBooleanHighlightTest(page, liveLog);
    // await runDbmConceptualHighlightTest(page, liveLog);

    // Securities Regulation & Compliance
    await runSrcConceptualHighlightTest(page, liveLog);

    // SEC Enforcement
    // await runSeBooleanHighlightTest(page, liveLog);
   
   
    console.log("---------------------------------------------------");
    console.log("✅ Run Complete. Browser is still open for your next edit.");

    // Deliberately NOT closing the browser: this connects to YOUR already
    // running Chrome over CDP, and closing here would throw away the loaded
    // app that takes ~10 minutes to get back.
    // await browser.close();
  } catch (error) {
    console.error("❌ Execution Error:");
    console.error(error.message);
    console.log(
      "\nTIP: Make sure you launched Chrome with the --remote-debugging-port=9222 flag.",
    );
  }
}

devSandbox();
