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

async function devSandbox() {
  const CDP_URL = "http://localhost:9222";

  try {
    console.log(`🔍 Connecting to Chrome at ${CDP_URL}...`);

    // 2. Attach to your open "Work" Chrome
    const browser = await chromium.connectOverCDP(CDP_URL);
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    if (!page) {
      throw new Error(
        "No open tabs found! Open Chrome and navigate to your app first.",
      );
    }

    console.log(`🚀 Connected to: ${await page.title()}`);
    console.log("---------------------------------------------------");

    // 3. Create a "Live Logger" so you can see output in your terminal
    const liveLog = (msg: string) => console.log(`[LIVE] ${msg}`);

    // await run6kFormTypeTest(page, liveLog);
    await runDBMAnalyticsTest(page, liveLog);
    await runPastRedlineVersionTest(page, liveLog);
    // await runAccountantMappingTest(page, liveLog);
    // await runDealPointsTest(page, liveLog);

    console.log("---------------------------------------------------");
    console.log("✅ Run Complete. Browser is still open for your next edit.");

    // We disconnect so the script ends, but Chrome stays open
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
