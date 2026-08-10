import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { updateGoogleSheet } from "./dumpDataOnGoogleSheet";
import { BasePage, ConfigureOptions } from "../pages/BasePage";

export const AUTH_PATH = path.resolve(__dirname, "..", "state", "auth.json");

// Strips ANSI escape/color codes (e.g. the `\x1B[2m`/`\x1B[22m` sequences
// Playwright wraps its own assertion error messages in) before anything
// is written to a log file or Google Sheets. Without this, a failure like
// `expect(locator).toBeVisible()` shows up in the saved log/report as an
// unreadable string of raw escape bytes (`␛[2mexpect(␛[22m...`) instead of
// plain text, which is what made past failure logs impossible to read.
// Terminal output (console.log) keeps the color codes since a real
// terminal renders them fine there.
const ANSI_PATTERN = /\x1B\[[0-9;]*[a-zA-Z]/g; // eslint-disable-line no-control-regex
export const stripAnsi = (text: string): string => text.replace(ANSI_PATTERN, "");

// Reduces a caught Playwright/JS error to one clean, ANSI-free line
// suitable for a failure log entry. Playwright assertion errors are
// multi-line (message + a "Call log:" trace) and color-coded; callers
// that just need "what failed, briefly" for a summary line should use
// this instead of raw `e.message.split("\n")[0]`, which still contains
// escape codes.
export const cleanErrorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = stripAnsi(raw).split("\n")[0].trim();
  return firstLine || "Unknown error (no message)";
};

// Structured per-row result entry used by the AA "process N rows and
// report" scripts (indexing, accounting disclosures, audit opinions,
// ...). Centralizing this format means every one of those scripts
// produces a log/report block that is easy to scan and easy to trace
// back to a specific document -- instead of each script hand-rolling
// its own ad hoc string with a raw, possibly ANSI-coded error appended.
export type RowFinding = {
  passed: boolean;
  label: string; // e.g. "Row 2 (Intelligize ID: 23653931)"
  details: string[]; // one line per sub-check, already prefixed with an emoji
  error?: unknown; // set only when the row threw before sub-checks could run
};

export const formatRowFinding = (finding: RowFinding): string => {
  const status = finding.passed ? "✅" : "❌";
  const lines = [`${status} ${finding.label}`];
  if (finding.error !== undefined) {
    lines.push(`   -> ERROR: ${cleanErrorMessage(finding.error)}`);
  }
  for (const detail of finding.details) {
    lines.push(`   ${detail}`);
  }
  return lines.join("\n");
};

// Builds the full "N docs verified, here is every failing one with full
// context" block for one filter/scenario label. Always includes the
// scenario header and totals even when everything passed, so a reader
// scanning the log/sheet can tell "0 failures reported" apart from "this
// scenario never ran". Only FAILED rows are listed in detail -- passed
// rows are summarized as a count -- so a long run with mostly-passing
// rows doesn't bury the handful that actually need investigation.
export const formatScenarioReport = (
  scenarioLabel: string,
  totalFound: number ,
  findings: RowFinding[],
): { text: string; isValid: boolean } => {
  const failed = findings.filter((f) => !f.passed);
  const passedCount = findings.length - failed.length;
  const isValid = failed.length === 0;

  const lines = [
    `Scenario: ${scenarioLabel}`,
    `Total Found: ${totalFound}`,
    `Docs Verified: ${findings.length} (${passedCount} passed, ${failed.length} failed)`,
    "",
  ];

  if (findings.length === 0) {
    lines.push("ℹ️ No results to verify for this scenario.");
  } else if (failed.length === 0) {
    lines.push(`✅ All ${passedCount} verified row(s) passed.`);
  } else {
    lines.push(...failed.map(formatRowFinding));
  }

  lines.push("", `Scenario Result: ${isValid ? "Valid ✅" : "Invalid ❌"}`);

  return { text: lines.join("\n"), isValid };
};
export const setupLogger = (
  testName: string,
  logPath: string = "SF/Assigned-Components-Test-Cases",
) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 16)
    .replace("T", "_");
  const logDirectory = path.join(
    process.cwd(),
    "tests",
    logPath,
    "Results",
    testName,
  );
  console.log(`Logs will be saved to: ${logDirectory}`);

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }

  const fileName = path.join(logDirectory, `${testName}-${timestamp}.txt`);

  return (message: string) => {
    // Always write ANSI-free text to the log FILE (that's what gets read
    // later / pasted into Google Sheets); keep the original, color-coded
    // message on the live console for readability while the run is
    // actively being watched in a terminal.
    fs.appendFileSync(fileName, stripAnsi(message) + "\n");
    console.log(message);
  };
};

