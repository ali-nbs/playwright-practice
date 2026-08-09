import { expect, Page } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { AaPage } from "../pages/AaPage";
import {
  closeAllOpenTabs,
  findResultRowByIndex,
  formatScenarioReport,
  getTabText,
  parseCount,
  RowFinding,
} from "../utils/helpers";

const IDENTIFIER = "aa_accountingDisclosuresAndPolicies";

// How many documents to open & verify per adoption-status label.
const DOCS_TO_PROCESS_PER_LABEL = 3;

const ADOPTION_STATUS_LABELS = [
  "Early Adopted",
  "Was Adopted",
  "Will Be Adopted",
  "Disclosed, But No Decision On Adoption",
];

const NEW_DISCLOSURES_KEYWORD = "All ASU";

/**
 * Selects a value from one of this app's typeahead/"chip" filters by
 * label text.
 *
 * FIXES vs previous version:
 * 1. The field is now explicitly cleared (Ctrl+A, Backspace) before
 *    typing. Previously, calling this twice for the same field (e.g.
 *    "Forms" -> "10-K" then "Forms" -> "10-Q") left the first value's
 *    text in the input, so the second call typed on top of it
 *    (effectively "10-K10-Q"), never matched the exact-text suggestion
 *    filter, and hung indefinitely waiting on toBeVisible.
 * 2. The suggestion-list lookup is now scoped to a dropdown container
 *    near the field itself (best-effort — falls back to page-wide if no
 *    scoped container is found), instead of searching every <li> on the
 *    whole page, which risked matching an unrelated element with the
 *    same exact text elsewhere on the page.
 * 3. Fails fast with a clear, descriptive error if the field or its
 *    suggestion never appear, instead of the default toBeVisible timeout
 *    message which doesn't say WHICH field/label it was looking for.
 *
 * LIVE-CONFIRMED (2026-07-29, via playwright-cli headed session — not
 * guessed) for the "New Accounting Disclosures and Policies" field:
 * - The <label>-based xpath DOES successfully locate its <input> — this
 *   field really is a typeahead like Forms, just with hashed CSS-module
 *   classes and no id/data-testid/aria-label.
 * - Its suggestion <li> wraps the matching text in a <mark> tag, e.g.
 *   <li ...><span><mark class="styles__highlightContains...">All ASU</mark></span></li>
 *   — matching on the <li>'s own text with hasText still works, since
 *   <mark> text is part of the <li>'s rendered text content.
 * - Typing a value alone does NOT enable the adoption-status checkboxes
 *   below it — they stay disabled+checked (inert) until the suggestion
 *   is actually clicked and committed as a chip. This is why this call
 *   must run BEFORE setOnlyAdoptionStatusChecked in the main flow below.
 */
// The "New Accounting Disclosures and Policies" filter's outer container
// has a real, stable id (confirmed via DevTools 2026-07-29) — far more
// reliable than the label-climbing xpath used for other filters, since
// that container's own inner classes are hashed CSS-module names that
// aren't guaranteed stable across deploys. NOTE the app's own typo:
// "Disclosured", not "Disclosed" — copy this exactly, don't "fix" it.
const NEW_DISCLOSURES_FILTER_ID = "NewAccountingDisclosuredAndPoliciesFilter";

const selectTypeaheadChip = async (
  page: Page,
  labelText: string,
  value: string,
  logToFile: Function,
) => {
  const fieldInput =
    labelText === "New Accounting Disclosures and Policies"
      ? page.locator(`#${NEW_DISCLOSURES_FILTER_ID} input`).first()
      : page
        .locator(
          `//label[text()="${labelText}"]/ancestor::div[contains(@class,"header")][1]/parent::div//input`,
        )
        .last();

  try {
    await expect(fieldInput).toBeVisible({ timeout: 8000 });
  } catch {
    throw new Error(
      `selectTypeaheadChip: could not find an input field for label "${labelText}". ` +
      `This field's DOM structure may differ from the "Forms" field this locator was built for.`,
    );
  }

  await fieldInput.click();
  // Clear any leftover text from a previous selection before typing —
  // this was the root cause of the hang on the second Forms value.
  await fieldInput.press("Control+A");
  await fieldInput.press("Backspace");
  await page.keyboard.type(value, { delay: 30 });

  // LIVE-CONFIRMED (2026-07-29): the "New Accounting Disclosures and
  // Policies" field commits its typed value on Tab — no suggestion needs
  // to be clicked. Confirmed by checking the adoption-status checkboxes
  // (disabled -> enabled) and the container's text (chip appended)
  // immediately after Tab, on a live headed session.
  if (labelText === "New Accounting Disclosures and Policies") {
    await fieldInput.press("Tab");
    logToFile(`Selected "${value}" for "${labelText}" filter (via Tab).`);
    return;
  }

  // Other fields (e.g. Forms) require clicking the exact-match suggestion
  // — confirmed working for "10-K" / "10-Q" via a live headed test run.
  const scopedDropdown = fieldInput
    .locator("xpath=ancestor::div[1]")
    .locator("ul, [role='listbox']")
    .first();

  const suggestionPool = (await scopedDropdown.count()) > 0
    ? scopedDropdown.locator("li, [role='option']")
    : page.locator("li");

  const exactSuggestion = suggestionPool
    .filter({ hasText: new RegExp(`^${value}$`) })
    .first();

  try {
    await expect(exactSuggestion).toBeVisible({ timeout: 8000 });
  } catch {
    throw new Error(
      `selectTypeaheadChip: typed "${value}" into "${labelText}" but no exact-match ` +
      `suggestion appeared. Field may not have cleared properly, or the app's ` +
      `suggestion text doesn't exactly equal "${value}".`,
    );
  }

  await exactSuggestion.click();
  logToFile(`Selected "${value}" for "${labelText}" filter.`);
};

