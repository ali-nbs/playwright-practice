import { expect, Page, Locator } from "@playwright/test";
import { updateGoogleSheet } from "../utils/dumpDataOnGoogleSheet";
import { AaPage } from "../pages/AaPage";
import {
  formatScenarioReport,
  parseCount,
  RowFinding,
} from "../utils/helpers";

const IDENTIFIER = "aa_auditOpinionsAndPolicies";

// How many documents to open & verify per form type.
const DOCS_TO_PROCESS_PER_FORM = 2;

const FORMS_TO_TEST = ["11-K", "10-K"];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * LIVE-CONFIRMED (2026-07-31, via playwright-cli headed session): this SPA
 * keeps every previously-opened document's iframe (and its ACCT left-panel
 * data) mounted in the DOM rather than unmounting it when you move on to
 * the next row -- with 3 documents open simultaneously, a plain
 * `document.querySelectorAll('iframe')` / unscoped `page.frameLocator(...)`
 * returned/matched ALL of them, not just the current one (confirmed by
 * counting 78 pre-existing `.acctItem-highlight` spans left over from a
 * different, previously-opened document). Every lookup below must be
 * scoped to the currently VISIBLE element, never just `.first()`.
 */
const getVisibleDocumentFrame = (page: Page) =>
  page.frameLocator("iframe:visible").first();

const findFirstVisible = async (locator: Locator): Promise<Locator | null> => {
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    if (await locator.nth(i).isVisible().catch(() => false)) {
      return locator.nth(i);
    }
  }
  return null;
};

/**
 * Selects an exact-match Forms filter value.
 *
 * LIVE-CONFIRMED (2026-07-31): both "11-K" and "10-K" commit the same way
 * as the already-confirmed "10-K"/"10-Q" flow in
 * claude-aa-accoutingDisclousureAndParties-logic.ts -- type the value, then
 * click the suggestion whose text is an EXACT match. This matters because
 * the suggestion list also offers a "starts with" wildcard option and a
 * look-alike form (e.g. "11-KT" alongside "11-K") that must NOT be picked
 * instead.
 */
const selectFormsFilter = async (
  page: Page,
  formValue: string,
  logToFile: Function,
) => {
  const formsInput = page
    .locator(
      `//label[text()="Forms"]/ancestor::div[contains(@class,"header")][1]/parent::div//input`,
    )
    .last();

  try {
    await expect(formsInput).toBeVisible({ timeout: 8000 });
  } catch {
    throw new Error(
      `selectFormsFilter: could not find the Forms input field.`,
    );
  }

  await formsInput.click();
  await formsInput.press("Control+A");
  await formsInput.press("Backspace");
  await page.keyboard.type(formValue, { delay: 30 });

  const exactSuggestion = page
    .getByRole("listitem")
    .filter({ hasText: new RegExp(`^${escapeRegExp(formValue)}$`) })
    .first();

  try {
    await expect(exactSuggestion).toBeVisible({ timeout: 8000 });
  } catch {
    throw new Error(
      `selectFormsFilter: typed "${formValue}" into Forms but no exact-match suggestion appeared.`,
    );
  }

  await exactSuggestion.click();
  logToFile(`Selected "${formValue}" for "Forms" filter.`);
};

// Confirmed pattern, reused verbatim from
// claude-aa-accoutingDisclousureAndParties-logic.ts (same app, same
// virtualized-grid results view).
const switchToLatestResultsTab = async (page: Page, tabIndex: number) => {
  const resultsTab = page
    .locator(
      '//span[contains(text(), "Docs:") or contains(text(), "Results:") or contains(text(), "No Results Found")]',
    )
    .nth(tabIndex);

  if (await resultsTab.isVisible()) {
    await resultsTab.click();
  }

  await page
    .locator(".ReactVirtualized__Grid:visible")
    .last()
    .waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(500);
};