// Purely diagnostic — logs every real API call (fetch/xhr) this page makes:
// timestamp, method, URL, and either its response status (+ a body snippet
// on error) or the exact network-level failure reason if it never got a
// response at all (net::ERR_*, the real cause hiding behind "Failed to
// fetch"). Also logs console errors and uncaught page errors, trimmed to a
// few lines for readability. Everything is written line-by-line to the same
// log file via logToFile, so it's already on disk and survives past a
// crash/navigation that would otherwise wipe DevTools' Network/Console tabs.
export const attachDiagnostics = (
  page: Page,
  logToFile: Function = () => {},
) => {
  const timestamp = () =>
    new Date().toISOString().split("T")[1].replace("Z", "");

  const isApiCall = (request: { resourceType: () => string }) =>
    request.resourceType() === "fetch" || request.resourceType() === "xhr";

  page.on("response", async (response) => {
    const request = response.request();
    if (!isApiCall(request)) return;

    const status = response.status();
    const marker = status >= 400 ? "✖" : "✓";
    let line = `[${timestamp()}] ${marker} ${status} ${request.method()} ${response.url()}`;

    if (status >= 400) {
      const body = await response.text().catch(() => "");
      if (body) line += `\n    ↳ response: ${body.slice(0, 500)}`;
    }

    logToFile(line);
  });

  page.on("requestfailed", (request) => {
    if (!isApiCall(request)) return;
    const failure = request.failure();
    logToFile(
      `[${timestamp()}] ✖ NETWORK ERROR ${request.method()} ${request.url()} — ${failure?.errorText ?? "unknown"}`,
    );
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      logToFile(`[${timestamp()}] 🔴 console error: ${msg.text().split("\n")[0]}`);
    }
  });

  page.on("pageerror", (error) => {
    const firstStackLines = (error.stack ?? "")
      .split("\n")
      .slice(0, 3)
      .join("\n    ");
    logToFile(
      `[${timestamp()}] 🔴 uncaught page error: ${error.message}\n    ${firstStackLines}`,
    );
  });
};

