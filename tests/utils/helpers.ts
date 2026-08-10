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


export const getRandomIndices = (maxRange: number, count: number): number[] => {
  const arr = Array.from({ length: maxRange }, (_, i) => i);
  // Shuffle array and grab the first 'count' elements
  return arr.sort(() => 0.5 - Math.random()).slice(0, count);
};



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
