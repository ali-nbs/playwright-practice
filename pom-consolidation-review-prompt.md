# Prompt: POM Consolidation — Architecture Review Request

Act as a senior software engineer (10+ years) doing an architecture review
of this repo's POM consolidation — not as an assistant trying to agree with
me. Where you think my instinct is wrong, or a cleaner design exists, say so
explicitly and propose your alternative. I want a second opinion, not
validation.

## Task

Analyze the current codebase (my original test cases + what got merged in
from the peer repo during POM consolidation) and produce a **draft review
document** — no code changes yet. The draft should cover the concerns below,
organized by theme, each with your recommendation and reasoning. I will
review and discuss before anything gets implemented.

## Ground rules (same as POM-ARCHITECTURE.md)

- This review can recommend renames/restructuring, but do not silently
  change runtime behavior while doing so — flag anywhere a "cleanup" would
  also require a behavior decision, and list it as an open question instead
  of just doing it.
- Every recommendation needs a reason grounded in the actual code (cite the
  file/function), not a general best-practice platitude.

## Concerns to analyze

Go through each theme and give a concrete recommendation.

### 1. Naming

Several functions/getters have names that don't describe what they do or
are misleading:

- `getTabText` — rename to something that reflects it reads a tab's
  status/count text
- `rowByIdFlat` — unclear what "Flat" means; if it returns full row data
  including buttons, name it accordingly
- `parseCount` — vague; rename to reflect it parses a count out of tab
  text specifically
- `addIconIn` vs `filterAdd`/`filterPlsBtn` — two names for what appears
  to be the same action; consolidate to ONE name, pick the clearer one
- `checkListItem`, `pickerRowCheckboxIcon` — audit for reuse potential,
  rename to be generic if they're not actually SF-specific
- `configureFiscalYearColumns` duplicating `configureDisplayColumns` — is
  a separate function justified, or should this call the base method with
  parameters?

Go through the full codebase for other names that fail the test: "would a
new engineer understand what this returns/does from the name alone,
without reading the implementation?"

### 2. Result grid logic consistency

This is the biggest concern. Result grid scroll + row-processing logic is
NOT consistent across `sf-accountant`, `sf-auditor`, `sf-boilerplate`,
`sf-ixbrl`, `sf-xbrlParsing`, `dbm-pastRedline`,
`bpc-crawler`/`displayBar`/`profileCompare`/`profileView`, `AOE`. Some use
`forEachRefRow`, some use manual `scrollToRowIndex` + `rowById` +
`evaluate scrollIntoView`, some mix both.

- Is `forEachRefRow` powerful/generalized enough to be the ONE pattern for
  all of these, or does grid behavior genuinely differ enough between
  apps/screens (e.g. result grid vs result grid + doc view + back-to-grid)
  to justify more than one shared pattern?
- If more than one pattern is justified, define exactly which pattern each
  use case should use and why, so it's not decided per-file ad hoc going
  forward.
- Result grid row-locator sprawl: `rowSpanTexts`, `rowParagraphTexts`,
  `rowHighlightTexts`, `rowLinkTexts`, `rowFirstLink`,
  `rowLinksAndParagraphs`, `rowParagraphs`, `rowCheckboxLabel`,
  `rowViewAllHits`, `rowLabelledSpan`, `labelledValue` — this is a lot of
  narrow getters on the same row concept. Should these consolidate into
  fewer, more general methods (e.g. one method that returns structured row
  data, rather than 10 separate single-purpose getters)? Give your actual
  recommendation, not just "it depends."

### 3. Base class vs app class vs test-file placement

Several things got put in the wrong layer during merge:

- `applyFormTypes` added in SF class instead of using the existing
  `fillAndEnter` helper — should this exist at all, or be removed in favor
  of `fillAndEnter`?
- `selectInfoOption` added instead of using `configureDisplayColumns` from
  base class — same question.
- `sf.applyAccountantFee(FEE_OPTION)` — is this a base-class-worthy shared
  behavior, an SF-class method, or actually specific to ONE test case and
  shouldn't be a class method at all (i.e. belongs directly in that test's
  `-logic.ts` file)?
- Redundant inline
  `page.getByRole("button", { name: /^Search$/i }).first().click()`
  appearing directly in test files when `sf.search()` / base class
  equivalent already exists — audit for every place this duplication
  happens.
- `await sf.setCheckboxState("-ExhibitsToFilings", false)` — should there
  be a named locator + check/uncheck method for this specific checkbox
  instead of a generic string-keyed `setCheckboxState` call?
- `const statusLocator = sf.statusTab` used instead of `getTabText` — is
  this an inconsistency to fix, or intentional based on what the caller
  actually needs (locator vs text)?
- Manual `sf.formsInput.click()` + `page.keyboard.type()` +
  `sf.formsInput.press("Enter")` used instead of `fillAndEnter` in
  multiple files — audit every occurrence.

Give a clear **decision rule** (not just examples) for "when does
something belong in base class vs app class vs the test file itself" —
the current merge clearly didn't apply one consistently.

### 4. Missing error handling

Flag any test flow with no failure path, e.g. `sf-pdee`: what happens if
the download fails? Go through the merged peer code specifically for
missing error/failure handling that my original test cases had and the
peer code didn't, or vice versa.

### 5. Dead/redundant code from the merge

Anywhere the peer repo's version and my version of the same concept both
survived the merge (e.g. two functions doing the same thing under
different names) — list every instance found, not just the ones already
listed above.

## Deliverable

A single markdown draft, organized by the 5 themes above, each item with:
current state (cite file/function), your recommendation, and your
reasoning. Where you disagree with how I framed a concern above, say so
and explain why. End with a **prioritized list** — what to fix first given
risk/impact, not just an unordered list of findings.

**Do not write or edit any code yet. This is the draft-and-discuss
phase.**
