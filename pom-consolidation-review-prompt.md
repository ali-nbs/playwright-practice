Stop documenting why near-duplicate functions/locators are "different" and 
start collapsing them. The instruction was to generalize, not to catalog 
every variant with a comment explaining why it stayed. Go through the 
following categories and ACTUALLY MERGE them — delete the redundant ones, 
parameterize the survivor, migrate every caller. Do not ask me which to 
keep unless there is a genuine, LIVE-CONFIRMED behavioral difference you 
cannot resolve with a parameter — and if you claim one exists, prove it 
(cite the confirmed evidence), don't assume it.

1. fillAndEnter vs clearAndType — these do the same job (put text in a 
   field) with two small behavioral knobs: whether to clear first, whether 
   to press Enter after. Collapse into ONE function with two boolean/option 
   params (e.g. `typeInto(locator, value, { clearFirst, pressEnter, delay })`), 
   defaulted to match the more common current caller. Delete both old names. 
   Migrate every call site across the whole repo, not just BasePage.

2. tabLabels / statusTabLabels / docsTabLabels — these are the SAME xpath 
   pattern with different subsets of the OR clause. Collapse into ONE 
   function taking a mode/variant param (or just always match the superset 
   and let callers filter the result), e.g. `resultsTab(mode: "all" | 
   "docsOnly" | "statusOnly")`. Delete the other two getters. Migrate callers.

3. searchBtn/clearFiltersBtn exposed as public locators AND wrapped in 
   search()/clearFilters() action methods — pick ONE pattern for the ENTIRE 
   codebase and apply it everywhere, no exceptions:
   - Option A: locators are PRIVATE, only action methods are exported. Test 
     files never call .click()/.fill() directly on a page-object locator.
   - Option B: locators are the public API, test files call .click() 
     themselves, and thin action-method wrappers get deleted entirely.
   Decide which one, state the decision in a comment at the top of 
   BasePage.ts, and refactor EVERY class (BasePage, SfPage, and every other 
   app page) to follow it consistently. No file gets to do it the other way.

4. spanWithText / labelWithText — same pattern, different tag. Collapse 
   into ONE function: `elementWithText(tag: string, text: RegExp): Locator` 
   returning `this.page.locator(tag, { hasText: text })`. Delete both, 
   migrate callers. Do the same audit for ANY other per-tag locator 
   duplicated this way (div, p, a, etc.) — find them all, not just these two.

5. okBtnAnyCase duplicating an existing okBtn — there should be exactly ONE 
   "OK button" locator/method in the entire codebase. Find every OK-button 
   variant across BasePage and every app class, collapse to one, delete the 
   rest, migrate callers.

6. Row data extraction sprawl — rowSpanTextsClean, rowSpanTextsRaw, 
   rowParagraphTexts, rowHighlightTexts, rowLinkTexts, rowFirstLink, 
   rowLinksAndParagraphs, rowParagraphs, rowCheckboxLabel, rowViewAllHits, 
   rowLabelledSpan, labelledValue — this is 12 narrow functions for "get 
   some piece of a row." Replace with:
   a) ONE function that extracts ALL commonly-needed data from a row in a 
      single pass and returns it as a structured object, e.g.:
      `async rowData(row: Locator): Promise<RowData>` returning 
      `{ spans: string[], paragraphs: string[], highlights: string[], 
      links: string[], firstLink: Locator, checkboxLabel: Locator, 
      hasViewAllHits: boolean }` — one DOM query pass per row instead of 
      callers re-querying the same row 5 different ways across a loop.
   b) ONE generalized labelled-value helper for anything keyed by a visible 
      label, replacing rowLabelledSpan + labelledValue + rowValueByLabel + 
      rowIntelligizeId + rowDate + rowAccountingStandard + 
      rowAcceleratedStatus + rowHasAccountantFee — ALL of these are "read 
      the value next to a label inside a row," just with the label 
      hardcoded per function. Collapse to: 
      `async rowValueByLabel(row: Locator, label: string): Promise<string | null>` 
      and delete every hardcoded wrapper. Where a caller needs a boolean 
      ("has accountant fee"), that's `(await rowValueByLabel(row, "Accountant Fees")) !== null`, 
      not a separate function.
   Confirm rowDate's specific class-based selector 
   (.styles__filing-date-value-column___2pu1v) actually differs from the 
   label-based approach before keeping it separate — if a label-based 
   lookup works for it too, fold it in and delete the special case.