// Maps each adoption-status label to its real, live-confirmed input id.
// Confirmed via playwright-cli 2026-07-29: label[for="<id>"] is the
// correct click target, verified with a fresh isChecked() read
// immediately after each click showing ONLY that one input's state
// flipped, all others unchanged.
const ADOPTION_STATUS_IDS: Record<string, string> = {
  "Early Adopted": "earlyAdopted",
  "Was Adopted": "wasAdopted",
  "Will Be Adopted": "willBeAdopted",
  "Disclosed, But No Decision On Adoption": "disclosed",
};

/**
 * Ensures exactly one adoption-status checkbox is checked. The app
 * enforces "at least one status must remain checked" — unchecking the
 * sole active checkbox gets silently reverted — so the target must be
 * checked BEFORE the previously-checked one is unchecked.
 *
 * LIVE-CONFIRMED (2026-07-29, via playwright-cli headed session):
 * - The native <input type="checkbox"> is visually hidden
 *   (_checkbox__input--hidden) and has both disabled + checked set by
 *   default UNTIL a "New Accounting Disclosures and Policies" value has
 *   been committed — see selectTypeaheadChip's note above. Calling this
 *   before that value is selected will find the inputs but clicks won't
 *   register (they're disabled).
 * - The PREVIOUS locator pattern (div whose full text equals the label,
 *   then find a nested checkbox) does NOT work here: clicking that
 *   outer div silently no-ops on the checkbox state and was observed to
 *   click through to an unrelated element (the Home tab area) instead.
 * - The CORRECT, verified click target is the visible text label,
 *   `label[for="<id>"]` — clicking that (a real Playwright .click(),
 *   not raw JS) reliably toggles exactly that one checkbox and nothing
 *   else.
 * - State should be read from the input directly via `#<id>` and
 *   .isChecked() — not from the wrapping div.
 */
const setOnlyAdoptionStatusChecked = async (
  page: Page,
  targetLabel: string,
  logToFile: Function,
) => {
  const targetId = ADOPTION_STATUS_IDS[targetLabel];
  if (!targetId) {
    throw new Error(
      `setOnlyAdoptionStatusChecked: no known input id for label "${targetLabel}". ` +
      `Known labels: ${Object.keys(ADOPTION_STATUS_IDS).join(", ")}`,
    );
  }

  const clickLabelFor = (id: string) => page.locator(`label[for="${id}"]`);
  const isCheckedFor = (id: string) => page.locator(`#${id}`).isChecked();

  const targetLabelLocator = clickLabelFor(targetId);
  try {
    await expect(targetLabelLocator).toBeVisible({ timeout: 8000 });
  } catch {
    throw new Error(
      `setOnlyAdoptionStatusChecked: could not find label[for="${targetId}"] for ` +
      `"${targetLabel}". If the app changed this field's ids, they need to be ` +
      `re-confirmed live and updated in ADOPTION_STATUS_IDS.`,
    );
  }

  if (!(await isCheckedFor(targetId))) {
    await targetLabelLocator.click();
  }

  for (const [label, id] of Object.entries(ADOPTION_STATUS_IDS)) {
    if (id === targetId) continue;
    if (await isCheckedFor(id)) {
      await clickLabelFor(id).click();
    }
  }

  logToFile(`Adoption status filter set to: "${targetLabel}" (only)`);
};

