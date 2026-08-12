# Draft Review: POM Consolidation (peer merge)

Status: **draft for discussion. No code changed.**
Reviewer stance: second opinion, not validation. Where I think the framing in
`pom-consolidation-review-prompt.md` is wrong, it says so explicitly.

Scope read for this review: `tests/pages/*.ts` (BasePage 1235 lines, SfPage 424,
SrcPage 221, DbmPage 111, AaPage 111, AoePage 94, SePage 48, BpcPage 29,
NalPage/RoPage 25 each), `tests/utils/helpers.ts` (293), and every `-logic.ts`
that touches the grid, the row getters, or the merged peer flows.

---

## 0. The one finding that outranks everything in the prompt

None of the five themes you listed is the highest-risk thing in this codebase
right now. This is:

**Flows disagree about whether a search is triggered by `Enter` or by the
Search button, and the merged peer flows silently chose "Enter only".**

| Flow | After typing keywords |
| --- | --- |
| `sf-accountingStandard-logic.ts:29`, `sf-acceleratedStatus:36`, `sf-accountantFees:36`, `sf-outline:33`, `sf-releaseDate:33`, `sf-snippets:29` | `await sf.search()` |
| `sf-booleanHighlight-logic.ts` (ends at `fillAndEnter(sf.keywordsInput, KEYWORD)`, line 35) | **no search call** |
| `src-conceptualHighlight-logic.ts:37` | **no search call** |
| `se-booleanHighlight-logic.ts:34` | **no search call** |
| `dbm-keywordHighlight-logic.ts:48`, `aoe-keywordHighlight-logic.ts:51` | **no search call** |

All six of the no-search flows then immediately `await x.waitForSearchResponse()`
(`BasePage.waitForSearchResponse`, line 836). So they are depending on the
`Enter` inside `fillAndEnter` to fire `/api/search`. Where that holds, fine.
Where it does not — for example when the keyword box swallows Enter to close a
suggestion dropdown — `waitForSearchResponse` hangs for its full 90s and then
throws, and the flow reports a scenario failure that has nothing to do with the
feature under test.

This is exactly the class of bug the peer's `magic-runner` sessions have already
been producing (SRC ran against SEC Filings and reported 25 fake passes). It is
a *correctness of the report*, not a style issue.

**Recommendation:** pick one convention (`fillAndEnter` for the value, explicit
`.search()` to run the search) and make it uniform.
**Open question (behavior decision, do not do silently):** adding `.search()`
to the six flows above is a runtime behavior change — on some apps it will fire
a *second* search and `waitForSearchResponse` would then resolve on the first
one while the grid is still rendering the second. Decide per app, verified live,
before touching it.

---

## 1. Naming

### 1.1 `getTabText` (`BasePage.ts:182`)

Current state: it does far more than read text. It races the tab against the
crash screen for 240s, throws `.kind = "crash"`, throws `.kind = "error"` on an
error state, and *clicks "Load more results"* when the text is `Docs: 2,000+`
and `isNeedLoadMoreResults` is true (line 221-224).

**I disagree with your proposed fix.** You suggested renaming it to reflect that
it "reads a tab's status/count text". That name would still be a lie, because
the function mutates page state. A getter-sounding name that clicks a link is
worse than a vague one.

**Recommendation:** `waitForResultTabState(index, logToFile, { loadMore })`.
It communicates: this waits, this can throw, this is about the tab's *state*.
**Open question:** the `isNeedLoadMoreResults` click is arguably a separate
concern (`expandResultsBeyond2000()`), but splitting it changes call order for
whichever caller passes `true`. List, do not do.

### 1.2 `rowByIdFlat` (`SfPage.ts:248`)

Current state: `page.locator('div[data-test="resultRow"][id="${id}"]')` — the
only difference from `BasePage.rowById` (line 550) is that it is **not scoped
through the rowgroup** (`resultsContainer`). "Flat" means "unscoped". It has
exactly one caller: `sf-6kFormType-logic.ts:72`.

**Your framing is wrong here.** You guessed "if it returns full row data
including buttons, name it accordingly". It does not return row data at all; it
returns a `Locator`, same as `rowById`. The real problem is not the name, it is
that we have two row-by-id lookups whose difference is undocumented.

**Recommendation:** rename to `rowByIdUnscoped` **and** add the one-line reason
it exists. If nobody can state why 6-K needs the unscoped variant, delete it and
use `rowById` — but that is a behavior change (different match set when the app
renders a stale offscreen grid), so it is an **open question**, not a cleanup.

### 1.3 `parseCount` (`helpers.ts:250`)

Current state: `text.replace(/[^0-9]/g, "")` then `parseInt`. It is not
tab-specific at all — it strips every non-digit from any string.

**I disagree with your proposal.** Renaming it to something tab-specific
(`parseTabCount`) would *narrow* a genuinely generic function and invite a
second copy the first time someone needs it elsewhere.