7. rows vs refRows — you documented a real behavioral difference (id reuse 
   on scroll vs stable data-ref). Before accepting that as final: verify 
   live whether `refRows` alone could always be used instead of `rows` — 
   if `data-ref` is present and stable on every row in every app, `rows` 
   may be an unnecessary second implementation kept only out of caution. 
   Confirm one way or the other, then either delete `rows` or document the 
   confirmed case where `refRows` doesn't work.

8. selectInfoOption duplicating the already-implemented, more dynamic 
   configureDisplayColumns — this is a direct duplicate that was flagged 
   already. Delete selectInfoOption entirely. Migrate every caller to 
   configureDisplayColumns. If configureDisplayColumns is missing a 
   capability selectInfoOption had, EXTEND configureDisplayColumns to cover 
   it — do not keep two functions doing the same job.

9. clickViewForRow hardcoded to "View" — generalize the button text: 
   `async clickRowButton(row: Locator, buttonText: string | RegExp)`. Delete 
   clickViewForRow and any sibling function for "Profile" or other button 
   labels doing the same click-with-different-text. Migrate callers to pass 
   the button text explicitly.

10.    Scrap the separate ResultGrid class idea for now — keep the result-grid 
logic as methods directly on BasePage (or wherever the existing grid code 
already lives), don't introduce a new class/file for it right now.

Same requirements as before, just without the new class wrapper:

1. ONE row-access pattern used everywhere — resolve the rows vs refRows 
   question first (confirm live whether rows alone is always sufficient), 
   then every test case uses that single resolved approach. Delete 
   whichever one turns out to be redundant.

2. ONE scroll-to-row method with a stagnation guard (max attempts with no 
   new rows → stop, never loop forever) — this replaces scrollToRowIndex, 
   scrollResultGrid, and any manual scrollIntoView-in-a-loop pattern 
   scattered across the test cases. Every test case calls this one method.

3. ONE row-extraction method that pulls all commonly-needed data in a 
   single DOM pass per row (see the earlier rowData() consolidation) — 
   replaces the 12+ narrow row-getter functions.

4. ONE open-document / return-to-grid sequence, reused by every test case 
   that opens a doc from the grid and comes back. If an app's flow 
   genuinely differs (e.g. AA's ACCT-tab step), that's a parameter or 
   override on this same method, not a separate reimplementation.

5. A single loop function (reconcile with forEachRefRow if it already does 
   this) that walks N rows, extracts data, optionally opens+verifies+ 
   returns, taking the per-row check as a callback — this is the shape 
   every test case's row-processing loop should collapse into.

Add these as methods on BasePage, migrate every test case listed earlier 
(sf-accountant, sf-auditor, sf-boilerplate, sf-ixbrl, sf-xbrlParsing, 
dbm-pastRedline, bpc-crawler/displayBar/profileCompare/profileView, AOE, 
and any others with ad hoc grid logic) onto these shared methods, and 
delete their local duplicate implementations. Flag anything that genuinely 
can't migrate, with the specific reason, instead of silently leaving it on 
old code.

Verify with npx tsc --noEmit, then give me a summary of what changed before 
this spreads further.

GENERAL RULE FOR THE REST OF THE REVIEW: before adding or keeping ANY new 
function/locator, ask "does an existing one already do this with a 
different hardcoded value?" If yes, generalize the existing one with a 
parameter instead of adding a new one. Do a full pass over BOTH BasePage.ts 
and every app page class (SfPage.ts included) applying this rule — the 
examples above are not exhaustive, they are the pattern. Find every other 
instance of the same anti-pattern (hardcoded-value functions that are 
really one generalized function in disguise) and collapse them too.

After the refactor: run npx tsc --noEmit across the whole repo, confirm it 
passes, then give me a summary of every function/locator deleted and what 
it was replaced with, so I can review before this touches the other 10 apps.