export const ensureLoggedIn = async (
  page: Page,
  logToFile: Function = () => {},
) => {
  //attachDiagnostics(page, logToFile);
  await page.goto("/");

  const userIdInput = page.locator("#userid");

  if (await userIdInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    logToFile("Session expired or not found. Performing manual login...");

    await userIdInput.fill(process.env.APP_USERNAME!);
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator("#password").fill(process.env.APP_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(/.*apps.intelligize.com/, {
      waitUntil: "networkidle",
    });
    await page.context().storageState({ path: AUTH_PATH });
    logToFile("Login successful. auth.json updated.");
  } else {
    logToFile("Active session detected via auth.json. Skipping login.");
  }
};

// These now delegate to BasePage so there is ONE implementation. The
// signatures are unchanged so existing (page, locator, value) call sites keep
// working while flows are migrated to `app.fillAndEnter(locator, value)`.
export const typeValue = async (
  page: Page,
  locator: Locator,
  value: string,
  delay: number = 0,
) => {
  await new BasePage(page).typeValue(locator, value, delay);
};

export const fillAndEnter = async (
  page: Page,
  locator: Locator,
  value: string,
  delay: number = 0,
) => {
  await new BasePage(page).fillAndEnter(locator, value, delay);
};

// getTabText throws a plain Error tagged with `.kind` when the result grid
// shows an error state instead of a count, or when the app's crash screen
// ("Oops! Something went wrong.") appears instead of the app entirely.
// Callers check `error.kind` ("error" | "crash") to decide whether to skip
// to the next scenario or recover + abort.
const throwGridStateError = (kind: "error" | "crash", message: string) => {
  const err: any = new Error(message);
  err.kind = kind;
  throw err;
};

// The app's generic React crash boundary: a centered "Oops! / Something
// went wrong. / Go Back" block replacing the entire UI. Confirmed live via
// screenshot (apps.intelligize.com/BoardProfilesAndCompensation).
export const getCrashScreenLocator = (page: Page) =>
  page.getByText("Oops!", { exact: false }).first();

export const recoverFromAppCrash = async (
  page: Page,
  logToFile: Function = () => {},
) => {
  logToFile("💥 App crash screen detected — attempting recovery...");
  const goBackBtn = page.getByRole("button", { name: /^Go Back$/i });

  try {
    if (await goBackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await goBackBtn.click();
    } else {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  } catch {
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  }

  await page.waitForTimeout(2000);
  logToFile("Recovery attempt complete.");
};

export const getTabText = async (
  page: Page,
  expectedIndex: number,
  logToFile: Function,
  isNeedLoadMoreResults: boolean = false,
) =>
  new BasePage(page).getTabText(expectedIndex, logToFile, isNeedLoadMoreResults);

export const parseCount = (text: string): number => {
  const digits = text.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export const parseCurrency = (value: string): number => {
  if (!value || value === "N/A") return 0;
  // Remove $, commas, and whitespace
  const clean = value.replace(/[$,\s]/g, "");
  const num = parseFloat(clean);

  if (clean.toLowerCase().includes("b")) return num * 1_000_000_000;
  if (clean.toLowerCase().includes("m")) return num * 1_000_000;
  return num;
};

export const configureDisplayColumns = async (
  page: Page,
  selections: Record<string, string[]>,
  options: ConfigureOptions = {},
) => new BasePage(page).configureDisplayColumns(selections, options);

// ---------------------------------------------------------------------
// Doc View "document is loaded" wait.
// ---------------------------------------------------------------------
//
// LIVE-CONFIRMED (2026-08-09, headed chromium run against Securities
// Regulation & Compliance, "Laws & Regs: Select All", 9 docs, one probe
// dumping every DocViewContainer's computed state after each View click):
//
//   after View on row 0: 1 container, tabindex="0",  textLen 344,766
//   after View on row 1: 2 containers, tabindex="-1" + "0"
//   after View on row 2: 3 containers, tabindex="-1","-1","0"
//   after View on row 3: 3 containers, ALL tabindex="-1"
//
// Two facts fall out of that dump, and together they are the actual root
// cause of "later docs are slow / time out after 30s even though the
// document itself loads in a few seconds":
//
//  1. The app NEVER unmounts a previously opened document. Every "View"
//     click mounts an ADDITIONAL `div#DocViewContainer` (duplicate id!)
//     inside `DocumentViewer__Viewers___1usbl`, and every one of them
//     stays `display:flex` / `visibility:visible` / non-zero box forever.
//     So `page.locator('div[id="DocViewContainer"]')` matches a GROWING
//     list, and old, stale documents are still "visible" to Playwright.
//
//  2. `tabindex` is a FOCUS marker, not a load marker. Exactly one
//     container carries `tabindex="0"` (the focused one) and the rest are
//     `tabindex="-1"` — and after focus moves elsewhere (clicking the
//     "Docs: N" results tab, pressing a key, or the app restoring focus to
//     the grid) EVERY container can sit at `tabindex="-1"`.
//
// The old assertion was `div[id="DocViewContainer"][tabindex="0"]`, i.e.
// it waited for the document to be FOCUSED rather than for it to be
// LOADED. For the first row focus happens to land on the viewer, so it
// passed in ~6s. For later rows focus stays on the results grid, so the
// selector matched nothing and the assertion burned its full 30s budget
// and then reported "Doc View Content not Loaded" — even though the
// document had rendered within a few seconds. That is why the failure
// looked like "it got slower and slower for later docs" and why the 30s
// timeout appeared to be exceeded by a document that clearly loaded.
//
// The `.or(...)` fallback branch could never rescue it either: the probe
// shows `hasPdfPage:false` and 0 `div.pdfViewer > div[data-page-number]`
// nodes for every document in this app, so that branch is dead code here.
//
// The fix waits for the real, focus-independent signal: a NEW container is
// mounted (count grows past the pre-click baseline) and that newest
// container is visible and has actually rendered text content.
export const DOC_VIEW_CONTAINER_SELECTOR = 'div[id="DocViewContainer"]';

export const countDocViewContainers = (page: Page) =>
  page.locator(DOC_VIEW_CONTAINER_SELECTOR).count();

// Minimum rendered characters before a viewer counts as "loaded". Real
// documents in this app render hundreds of thousands of characters
// (149,726 / 344,766 / 1,655,364 in the probe); an empty/skeleton viewer
// renders almost nothing.
const DOC_VIEW_MIN_TEXT_LENGTH = 200;

export const waitForDocViewLoaded = async (
  page: Page,
  containersBeforeClick: number,
  timeout: number = 30000,
) => {
  const containers = page.locator(DOC_VIEW_CONTAINER_SELECTOR);
  const deadline = Date.now() + timeout;

  // Phase 1: a new viewer must be mounted for the document just clicked.
  // Falls through to phase 2 if the app reuses an existing viewer instead
  // of mounting a new one (e.g. re-opening an already-open document).
  while (Date.now() < deadline) {
    if ((await containers.count()) > containersBeforeClick) break;
    await page.waitForTimeout(200);
  }

  // Phase 2: the NEWEST viewer must be visible and have rendered content.
  // `.last()` is the document just opened, since the app appends.
  const newest = containers.last();
  const remaining = Math.max(deadline - Date.now(), 1000);

  await expect(newest).toBeVisible({ timeout: remaining });

  await expect(async () => {
    const textLength = await newest.evaluate(
      (el) => (el.textContent || "").trim().length,
    );
    expect(textLength).toBeGreaterThan(DOC_VIEW_MIN_TEXT_LENGTH);
  }).toPass({ timeout: Math.max(deadline - Date.now(), 1000) });
};

export const navigateToSECFilings = async (page: Page) => {
  await page.locator("text=/SEC Filings/i").first().click();
};

export const navigateToAgreementsAndOtherExhibits = async (page: Page) => {
  await page.locator("text=/Agreements & Other Exhibits/i").first().click();
};
export const navigateToBoardProfilesAndCompensation = async (page: Page) => {
  await page.locator("text=/Board Profiles & Compensation/i").first().click();
};
export const navigateToSecuritiesRegulationAndCompliance = async (
  page: Page,
) => {
  await page
    .locator("text=/Securities Regulation & Compliance/i")
    .first()
    .click();
};

export const navigateToDisclosureBenchmarking = async (page: Page) => {
  await page.locator("text=/Disclosure Benchmarking/i").first().click();
};

export const navigateToNoActionLetters = async (page: Page) => {
  await page.locator("text=/No-Action Letters/i").first().click();
};

export const navigateToAccountingAnalytics = async (page: Page) => {
  await page.locator("text=/Accounting Analytics/i").first().click();
};

export const navigateToRegisteredOfferings = async (page: Page) => {
  await page.locator("text=/Registered Offerings/i").first().click();
};

export const navigateToSECEnforcement = async (page: Page) => {
  await page.locator("text=/SEC Enforcement/i").first().click();
};

export const navigateToSourceToTargetApp = async (
  page: Page,
  sourcePage: String,
  targetPage: String,
) => {
  await page.locator(`text=/${sourcePage}/i`).first().click({ force: true });
  const isChecked = await page.locator("input#sameWindow").isChecked();

  // 2. If it is checked, click the visible text label to cleanly turn it off
  if (isChecked) {
    await page.getByText("Open in a New Browser Tab").click();
    await page.waitForTimeout(200); // Small buffer for framework state to complete
  }
  await page.locator(`text=/${targetPage}/i`).first().click({ force: true });
};

export const getRandomIndices = (maxRange: number, count: number): number[] => {
  const arr = Array.from({ length: maxRange }, (_, i) => i);
  // Shuffle array and grab the first 'count' elements
  return arr.sort(() => 0.5 - Math.random()).slice(0, count);
};

export const closeAllOpenTabs = async (page: Page) =>
  new BasePage(page).closeAllOpenTabs();



export const closeTabsToTheRight = async (page: Page) =>
  new BasePage(page).closeTabsToTheRight();

export function getTargetDateString(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  let daysToSubtract = 1;

  if (dayOfWeek === 1) {
    // Today is Monday -> look back 3 days to Friday
    daysToSubtract = 3;
  } 

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() - daysToSubtract);

  const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
  const dd = String(targetDate.getDate()).padStart(2, "0");
  const yyyy = targetDate.getFullYear();

  return `${mm}/${dd}/${yyyy}`;
}

// ---------------------------------------------------------------------
// Result-grid row lookup that is safe when "Exhibits to Filings" is ON.
// ---------------------------------------------------------------------
//
// LIVE-CONFIRMED (2026-08-06, via playwright-cli headed session against
// Accounting Analytics with Exhibits to Filings checked): the app renders
// each filing followed by its own exhibit sub-rows (EX-31.1, EX-31.2,
// EX-32.1, EX-101, ...) as SEPARATE `div[data-test="resultRow"]` elements
// interleaved in the same virtualized grid. Exhibit sub-rows reuse the
// SAME small `id` sequence (0, 1, 2, 3...) independently per filing --
// they are not globally unique -- so selecting a row by
// `[data-test="resultRow"][id="N"]` can match an exhibit sub-row instead
// of the Nth real filing. Exhibit sub-rows have no "View" button, so the
// resulting failure is a generic, unhelpful `expect(locator).toBeVisible()`
// timeout on the View button with no indication that the wrong row was
// ever selected. This was the actual root cause behind AA row-verification
// scripts reporting "Row 2/Row 3 failed" while Row 1 always passed --
// Row 1 legitimately is the first `resultRow`, but Row 2/3 by `id` landed
// on that same filing's own exhibit rows.
//
// Fix: identify real filing rows by the presence of a "View" button
// (`getByRole("button", { name: /View/i })`), not by raw `id`. This is
// correct whether or not "Exhibits to Filings" is checked, so callers no
// longer need to remember to uncheck that filter as a workaround.
export const findResultRowByIndex = async (
  page: Page,
  targetIndex: number, // 1-based: 1 = first real filing row, 2 = second, ...
  logToFile: Function = () => {},
): Promise<Locator | null> => {
  const scroller = page.locator(".ReactVirtualized__Grid:visible").last();
  const MAX_STAGNANT_SCROLLS = 12;
  let stagnantScrolls = 0;
  let lastSeenRowCount = -1;

  const isFilingRow = async (row: Locator): Promise<boolean> =>
    (await row.getByRole("button", { name: /View/i }).count()) > 0;

  while (stagnantScrolls <= MAX_STAGNANT_SCROLLS) {
    const rows = scroller.locator('div[data-test="resultRow"]');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      let filingRowsSeen = 0;
      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        if (!(await isFilingRow(row))) continue; // skip exhibit sub-rows
        filingRowsSeen++;
        if (filingRowsSeen === targetIndex) {
          return row;
        }
      }
    }

    stagnantScrolls = rowCount === lastSeenRowCount ? stagnantScrolls + 1 : 0;
    lastSeenRowCount = rowCount;

    if (rowCount === 0) {
      await page.waitForTimeout(600);
      continue;
    }

    await rows
      .last()
      .evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(600);
  }

  logToFile(
    `⚠️ Could not find filing row #${targetIndex} (by View button, exhibit-safe) ` +
      `after ${MAX_STAGNANT_SCROLLS} stagnant scroll attempts.`,
  );
  return null;
};