**Recommendation:** keep it generic, rename to `digitsToNumber` or
`parseLeadingDigits`, and note the sharp edge in a comment: `"Docs: 2,000+"` →
`2000`, and `"Docs: 1 of 20"` → `120`. That second case is a latent bug, not a
naming issue. Flagging it, not fixing it.

### 1.4 `addIconIn` vs `filterAddIcon` — confirmed duplicate

- `BasePage.addIconIn(block)` (line 152) → `block.locator("span._icon_1jkal_249.Add").first()`
- `BasePage.filterAddIcon(labelText)` (line 433) → `this.filterBlock(labelText).locator("span._icon_1jkal_249.Add").first()`

Identical selector. `filterAddIcon` is literally `addIconIn(filterBlock(label))`.
Callers are split: `addIconIn` in `sf-boilerPlate-logic.ts:279`,
`sf-companyType-SPAC…:59`, `sf-companyType-SRC…:54`; `filterAddIcon` in
`sf-6kFormType:46`, `sf-accountant:39`, `sf-boilerPlate:249`. `sf-boilerPlate`
uses **both**, four lines apart in different functions.

**Recommendation:** keep **both**, but make one call the other:
`filterAddIcon(label) { return this.addIconIn(this.filterBlock(label)); }`.
You asked to consolidate to ONE name — I disagree. They take different
arguments (a `Locator` vs a `RegExp`) and both argument shapes are genuinely
needed: `sf-companyType` already holds the block locator, `sf-6kFormType` only
knows the label. Collapsing to one forces one caller group to construct a
throwaway. One implementation, two entry points is the right shape.
`filterPlsBtn` does not exist in this repo (it is peer-repo vocabulary); the
local variable name `sectionPlusBtn` does, in three files.

### 1.5 `checkListItem`, `pickerRowCheckboxIcon` (`SfPage.ts:260`, `227`)

Current state: neither is SF-specific.
`checkListItem` → `li.styles__check-list-item__container___233d9`;
`pickerRowCheckboxIcon` → `row.locator("label._checkbox__icon_1xotg_257")`.
That second class is the *same* obfuscated checkbox class `BasePage.
configureDisplayColumns` uses at lines 314, 324, 346. Both have exactly one
caller: `sf-boilerPlate-logic.ts:282-283`.

**Recommendation:** move both to `BasePage` under the existing "Filter popups"
header, as `pickerListItem(text)` and `pickerCheckboxIcon(row)`. They describe
generic popup chrome, and `_checkbox__icon_1xotg_257` is already duplicated in
three places in `BasePage` — one more copy in `SfPage` is how the class-hash
problem in POM-ARCHITECTURE §6.3 spreads.
Note "audit for reuse potential" is the right instinct but the payoff is small
(1 caller). This is a low-priority tidy, not a risk item.

### 1.6 `configureFiscalYearColumns` vs `configureDisplayColumns`

Current state: `sf-fiscalYear-logic.ts:247-276` is a **local `const`**, not a
class method, and it is a near-copy of `BasePage.configureDisplayColumns`
(line 302). Compare:

| Step | `configureDisplayColumns` | `configureFiscalYearColumns` |
| --- | --- | --- |
| open section | ✅ same selector | ✅ same selector |
| master checkbox | reads `input.checked` first, clicks **once if checked**, **twice if not** (lines 326-339) | clicks **twice, unconditionally** (262-264) |
| waits | `waitForTimeout(300)` | `waitForTimeout(500)` |
| items | loops `items[]`, `scrollIntoViewIfNeeded`, 200ms each | hardcodes `Accession #`, only for `Filing Info` |
| apply | `applyBtn.click()` + 500ms | `applyBtn.click()`, no wait |

**Your framing is right, your proposed fix is not safe yet.** "Should this call
the base method with parameters?" — yes eventually, but the master-checkbox
logic genuinely differs. The base version is state-aware; the fiscal-year one is
not. On a section that is already unchecked they produce **opposite** end states.

**Recommendation:** `configureDisplayColumns({ "Filing Info": ["Accession #"],
"Company Info": [] }, ...)` is the target, but only after someone confirms live
which end state fiscal-year actually needs. Until then this is an **open
question**, and the honest interim fix is to move the local function onto
`SfPage` so it stops being invisible to the next reader.

### 1.7 Other names that fail the "new engineer" test