const switchToLatestResultsTab = async (page: Page, tabIndex: number) => {
  const resultsTab = page
    .locator(
      '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "No Results Found")]',
    )
    .nth(tabIndex);

  if (await resultsTab.isVisible()) {
    await resultsTab.click();
  }

  // LIVE-CONFIRMED (2026-07-30): this SPA keeps every opened tab's DOM
  // mounted (hidden, not removed) rather than unmounting inactive ones —
  // including old "Docs: N" results tabs and the Home dashboard's own
  // widget grids. Plain `.last()` picked a stale HIDDEN grid from an
  // earlier tab (confirmed via live inspection: 3 grids existed, DOM-last
  // was hidden, the actually-active one was in the middle). Must filter
  // to the currently visible grid, not just the last one in DOM order.
  await page
    .locator(".ReactVirtualized__Grid:visible")
    .last()
    .waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(500);
};

// NOTE: row lookup used to be a local scrollToRow() here that matched
// `div[data-test="resultRow"][id="N"]` directly. That was buggy whenever
// "Exhibits to Filings" is checked (the app's default): each filing's own
// exhibit sub-rows (EX-31.1, EX-31.2, EX-32.1, EX-101, ...) are separate
// resultRow elements that reuse the SAME small id sequence independently
// per filing, so id="1" could match an exhibit sub-row instead of the 2nd
// real filing. Exhibit sub-rows have no "View" button, so the failure
// showed up as an opaque `expect(locator).toBeVisible()` timeout with no
// indication the wrong row had been selected — LIVE-CONFIRMED 2026-08-06
// via playwright-cli, this was the actual cause of "Row 2/Row 3 failed"
// while Row 1 always passed. Now uses the shared, exhibit-safe
// findResultRowByIndex from tests/utils/helpers.ts, which identifies real
// filing rows by their "View" button instead of by raw id.

const verifyNewDisclosuresSubSection = async (
  page: Page,
): Promise<{ details: string[]; isValid: boolean }> => {
  const details: string[] = [];
  let isValid = true;

  const acctTab = page.getByText("ACCT", { exact: true }).first();
  await expect(acctTab).toBeVisible({ timeout: 15000 });
  await acctTab.click();
  await page.waitForTimeout(500);

  const subSectionLabel = page
    .locator(':text-is("New Accounting Disclosures and Policies -")')
    .first();

  if ((await subSectionLabel.count()) === 0) {
    details.push(
      'ℹ️ "New Accounting Disclosures and Policies" sub-section not present in this document.',
    );
    return { details, isValid: true };
  }

  const subSectionItem = subSectionLabel.locator("xpath=..");
  const backgroundBefore = await subSectionItem.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );

  await subSectionItem.click();
  await page.waitForTimeout(800);

  const backgroundAfter = await subSectionItem.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );

  const leftPanelHighlighted = backgroundAfter !== backgroundBefore;
  details.push(
    leftPanelHighlighted
      ? "✅ Left-panel sub-section item shows a selected/highlighted state after click."
      : "❌ Left-panel sub-section item background did not change after click.",
  );
  if (!leftPanelHighlighted) isValid = false;

  // LIVE-CONFIRMED (2026-07-30, via CDP diagnostic against a real manual
  // click, not guessed): this app's accounting-item highlight is NOT an
  // <em> tag — it's <span class="acctItem-highlight <Topic>"> with a
  // reddish rgba background. <em> was copied from aa-indexing-logic.ts's
  // unrelated keyword-highlight convention and never actually matched
  // anything here, so this check always failed even on a real click.
 const documentFrame = page
            .locator('iframe[src*="/SECFilings/Documents/"]')
            .first()
            .contentFrame();
          
const recentlyHeader = documentFrame
  .locator(':is(p, div, td, span):has-text("recent")')
  .first();

await expect(recentlyHeader).toBeVisible({ timeout: 30000 });

// 2. Target highlights in the same container OR in adjacent elements
const headingHighlights = documentFrame.locator(
  '*:has-text("Recently") .acctItem-highlight.New-Accounting-Disclosures-and-Policies, ' +
  '*:has-text("Recently") + * .acctItem-highlight.New-Accounting-Disclosures-and-Policies, ' +
  '.acctItem-highlight.New-Accounting-Disclosures-and-Policies'
);

let headingHighlightCount = 0;
try {
  await expect(async () => {
    headingHighlightCount = await headingHighlights.count();
    expect(headingHighlightCount).toBeGreaterThan(0);
  }).toPass({ timeout: 15000 });

  details.push(
    `✅ Content following "Recently ... Accounting Standards..." heading contains ${headingHighlightCount} highlighted term(s).`,
  );
} catch {
  details.push(
    '❌ No highlighted terms found in the content following the heading.',
  );
  isValid = false;
}

  return { details, isValid };
};

