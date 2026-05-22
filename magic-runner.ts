import { chromium } from "playwright";
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
import {
  navigateToRegisteredOfferings,
  navigateToSourceToTargetApp,
} from "./tests/utils/helpers";
import { runSEIndexingTest } from "./tests/SE/se-indexing-logic";

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

    const liveLog = (msg: string) => console.log(`[LIVE] ${msg}`);

    // await navigateToSourceToTargetApp(
    //   page,
    //   "SEC Enforcement",
    //   "Securities Regulation & Compliance",
    // );

    // await runSRCIndexingTest(page, liveLog);
    // await runSRCCrawlingTest(page, liveLog);
    // await runSRCDocViewTest(page, liveLog);
    // await runSRCOutlineTest(page, liveLog);

    //await runCrawlingTest(page, liveLog);

    // await navigateToSourceToTargetApp(
    //   page,
    //   "Securities Reg. & Compliance",
    //   "Registered Offerings",
    // );
    //await runRoIndexingTest(page, liveLog);

    // await run6kFormTypeTest(page, liveLog);
    // await runAccountantTest(page, liveLog);
    // await runFiscalYearTest(page, liveLog);
    await navigateToSourceToTargetApp(
      page,
      "Registered Offerings",
      "Agreements & Other Exhibits",
    );

    await runAccountantMappingTest(page, liveLog);
    await runDealPointsTest(page, liveLog);

    await navigateToSourceToTargetApp(
      page,
      "Agreements & Other Exhibits",
      "Disclosure Benchmarking",
    );

    await runDBMAnalyticsTest(page, liveLog);
    await runPastRedlineVersionTest(page, liveLog);
    await runMatrixTest(page, liveLog);

    console.log("---------------------------------------------------");
    console.log("✅ Run Complete. Browser is still open for your next edit.");

    await browser.close();
  } catch (error) {
    console.error("❌ Execution Error:");
    console.error(error.message);
    console.log(
      "\nTIP: Make sure you launched Chrome with the --remote-debugging-port=9222 flag.",
    );
  }
}

devSandbox();