| Name | File:line | Problem | Suggested |
| --- | --- | --- | --- |
| `rowTexts` vs `rowSpanTexts` | `BasePage.ts:583`, `589` | Both read spans. Only difference is trim+filter. Names give no hint. | `rowSpanTextsClean` / `rowSpanTextsRaw` |
| `okBtn` vs `okBtnLoose` | `BasePage.ts:413`, `507` | "Loose" means case-insensitive regex. Unguessable. | `okBtnExact` / `okBtnAnyCase` |
| `statusTab` vs `statusTabLabels` vs `docsTab` vs `docsTabLabels` vs `backToDocsTab` vs `tabLabels` | `SfPage.ts:241`, `BasePage.ts:130/137/732/123`, `SfPage.ts:161` | **Six** near-identical tab locators across two classes. `SfPage.statusTab` and `BasePage.statusTabLabels` are the *same XPath, character for character*. | See §5.1 — this is dedupe, not renaming |
| `hasDbmDocumentHighlight` | `DbmPage.ts:107` | App name inside a method on the app's own class. `dbm.hasDbmDocumentHighlight()` stutters. | `hasDocumentHighlight()` as an **override** |
| `forEachResultRow` vs `forEachRefRow` | `BasePage.ts:673`, `882` | Neither name says the real difference (id-reuse vs stable data-ref). | See §2 |
| `openDocument` vs `clickViewForRow` | `BasePage.ts:767`, `1040` | Both "open a doc from a row". Difference (waits for body vs does not) is invisible. | `openDocumentAndWait` / `clickRowViewButton` |
| `visibleRows` / `visibleScroller` | `AaPage.ts:22-27` | Good names, and the class comment explains why. **Cite as the standard to copy.** | keep |

---

## 2. Result grid logic consistency

This is where I most disagree with the framing, so I will be blunt.

### 2.1 Current state, measured

Three distinct patterns are live:

| Pattern | Where | Count |
| --- | --- | --- |
| **A** `forEachRefRow` (data-ref, stops when grid stops growing, errors propagate) | `sf-booleanHighlight:48`, `sf-acceleratedStatus:50`, `sf-accountantFees:50`, `sf-accountingStandard:43`, `sf-releaseDate:47`, `sf-snippets:47`, `aoe-clause:45`, `aoe-keywordHighlight:102`, `aoe-releaseDate:46`, `dbm-keywordHighlight:90`, `src-conceptualHighlight:80` | 11 — **all merged/peer-derived** |
| **B** `forEachResultRow` (id-based, de-dupes on reused ids, **swallows row errors**) | `src-crawling:74`, `src-docView:58`, `src-outline:60` | 3 — all yours, all SRC |
| **C** manual: `rowHeight()` + `scrollToRowIndex()` + `rowById()` + `evaluate(scrollIntoView)` | `sf-ixbrl:37-44`, `sf-xbrlParsing:35-42`, `sf-pdee:47-52`, `sf-6kFormType:72`, plus hand-rolled `rows.last().evaluate(scrollIntoView)` loops in `sf-accountant:221`, `sf-auditor:167`, `sf-crawling:129`, `sf-crossReferenceLinks:213`, `sf-boilerPlate`, `dbm-pastRedline:186`, `aoe-accountantMapping:391`, `aoe-dealpoints:276`, `bpc-crawling:60`, `bpc-displayBar:49`, `bpc-profileView:381` | ~16 |

Plus a fourth, `AaPage.findResultRowByIndex` (line 57), which is the only one
with a stagnation guard.

### 2.2 Answer: no, `forEachRefRow` cannot be the one pattern — and it should not be

Three hard blockers in the actual code:

1. **BPC has no `.ReactVirtualized__Grid`.** `BpcPage`'s own class comment
   (lines 7-11) states its rows are outside that wrapper and its lookups accept
   a bare `[id="N"]`. `BasePage.refRows` (line 862) and `scroller` (line 534)
   both assume the virtualized grid. So `bpc-crawler`/`displayBar`/
   `profileCompare`/`profileView` are **structurally excluded**. Listing them in
   the same bucket as the SF flows in the prompt is a mistake.
2. **AA needs `:visible`.** `AaPage` (lines 7-11, 22-27) documents that a stale
   offscreen grid matches first. `forEachRefRow` uses an unscoped
   `page.locator('[data-test="resultRow"][data-ref^="search_"]')` — it would hit
   the stale grid. AA is excluded until `refRows` gains the same `:visible`
   scoping, and that is a behavior change for the 11 flows already using it.
3. **Random-index access is not iteration.** `sf-pdee` (line 36) picks *random*
   indices and needs `rowById(index)`. `forEachRefRow` walks in order. There is
   no version of "iterate every row" that expresses "check rows 3, 7, 11, 19".

There is also a real semantic difference you should not paper over:
`forEachResultRow` **swallows per-row errors** (line 706 `catch { continue }`)
and `forEachRefRow` **does not**. The SRC crawling/docView/outline flows depend
on skip-and-continue; the merged highlight flows depend on a row error failing
loudly. Merging them would silently change which flows can report a false pass.

### 2.3 Recommendation: three named patterns, chosen by a property of the data, not by taste

| Pattern | Use when | Method |
| --- | --- | --- |
| **Iterate every document once, fail loudly** | rows are stable per document (`data-ref`), standard virtualized grid, no doc-view round trip | `forEachRefRow` |
| **Iterate N rows, tolerate bad rows** | you want N samples and a broken row should be skipped rather than abort the scenario | `forEachResultRow` |
| **Address a specific row by position** | random sampling (`sf-pdee`), or "the Nth filing" (`AaPage.findResultRowByIndex`) | `rowById` + `scrollToRowIndex` |