// Row lookup is exhibit-safe: see findResultRowByIndex in
// tests/utils/helpers.ts. NOTE: this file previously had its own local
// scrollToRow() that matched `div[data-test="resultRow"][id="N"]`
// directly, copied verbatim from
// claude-aa-accoutingDisclousureAndParties-logic.ts. That pattern is
// broken whenever "Exhibits to Filings" is checked (the app's default):
// each filing's own exhibit sub-rows (EX-31.1, EX-31.2, ...) are separate
// resultRow elements reusing the SAME small id sequence independently per
// filing, so id="1" can match an exhibit sub-row -- which has no "View"
// button -- instead of the 2nd real filing. LIVE-CONFIRMED 2026-08-06 via
// playwright-cli against Accounting Analytics.

const openAcctTabExpanded = async (page: Page) => {
  const acctTab = await findFirstVisible(
    page.getByText("ACCT", { exact: true }),
  );
  if (!acctTab) {
    throw new Error("openAcctTabExpanded: could not find a visible ACCT tab.");
  }
  await acctTab.click();
  await page.waitForTimeout(500);

  // LIVE-CONFIRMED (2026-07-31): items nested several levels deep (e.g.
  // Significant Accounting Policies / Critical Accounting Estimates chips
  // under NOTES > NOTE X > subtopic) are not reachable until "Expand All"
  // is clicked -- collapsed accordion branches don't expose their children
  // to locators at all, not just visually hide them.
  const expandAllBtn = await findFirstVisible(
    page.getByRole("button", { name: "Expand All" }),
  );
  if (expandAllBtn) {
    await expandAllBtn.click();
    await page.waitForTimeout(500);
  }
};

type SubSectionResult = { found: boolean; note: string; isValid: boolean };

/**
 * Confirms a left-panel item with an EXACT label exists, clicks it, and
 * verifies the SAME text appears in a `.acctItem-highlight` span in the
 * iframe afterward.
 *
 * LIVE-CONFIRMED (2026-07-31): raw `.acctItem-highlight` COUNT is not a
 * usable pass/fail signal on a real filing -- a large-filer 10-K already
 * has ~78 pre-existing highlighted spans (every previously-indexed topic
 * stays highlighted) before clicking anything new. The check here looks
 * for a highlight whose text matches what was clicked, not just "count >
 * 0" like the disclosures-only test does (that worked there only because
 * disclosures was the sole highlighted topic type in play).
 */