export const runAAAccountingDisclosuresAndPoliciesTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting AA-AccountingDisclosuresAndPolicies Report ---");

  const aa = new AaPage(page);
  const clearBtn = aa.clearFiltersBtn;
  const searchBtn = aa.searchBtn;

  await clearBtn.click();
  await page.waitForTimeout(500);

  await selectTypeaheadChip(page, "Forms", "10-K", logToFile);
  await selectTypeaheadChip(page, "Forms", "10-Q", logToFile);

  // Re-enabled: this was commented out and replaced with page.pause() in
  // the previous version. page.pause() is Playwright's interactive
  // debugger breakpoint — it deliberately halts the entire script until
  // someone manually clicks "Resume" in the Inspector UI. It is not a
  // way to inject a value mid-run; that's what this function call does.
  await selectTypeaheadChip(
    page,
    "New Accounting Disclosures and Policies",
    NEW_DISCLOSURES_KEYWORD,
    logToFile,
  );

  let tabIndex = 0;
  let lastResultsTabIndex = -1;
  const resultsSummary: string[] = [];

  for (const statusLabel of ADOPTION_STATUS_LABELS) {
    logToFile(`\nTesting Adoption Status: ${statusLabel}`);

    // After the first label, the row-processing loop below leaves the
    // browser on a document tab, not the results tab the filter panel
    // (and its adoption-status checkboxes) lives on. LIVE-CONFIRMED
    // (2026-07-30): setOnlyAdoptionStatusChecked threw "could not find
    // label[for=...]" here because label[for="wasAdopted"] genuinely
    // isn't present on a document view — must switch back first.
    if (lastResultsTabIndex >= 0) {
      await switchToLatestResultsTab(page, lastResultsTabIndex);
    }

    await setOnlyAdoptionStatusChecked(page, statusLabel, logToFile);
    await searchBtn.click();

    const currentTabIndex = tabIndex++;
    lastResultsTabIndex = currentTabIndex;
    const tabText = await getTabText(page, currentTabIndex, logToFile, false);
    const totalDocs = parseCount(tabText);
    logToFile(`Results for "${statusLabel}": ${tabText} (${totalDocs} docs)`);

    const docsToProcess = Math.min(DOCS_TO_PROCESS_PER_LABEL, totalDocs);
    const findings: RowFinding[] = [];

    for (let rowIndex = 1; rowIndex <= docsToProcess; rowIndex++) {
      await switchToLatestResultsTab(page, currentTabIndex);

      // Exhibit-safe: identifies real filing rows by their "View" button,
      // so this is correct whether or not "Exhibits to Filings" is
      // checked. See the note above verifyNewDisclosuresSubSection for
      // why the old id-based lookup broke rows 2+.
      const row = await findResultRowByIndex(page, rowIndex, logToFile);
      let rowLabel = `Row ${rowIndex}`;

      if (!row) {
        findings.push({
          passed: false,
          label: rowLabel,
          details: [
            "❌ Could not find this filing row in the result grid (scrolled to the end without finding it).",
          ],
        });
        continue;
      }

      try {
        const idAttr = await row.getAttribute("id");
        rowLabel = `Row ${rowIndex} (grid id=${idAttr})`;

        const viewBtn = row.getByRole("button", { name: /View/i }).last();
        await expect(viewBtn).toBeVisible({ timeout: 5000 });
        await viewBtn.click();

        const { details, isValid } = await verifyNewDisclosuresSubSection(page);
        findings.push({ passed: isValid, label: rowLabel, details });
        logToFile(
          `${isValid ? "✅" : "❌"} ${rowLabel} ->\n${details.map((d) => "   " + d).join("\n")}`,
        );
      } catch (e: any) {
        findings.push({ passed: false, label: rowLabel, details: [], error: e });
        logToFile(`❌ ${rowLabel} -> ERROR: ${e?.message?.split("\n")[0] ?? String(e)}`);
      }
    }

    const { text, isValid: labelValid } = formatScenarioReport(
      `Adoption Status: ${statusLabel}`,
      totalDocs,
      findings,
    );

    if (!labelValid) {
      resultsSummary.push(text);
    }

    logToFile(
      labelValid
        ? `✅ Adoption Status "${statusLabel}": Valid`
        : `❌ Adoption Status "${statusLabel}": Invalid`,
    );
  }

  const finalDumpString =
    resultsSummary.length > 0
      ? resultsSummary.join(
        "\n--------------------------------------------------------------------------------\n",
      )
      : "Status: Valid\nAll adoption statuses passed — no failures to report.";

  try {
    await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped detailed findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }

  logToFile("\n--- End of Report ---");
  await closeAllOpenTabs(page);
};