Rename them to encode this: `forEachDocumentRow` (strict, data-ref),
`forEachRowTolerant` (id, skip-on-error), `rowAt` (positional).

Then the ~16 pattern-C sites split cleanly: `sf-accountant`, `sf-auditor`,
`sf-crawling`, `sf-crossReferenceLinks`, `dbm-pastRedline`,
`aoe-accountantMapping`, `aoe-dealpoints` are all hand-rolled
"iterate-and-scroll" and should move to one of the two `forEach*` methods.
`sf-ixbrl`, `sf-xbrlParsing`, `sf-pdee`, `sf-6kFormType` stay positional. BPC
and AA stay on their own, with the class comment as the justification.

**Open questions (behavior):** every pattern-C → pattern-A move changes the
scroll increment (`scrollBy(0, 600)` in `scrollResultGrid`, line 867, vs
`scrollIntoView({block:"start"})`) and the settle wait (300ms vs 500ms). Per
POM-ARCHITECTURE §6.1 these must become parameters that reproduce each caller's
current values, not a silently-chosen "better" default.

### 2.4 Row-locator sprawl: **do not consolidate into one structured-data method**

You asked for an actual recommendation rather than "it depends", so: **keep the
narrow getters. Consolidating them would be a mistake.** Reasons from the code:

- They return **different kinds of thing**. `rowFirstLink`, `rowParagraphs`,
  `rowCheckboxLabel`, `rowViewAllHits`, `rowLabelledSpan`,
  `rowLinksAndParagraphs` return `Locator`s that callers then **act on** —
  `sf-fiscalYear:92` clicks `rowFirstLink`, `sf-pdee:54` calls
  `.check({force:true})` on `rowCheckboxLabel`. A `getRowData()` returning
  strings cannot express that. You would end up with `getRowData()` *plus* all
  six locator getters, which is worse than today.
- A structured read is **strictly more expensive**. `forEachRefRow` runs 25
  times per scenario; `sf-crossReferenceLinks:116-117` needs spans and
  paragraphs, `sf-boilerPlate:154-160` needs texts + one labelled span + a
  combined locator. Eagerly fetching span/p/em/a text for every row multiplies
  round trips for data nobody reads.
- Real usage is already sparse and stable: `rowTexts` has 9 callers,
  `rowSpanTexts` 4, `rowHighlightTexts` 2, `rowViewAllHits` 2, everything else
  1-2. This is not sprawl caused by the merge; it is one small getter per
  distinct DOM shape, which is what a page object is for.

**What I would do instead:** the sprawl is *organisational*, not structural.
Group all of them under one `// ---- Result row: reading ----` /
`// ---- Result row: acting on ----` header pair, and delete nothing. The only
genuine redundancy is `rowTexts` vs `rowSpanTexts` (§1.7).

---

## 3. Base class vs app class vs test file

### 3.0 The decision rule (this is the deliverable for this theme)

POM-ARCHITECTURE §4 already has a two-question rule, and the merge did not break
it — the merge hit cases the rule does not cover. It needs a third axis.

> **Q1. Does it touch `page`?** No → `utils/`. Yes → continue.
> **Q2. Is it a *thing on screen* or a *decision about the test*?**
> A thing on screen (locator, or a click sequence a human would call "one UI
> action") → a page class. A decision (which forms, which columns, how many
> rows, what counts as a pass) → the `-logic.ts` file.
> **Q3. Which page class?** Used by 3+ apps → `BasePage`. Used by 1-2 → that
> app's class, duplicated if 2.

The tiebreaker the merge kept getting wrong, stated as a test:

> **Would this method's body change if the test's business rule changed?**
> If yes, it belongs in the test file, no matter how UI-ish it looks.

`applyAccountantFee("Any Fees")` fails that test. `selectInfoOption(section,
option)` passes it.

The 3+ threshold is deliberately higher than the merge assumed. Two of the six
`BasePage` additions below have exactly one caller.

### 3.1 `SfPage.applyFormTypes` (line 317) — **keep it**

I disagree with the prompt. The code carries its own justification: it uses
`pressSequentially` because "the Forms box parses a `;`-separated list as it is
typed and drops entries when characters arrive faster than its own parsing",
and its default delay is **700ms** vs `fillAndEnter`'s **0**.
`BasePage.fillAndEnter` → `typeValue` → `page.keyboard.type` (lines 90-101) is a
different mechanism (keyboard events at the page level, not the element). These
are not interchangeable, and `sf-accountant:61` proves it: it calls
`fillAndEnter(sf.formsInput, scenario.formType, 200)` with a **single** form
type, where the parsing problem does not arise.

**Recommendation:** keep, rename to `typeFormTypeList` so the "list" part (the
whole reason it exists) is in the name. Callers: `sf-acceleratedStatus:33`,
`sf-accountantFees:33`, `sf-outline:32`.