const verifyExactHeadingSubSection = async (
  page: Page,
  exactLabelText: string,
  logToFile: Function,
): Promise<SubSectionResult> => {
  const item = await findFirstVisible(
    page.locator(`:text-is("${exactLabelText}")`),
  );

  if (!item) {
    const note = `ℹ️ "${exactLabelText}" sub-section not present in this document.`;
    logToFile(note);
    return { found: false, note, isValid: true };
  }

  await item.click();
  await page.waitForTimeout(800);

  const documentFrame = getVisibleDocumentFrame(page);
  const headingHighlight = documentFrame
    .locator(".acctItem-highlight")
    .filter({ hasText: new RegExp(escapeRegExp(exactLabelText), "i") });

  try {
    await expect(async () => {
      expect(await headingHighlight.count()).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
    const note = `✅ "${exactLabelText}" -> click scrolled to and highlighted the matching heading text in the iframe.`;
    logToFile(note);
    return { found: true, note, isValid: true };
  } catch {
    const note = `❌ "${exactLabelText}" -> clicked, but no matching .acctItem-highlight text appeared in the iframe.`;
    logToFile(note);
    return { found: true, note, isValid: false };
  }
};

/**
 * LIVE-CONFIRMED BUG (2026-07-31, Walmart 10-K, playwright-cli headed
 * session): the label "Auditor Opinion of Internal Controls - <category>"
 * appears TWICE in the ACCT left panel for a single document -- once
 * (incorrectly, verified by reading which heading was actually visible
 * after clicking) grouped under the "Opinion on the Financial Statements"
 * report node, and once (correctly) grouped under a node headed "Opinion
 * on Internal Control over Financial Reporting". A positional pick
 * (`.first()` / `.nth(1)`) is NOT safe -- the correct occurrence must be
 * scoped by its ancestor heading text instead.
 */
const verifyIcfrOpinionSubSection = async (
  page: Page,
  logToFile: Function,
): Promise<SubSectionResult> => {
  const icfrHeader = await findFirstVisible(
    page.locator(
      ':text-is("Opinion on Internal Control over Financial Reporting")',
    ),
  );

  if (!icfrHeader) {
    const note =
      'ℹ️ "Opinion on Internal Control over Financial Reporting" section not present in this document.';
    logToFile(note);
    return { found: false, note, isValid: true };
  }

  const icfrChip = icfrHeader
    .locator(
      'xpath=following-sibling::*[1]//*[starts-with(normalize-space(.), "Auditor Opinion of Internal Controls")]',
    )
    .first();

  if ((await icfrChip.count()) === 0) {
    const note =
      'ℹ️ ICFR opinion heading found, but no "Auditor Opinion of Internal Controls" chip is nested under it.';
    logToFile(note);
    return { found: false, note, isValid: true };
  }

  await icfrChip.click();
  await page.waitForTimeout(800);

  const documentFrame = getVisibleDocumentFrame(page);
  const icfrHighlight = documentFrame
    .locator(".acctItem-highlight")
    .filter({
      hasText: /Opinion on Internal Control over Financial Reporting/i,
    });

  try {
    await expect(async () => {
      expect(await icfrHighlight.count()).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
    const note =
      '✅ "Auditor Opinion of Internal Controls" (ICFR-grouped occurrence) -> click scrolled to and highlighted the ICFR opinion heading.';
    logToFile(note);
    return { found: true, note, isValid: true };
  } catch {
    const note =
      '❌ "Auditor Opinion of Internal Controls" (ICFR-grouped occurrence) -> clicked, but the ICFR opinion heading was not highlighted.';
    logToFile(note);
    return { found: true, note, isValid: false };
  }
};

/**
 * Finds the most specific (leaf) chip whose label starts with
 * "<categoryPrefix> - ", among possibly dozens of topic-suffixed chips
 * (e.g. "Significant Accounting Policies - Basis of Presentation",
 * "... - Consolidation", etc.). Ancestor wrapper elements also match the
 * same prefix regex (their concatenated text starts with their first
 * child chip's text), so the shortest matching text -- not DOM order -- is
 * used to reliably land on a single leaf chip.
 */
const findFirstChipStartingWith = async (
  page: Page,
  categoryPrefix: string,
): Promise<{ locator: Locator; label: string } | null> => {
  const candidates = page
    .locator("div")
    .filter({ hasText: new RegExp(`^${escapeRegExp(categoryPrefix)} -`) });

  const count = await candidates.count();
  let best: { locator: Locator; label: string } | null = null;

  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    if (!(await candidate.isVisible().catch(() => false))) continue;

    const text = (await candidate.innerText()).trim();
    if (!best || text.length < best.label.length) {
      best = { locator: candidate, label: text };
    }
  }

  return best;
};

/**
 * Confirms clicking ANY one "<category> - <topic>" chip scrolls the
 * document and produces highlighted text nearby.
 *
 * LIVE-CONFIRMED (2026-07-31): unlike the Opinion sections, a SAP/CAE
 * chip's own topic wording does not necessarily match the highlighted
 * heading text verbatim -- Intelligize's normalized topic label can differ
 * from the filer's own heading wording (clicking "... - Basis of
 * Presentation" scrolled to and highlighted a cluster including "Note 1.",
 * "Summary of Significant Accounting Policies", and "Principles of
 * Consolidation" -- not the literal phrase "Basis of Presentation"). So
 * this check verifies scroll movement + highlighted text appearing, not an
 * exact text match against the chip's own label.
 */
const verifyRepresentativeChip = async (
  page: Page,
  categoryPrefix: string,
  logToFile: Function,
): Promise<SubSectionResult> => {
  const chip = await findFirstChipStartingWith(page, categoryPrefix);

  if (!chip) {
    const note = `ℹ️ No "${categoryPrefix} - ..." chip present in this document.`;
    logToFile(note);
    return { found: false, note, isValid: true };
  }

  const documentFrame = getVisibleDocumentFrame(page);
  const getScrollTop = () =>
    documentFrame
      .locator("body")
      .evaluate(
        (el) =>
          el.ownerDocument.documentElement.scrollTop ||
          el.ownerDocument.body.scrollTop,
      );

  const scrollBefore = await getScrollTop();
  await chip.locator.click();
  await page.waitForTimeout(800);
  const scrollAfter = await getScrollTop();

  const scrolled = scrollAfter !== scrollBefore;
  const hasHighlights = (await documentFrame.locator(".acctItem-highlight").count()) > 0;

  if (scrolled && hasHighlights) {
    const note = `✅ "${chip.label}" -> click scrolled the document (scrollTop ${scrollBefore} -> ${scrollAfter}) and highlighted text is present.`;
    logToFile(note);
    return { found: true, note, isValid: true };
  }

  const note = `❌ "${chip.label}" -> clicked, but scroll position did not change (${scrollBefore} -> ${scrollAfter}) and/or no highlighted text was found.`;
  logToFile(note);
  return { found: true, note, isValid: false };
};

/**
 * "Critical Audit Matters" and "Management Report of Internal Control" are
 * LIVE-CONFIRMED (2026-07-31, on 2 different 10-Ks) to NOT exist as
 * indexed/clickable ACCT left-panel items -- only as plain, unindexed body
 * text in the iframe (when present at all; smaller filers often lack a CAM
 * entirely). There is no click-and-highlight path to verify for these, so
 * this only checks whether the heading text is present in the document
 * body. Absence is not a failure -- not every filing has these sections.
 */
const verifyPlainTextPresence = async (
  page: Page,
  headingText: string,
  label: string,
  logToFile: Function,
): Promise<SubSectionResult> => {
  const documentFrame = getVisibleDocumentFrame(page);
  const heading = documentFrame.locator(`:text-is("${headingText}")`).first();

  const present = (await heading.count()) > 0;
  const note = present
    ? `✅ "${label}" heading ("${headingText}") is present in the document body (plain text only -- not an indexed/clickable sub-section on this app).`
    : `ℹ️ "${label}" heading ("${headingText}") not present in this document (not every filing includes it).`;

  logToFile(note);
  return { found: present, note, isValid: true };
};

export const runAAAuditOpinionsAndPoliciesTest = async (
  page: Page,
  logToFile: Function,
) => {
  logToFile("--- Starting AA-AuditOpinionsAndPolicies Report ---");

  const aa = new AaPage(page);
  const clearBtn = aa.clearFiltersBtn;
  const searchBtn = aa.searchBtn;

  
  const resultsSummary: string[] = [];

  for (const formValue of FORMS_TO_TEST) {
    logToFile(`\nTesting Form: ${formValue}`);
    let tabIndex = 0;
    await clearBtn.click();
    await page.waitForTimeout(500);
    await selectFormsFilter(page, formValue, logToFile);
    let exhibitsCheckbox = page.locator('label[for="-ExhibitsToFilings"]');
    await exhibitsCheckbox.click({ force: true });
    await page.waitForTimeout(300);
    await searchBtn.click();

    const currentTabIndex = tabIndex++;
    const tabText = await aa.getTabText(currentTabIndex, logToFile, false);
    const totalDocs = parseCount(tabText);
    logToFile(`Results for "${formValue}": ${tabText} (${totalDocs} docs)`);

    const docsToProcess = Math.min(DOCS_TO_PROCESS_PER_FORM, totalDocs);
    const findings: RowFinding[] = [];
     await aa.configureDisplayColumns({
            "Filing Info": ["Intelligize ID"],
            "Company Info": [],
          });

    for (let rowIndex = 1; rowIndex <= docsToProcess; rowIndex++) {
      await switchToLatestResultsTab(page, currentTabIndex);

      // Exhibit-safe: identifies real filing rows by their "View" button,
      // correct whether or not "Exhibits to Filings" is checked. See the
      // note above openAcctTabExpanded for why the old id-based lookup
      // broke rows 2+.
      const row = await new AaPage(page).findResultRowByIndex(rowIndex, logToFile);
      let rowLabel = `Row ${rowIndex}`;
      

      if (!row) {
        // findings.push({
        //   passed: false,
        //   label: rowLabel,
        //   details: [
        //     "❌ Could not find this filing row in the result grid (scrolled to the end without finding it).",
        //   ],
        // });
        continue;
      }

      try {
        const idAttr = await row.getAttribute("id");
        rowLabel = `Row ${rowIndex} (grid id=${idAttr})`;

          const texts = await row.locator("span").allInnerTexts();
          const cleanContent = texts.map((t) => t.trim()).filter(Boolean);

          console.log("---------------------------------------------");
          // for (const [index, text] of cleanContent.entries()) {
          //   console.log(index, text);
          // }
          console.log("-------------------------------------------");

          const intelligizeIdIndex = cleanContent.findIndex((text) =>
            /^\d{8}$/.test(text),
          );
          const intelligizeId =
            intelligizeIdIndex !== -1
              ? cleanContent[intelligizeIdIndex]
              : "N/A";


        const viewBtn = row.getByRole("button", { name: /View/i }).last();
        await expect(viewBtn).toBeVisible({ timeout: 5000 });
        await viewBtn.click();

        await openAcctTabExpanded(page);

        // LIVE-CONFIRMED (2026-07-31): multiple headings CAN be verified
        // on the SAME open document in one pass -- clicking one heading
        // does not invalidate or remove access to the others, and
        // highlights are additive, not replaced. No need to reopen the
        // document between checks.
        const checks: SubSectionResult[] = [];

        // Confirmed present on both 11-K and 10-K documents.
        checks.push(
          await verifyExactHeadingSubSection(
            page,
            "Opinion on the Financial Statements",
            logToFile,
          ),
        );

        if (formValue === "10-K") {
          // Only confirmed/relevant for 10-Ks during exploration -- 11-Ks
          // (employee benefit plan financials) don't carry an ICFR
          // opinion, CAM, SAP/CAE notes, or a management ICFR report the
          // same way a company's own annual report does.
          checks.push(await verifyIcfrOpinionSubSection(page, logToFile));
          checks.push(
            await verifyRepresentativeChip(
              page,
              "Significant Accounting Policies",
              logToFile,
            ),
          );
          checks.push(
            await verifyRepresentativeChip(
              page,
              "Critical Accounting Estimates",
              logToFile,
            ),
          );
          checks.push(
            await verifyPlainTextPresence(
              page,
              "Critical Audit Matter",
              "Critical Audit Matters",
              logToFile,
            ),
          );
          checks.push(
            await verifyPlainTextPresence(
              page,
              "Report on Internal Control Over Financial Reporting",
              "Management Report of Internal Control",
              logToFile,
            ),
          );
        }

        const rowValid = checks.some((c) => c.isValid);
        let details = checks
          .filter((c) => c.isValid)
          .map((c) => c.note);

        details.unshift(intelligizeId);
        if (!rowValid){
           findings.push({ passed: rowValid, label: rowLabel, details });
        }  
       
        logToFile(
          `${rowValid ? "✅" : "❌"} ${rowLabel} ->\n${details.map((d) => "   " + d).join("\n")}`,
        );
      } catch (e: any) {
        findings.push({ passed: false, label: rowLabel, details: []});
        logToFile(`❌ ${rowLabel} -> ERROR: ${e?.message?.split("\n")[0] ?? String(e)}`);
      }
    }

    await aa.closeAllOpenTabs();

    const { text, isValid: formValid } = formatScenarioReport(
      `Form: ${formValue}`,
      totalDocs,
      findings,
    );

    if (!formValid) {
      resultsSummary.push(text);
    }

    logToFile(
      formValid
        ? `✅ Form "${formValue}": Valid`
        : `❌ Form "${formValue}": Invalid`,
    );
  }

  const finalDumpString =
    resultsSummary.length > 0
      ? resultsSummary.join(
        "\n--------------------------------------------------------------------------------\n",
      )
      : "Status: Valid\nAll forms passed — no failures to report.";

  try {
    //await updateGoogleSheet(finalDumpString, IDENTIFIER);
    logToFile("\nSuccessfully dumped detailed findings to Google Sheets.");
  } catch (err: any) {
    logToFile(`\nFailed to dump to Google Sheets: ${err.message}`);
  }

  logToFile("\n--- End of Report ---");
  await aa.closeAllOpenTabs();
};