### 3.2 `BasePage.selectInfoOption` (line 959) — **keep it, but move it**

The prompt asks whether it should be `configureDisplayColumns`. No — and the
existing doc comment (lines 953-958) already argues it correctly:
`configureDisplayColumns` *clears a whole section and re-picks it*, which would
drop a column an earlier call switched on. `sf-accountantFees:45-46` and
`sf-acceleratedStatus:45-46` call it **twice in a row** and need both columns
to survive. Replacing it with `configureDisplayColumns` would break those tests.

The real problem is different: it is additive-only and there is no
`deselectInfoOption`, so column state leaks between flows in a master run.
**Open question**, not a fix.

### 3.3 `SfPage.applyAccountantFee` (line 323) — **you are right, remove it**

One caller (`sf-accountantFees:35`). Body is a generic three-step popup dance
(click input → click label by text → OK) with nothing SF-specific except which
input. And `"Any Fees"` is a *business* choice — it fails the Q2 tiebreaker.

**Recommendation:** delete the method; keep `accountantFeesInput` as a locator
on `SfPage` (correct — it is a thing on screen) and inline the three lines into
`sf-accountantFees-logic.ts`, next to `const FEE_OPTION`. If a second fee flow
appears, promote a generic `pickFromPopupByLabel(input, label)` to `BasePage` —
which is what the body actually is.

### 3.4 Inline Search button — audit

`getByRole("button", { name: /^Search$/i })` inline, where a page object exists:

| File:line | Verdict |
| --- | --- |
| `src-indexing-logic.ts:21` | **Fix.** Constructs the locator by hand while the same file uses `new SrcPage(page)` four times (lines 43-63). Pure merge leftover. |
| `sf-boilerPlate-logic.ts:102` | **Fix**, same. |
| `sf-companyType-SPAC…:76`, `sf-companyType-SRC…:77` | **Fix**, same. |
| `sf-ixbrl:21`, `sf-xbrlParsing:17`, `sf-pdee:22`, `sf-6kFormType:57` | Use `sf.searchBtn.click()` — locator from the page object, click inline. Equivalent to `.search()`. **Cosmetic**, low priority. |
| `bpc-crawling:174-176`, `bpc-displayBar:120-122` | `searchBtn.waitFor({state:"visible"})` **then** click. `.search()` has no wait. **Leave alone** — collapsing loses the wait. |
| `Daily-DataPoints-Sheets/*` (5 files) | Out of scope per POM-ARCHITECTURE §6.6. |
| `aa-indexing:258`, `bpc-profileCompare:82-92`, `example.spec.ts:82` | Commented out. Dead — see §5.4. |

### 3.5 `setCheckboxState("-ExhibitsToFilings", false)` — **you are right, but not for the reason given**

Current state: `BasePage.setCheckboxState` (line 997) is string-keyed by input
id. Callers: `sf-booleanHighlight:32`, `sf-releaseDate:31` (both
`"-ExhibitsToFilings"`), `sf-snippets:38` (`"Snippets"`).

Meanwhile `SfPage.exhibitsToFilingsLabel` (line 56) **already exists** and its
doc comment says it is used by 14 of 16 SF flows and is deliberately exposed as
a locator only, because callers do different things with it. So the merge added
a **second, string-keyed way to reach the same control**, bypassing the named
locator — the exact duplication the consolidation was meant to remove.

Also: the id `"-ExhibitsToFilings"` (leading hyphen) goes into a
`page.locator('#${inputId}')` template. A leading-hyphen CSS id is fragile.

**Recommendation:** keep `setCheckboxState` generic (it is correct and it is the
only place with the "click only if state differs" guard, lines 1001-1005), but
have it accept a `Locator` pair rather than a string, and add
`SfPage.setExhibitsToFilings(include: boolean)` that passes
`exhibitsToFilingsLabel`. That kills the string key and reuses the named locator.
**Open question:** `sf-snippets:38` calls `setCheckboxState("Snippets", true)`
while `BasePage.configureDisplayColumns` has its own `enableSnippets` option
(lines 359, 364-371) that clicks a *different* selector
(`._checkbox_1xotg_249` filtered by text). Two ways to toggle Snippets. Which is
correct needs a live check.

### 3.6 `const statusLocator = sf.statusTab` — **intentional, do not "fix"**

`sf-companyType-SPAC…:81` and `sf-companyType-SRC…:82`. The caller needs a
`Locator` (to count/wait/iterate), not a string. `getTabText` returns a string
and can throw. Different needs, correctly served.

**But** `SfPage.statusTab` (line 241) is a character-identical copy of
`BasePage.statusTabLabels` (line 130). The inconsistency is the duplicate
locator, not the call site. Delete `SfPage.statusTab`, point both callers at
`statusTabLabels`. Zero behavior change — same XPath.

### 3.7 Manual `formsInput.click()` + `keyboard.type()` + `press("Enter")` — audit

Only **one** true instance survives: `sf-companyType-SRC-Shell-WKSI-EGC-logic.ts:69-71`
(`sf.formsInput.click()` … `sf.formsInput.press("Enter")`). Every other SF flow
already uses `fillAndEnter` or `applyFormTypes`.

**Recommendation:** worth aligning, but read the intervening lines first — if
there is a suggestion-dropdown click between the type and the Enter,
`fillAndEnter` is not equivalent. Flagging, not prescribing.
Related: `claude-aa-auditOpinionsAndPolicies-logic.ts:60-76` builds its own
`formsInput` locator and does `click / Control+A / Backspace` — a *clear* step
`fillAndEnter` does not have. Not the same operation; leave it.

---

## 4. Missing error handling

Ground rule tension worth naming up front: POM-ARCHITECTURE §"Ground rules"
item 4 says **"No new assertions, validations, retries, or error handling."**
Everything in this section therefore conflicts with the refactor's own rules and
must be scheduled as **deliberate behavior work**, separately from consolidation.

### 4.1 `sf-pdee-logic.ts` — the worst offender, and worse than you thought

- **Lines 67-74, download loop.** `Promise.all([page.waitForEvent("download"), okBtnLoose.click()])` with **no timeout and no catch**. If the export fails, `waitForEvent` hangs to the global test timeout. In `magic-runner` (no test timeout) it hangs **forever**. This is the most likely cause of a stuck run.
- **Lines 91-97 and this is the real bug: the summary is a hardcoded lie.** `Status: "VALID ✅"` and `Downloads: PDF, DOCX, HTML, Excel (Success)` are string literals. Nothing checks the file exists or is non-empty. The only way this flow reports INVALID is by throwing. A truncated 0-byte PDF reports VALID.
- **Line 87-88.** `await sf.emailBtn.click();` then `sf.okBtnLoose.click();` — **missing `await`**. Floating promise; the flow proceeds to `updateGoogleSheet` while a click is in flight. Genuine bug, one character.
- **Lines 51-56.** `if ((await currentRow.count()) > 0)` — when a row is missing it is silently skipped, yet line 94 still reports `Selected Rows: ${targetIndices.length}` (the requested count, not the selected count).
- **Line 36.** `getRandomIndices(5, 25)` — signature is `(maxRange, count)` (`helpers.ts:267`), so this asks for **25 indices from a range of 5**, and returns 5. Either the arguments are swapped or the intent was 25-from-5. Every other reading of this flow assumes ~25 rows. **Open question — needs your intent.**
- **Lines 16, 41-42.** `clearBtn`, `scroller`, `resultsContainer` assigned and never used.

### 4.2 Merged peer flows — what they lack that yours have

Your originals (`aa-*`, `sf-crawling`, `src-*`) use `RowFinding` /
`formatRowFinding` / `formatScenarioReport` (`helpers.ts:38-91`) and
`cleanErrorMessage` (line 26). **Not one merged flow imports any of them.** They
hand-roll `failures: string[]` and a `scenarioBlock` template instead
(`sf-booleanHighlight:69-80`, `sf-accountantFees:64-74`,
`dbm-keywordHighlight:117-131`, `aoe-keywordHighlight:127-141`,
`src-conceptualHighlight:109-123`, `se-booleanHighlight:68-77`).

Consequences:
- No `stripAnsi`. A Playwright error reaching a failure string writes raw escape bytes to the sheet — the exact problem `helpers.ts:9-17` documents as already solved.
- No per-row `try/catch`. Because `forEachRefRow` does **not** swallow errors (§2.2), one bad row aborts the whole scenario, and the partial `verified` count is never written — the sheet gets nothing, not a partial result.
- `docsVerified` counts *attempts*, not successes: `src-conceptualHighlight:58` increments before any failure branch.

**Recommendation:** adopt `formatScenarioReport` in the merged flows. This
changes the sheet's text format, so it is a **behavior decision**, not cleanup.

### 4.3 Unprotected `waitForSearchResponse`

Every merged flow calls it bare (`sf-booleanHighlight:37`, `src-conceptual:39`,
`se-boolean:36`, `dbm:50`, `aoe:53`, `sf-outline:35`, `sf-accountantFees:38`).
It throws on non-2xx (`BasePage.ts:842`) and on the 90s timeout. Nothing catches
it, so a server hiccup produces an unhandled throw and **no sheet row at all** —
indistinguishable, on the sheet, from "the test never ran". Contrast
`sf-pdee:27-33`, which explicitly writes a VALID row for the no-results case.

### 4.4 Also worth flagging

- `se-booleanHighlight:53-63` loops over **every** highlight in the table with no cap. `KEYWORD = "is or the or a"` on a full day of enforcement documents could be thousands of `getComputedStyle` round trips. Every other flow caps at `MAX_DOCS = 25`.
- `BasePage.forEachResultRow` (line 686) `while (resultsFound < targetCount)` has **no stagnation guard** — if the grid returns fewer rows than `targetCount`, it loops forever. `forEachRefRow` (line 902) has one; `AaPage.findResultRowByIndex` (line 62) has one. The three SRC flows use the unguarded one.
- `BasePage.hasDocumentHighlight` (line 1107) scrolls `document.body`, but the document renders inside an iframe (`documentFrame`, line 442; `clickFirstHighlightedSnippet` uses `frameLocator('iframe[id^="document_"]')`, line 1164). Scrolling the outer body may not lazy-load the iframe's content at all. **Needs live confirmation** — if wrong, every "no highlight in document viewer" failure is suspect.

---

## 5. Dead / redundant code from the merge

### 5.1 Same locator, two homes (highest confidence, zero-risk to fix)

| A | B | Note |
| --- | --- | --- |
| `SfPage.statusTab:241` | `BasePage.statusTabLabels:130` | **Character-identical XPath.** Delete the SF one. |
| `BasePage.addIconIn:152` | `BasePage.filterAddIcon:433` | Same selector, different arg (§1.4). |
| `BasePage.rowById:550` | `SfPage.rowByIdFlat:248` | Differ only in rowgroup scoping (§1.2). |
| `BasePage.docsTab:732` (`span[title^="Docs:"]`) | `SfPage.backToDocsTab:161` (`//span[contains(text(),"Docs:")]`) | Same control, two selectors — one by title attr, one by text. |
| `BasePage.okBtn:413` | `BasePage.okBtnLoose:507` | Exact vs case-insensitive, both in the same class. |
| `SePage.dateInput:26` | `SfPage.dateInput:37` | Identical XPath `//label[text()="Date"]/ancestor::div[5]//input`. SePage's comment claims it differs from SRC's — true — but it is identical to SF's, which the comment does not say. |
| `AoePage.dateInput:29`, `DbmPage.dateInput:29` | both `getByTestId("date-input")` | Same, plus `SfPage.dateInputByTestId:42`. **Three** copies. |

### 5.2 Same function, two homes

**`throwGridStateError` is defined twice, verbatim** —
`BasePage.ts:25-29` and `helpers.ts:217-221`, including the identical 5-line
comment above it (BasePage 19-24 / helpers 212-216). The `helpers.ts` copy is
`const`, not exported, and nothing in `helpers.ts` calls it. **Pure dead code.**

`getCrashScreenLocator` (`helpers.ts:226`) vs `BasePage.crashScreen` (line 167).
Identical body. `helpers` version is exported; grep shows **zero** callers.
`recoverFromAppCrash` (`helpers.ts:229`) is still live (3 callers) and correctly
stays in utils per POM-ARCHITECTURE §"Edge cases".

`AoePage.openDocIntelligizeId` (line 77) overrides
`BasePage.openDocIntelligizeId` (line 928). Only difference: `"Filing Info"` vs
`"Filed"` as the anchor text. The 13 remaining lines are duplicated. Should be
`protected get infoPanelAnchor()` overridden by one string.

### 5.3 Highlight-selector duplication — and a live-confirmed correctness risk

- `DbmPage.hasDbmDocumentHighlight:107` → `hasDocumentHighlight(["customhighlight"])`. Should be a plain override (§1.7).
- **`dbm-keywordHighlight-logic.ts:94` passes `"customhighlight"` to `checkRowHighlights`.** The live check on 2026-08-12 (recorded in `src-conceptualHighlight-logic.ts:84-87`) found a real SRC row had **15 `em.highlight` and 0 `customhighlight`**. SRC was fixed. **DBM and `SePage.tableHighlights:45` were not re-checked.** If DBM rows behave like SRC rows, `dbm-booleanHighlight` and `dbm-conceptualHighlight` currently fail **every** row and report INVALID for a working feature. This is the single highest-value thing to verify live.

### 5.4 Commented-out peer code that survived the merge

- `aa-indexing-logic.ts:258-310` — whole commented search block, superseded by lines 665-717.
- `bpc-profileCompare-logic.ts:82-92` and `bpc-profileView-logic.ts:58-68` — the *same* six commented `fillAndEnter(page, textArea, "AAPL"…)` lines in both, live versions at 354-359 / 321-326.
- `dbm-pastRedline-logic.ts:29`, `sf-accountant-logic.ts:62`, `nal-indexing:38`, `se-indexing:49,72`, `example.spec.ts:82-83`.
- `BasePage.typeValue:92-93` — two commented lines kept **on purpose** (the doc comment says they were tried and rejected). **Keep.** Good precedent for the others: delete, or say why they are staying.

### 5.5 Structural leftovers

- `tests/example.spec.ts` defines its own local `fillAndEnter` (line 14) with a completely different signature (CSS string, not `Locator`). Scaffolding.
- `tests/RO/ro-crawling.ts` and `tests/SE/se-crawling.ts` — `.ts` files in test folders with no `.spec.ts` partner, breaking the `-logic.ts` + `.spec.ts` convention everywhere else.
- Untracked scratch in the repo root: `_append.js`, `_replace.js`, `_tabs.js`, `_reset.js`, `_watch.js`, `_old.txt`, `_new.txt`, plus `hideColumns.js`. Delete or move under a gitignored `scripts/dev/`.
- `.playwright-cli/` — 100+ committed `page-*.yml` / `console-*.log` snapshots. Should be gitignored.

---

## 6. Prioritized list

Ordered by *risk that the suite reports a wrong answer*, not by tidiness.

### P0 — the suite may currently be lying

1. **Verify DBM's row highlight selector live** (`dbm-keywordHighlight-logic.ts:94`, `"customhighlight"`). SRC proved the assumption wrong once. If DBM matches, both DBM highlight tests report INVALID for a healthy feature. Same check for `SePage.tableHighlights:45`. §5.3
2. **`sf-pdee` reports `VALID ✅` unconditionally** (lines 91-97) and hangs forever on a failed download (67-74). Add a real check and a timeout. §4.1
3. **Decide Enter-vs-Search-button** for the six merged flows that never call `.search()`. Today a swallowed Enter is reported as a feature failure. §0
4. **Missing `await` on `sf.emailBtn` / `okBtnLoose.click()`** (`sf-pdee:87-88`). One character. §4.1
5. **Confirm `hasDocumentHighlight` scrolls the right document** (`BasePage:1107` scrolls `document.body`, content is in an iframe). If wrong, every doc-viewer highlight failure across SF/AOE/DBM/SRC is suspect. §4.4

### P1 — will cause a stuck or unreportable run

6. **Stagnation guard for `forEachResultRow`** (`BasePage:686`) — infinite loop when the grid yields fewer rows than `targetCount`. Affects all three SRC flows. §4.4
7. **Wrap `waitForSearchResponse`** so a search failure writes an INVALID row instead of vanishing from the sheet. §4.3
8. **Cap `se-booleanHighlight`'s highlight loop** (lines 53-63) at `MAX_DOCS` like every other flow. §4.4
9. **Resolve `getRandomIndices(5, 25)`** in `sf-pdee:36` — needs your intent. §4.1

### P2 — zero-behavior-change dedupe (do these together, they are safe)

10. Delete `throwGridStateError` and `getCrashScreenLocator` from `helpers.ts` — both dead, one is a verbatim duplicate. §5.2
11. Delete `SfPage.statusTab`; point its 2 callers at `BasePage.statusTabLabels` — identical XPath. §3.6
12. `filterAddIcon` delegates to `addIconIn`; keep both entry points. §1.4
13. `AoePage.openDocIntelligizeId` → override one anchor string, not 13 lines. §5.2
14. `hasDbmDocumentHighlight` → plain `hasDocumentHighlight` override. §1.7
15. Replace inline Search-button construction in `src-indexing:21`, `sf-boilerPlate:102`, `sf-companyType-*:76/77`. Leave BPC's waited version alone. §3.4
16. Delete commented-out peer blocks (§5.4) and the root scratch files; gitignore `.playwright-cli/`. §5.5

### P3 — naming and structure, once the above is stable

17. Adopt the three named grid patterns and migrate the ~7 hand-rolled loops. Every move needs its scroll-step and settle-wait preserved as parameters. §2.3
18. Renames: `getTabText` → `waitForResultTabState`; `rowByIdFlat` → `rowByIdUnscoped`; `parseCount` → `digitsToNumber`; `applyFormTypes` → `typeFormTypeList`; `okBtnLoose` → `okBtnAnyCase`; `rowTexts`/`rowSpanTexts` → `…Clean`/`…Raw`. §1
19. Remove `SfPage.applyAccountantFee`, inline into its one test. §3.3
20. Move `checkListItem` / `pickerRowCheckboxIcon` to `BasePage`. §1.5
21. Group the row getters under reading/acting headers. **Do not consolidate them.** §2.4
22. Adopt `formatScenarioReport` in the merged flows — changes sheet format, so schedule as behavior work. §4.2

### Open questions (need your decision or a live check, not a patch)

- Is `configureFiscalYearColumns`'s unconditional double-click on the master checkbox correct, or is `configureDisplayColumns`'s state-aware version? They diverge when a section starts unchecked. §1.6
- Two ways to toggle Snippets (`setCheckboxState("Snippets", true)` vs `configureDisplayColumns({enableSnippets:true})`) hit different selectors. Which is right? §3.5
- Should `selectInfoOption` gain a deselect, given column state leaks between flows in a master run? §3.2
- Does `sf-companyType-SRC…:69-71`'s manual type sequence have a suggestion click between type and Enter? If so `fillAndEnter` is not equivalent. §3.7
- `parseCount("Docs: 1 of 20")` → `120`. Does any caller pass a string of that shape? §1.3
- Does `rowByIdFlat`'s unscoped lookup exist for a reason, or is it a copy-paste? If nobody can say, it should be deleted, and that is a behavior change. §1.2
