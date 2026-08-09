# Planner — Explore Before You Write

Applies to any app in this repo — SEC Filings, SEC Enforcement, No-Action
Letters, Accounting Analytics, or any future app added to the suite.

## The core discipline: two phases, never merged into one

Always split work into two separate steps, with a stop between them:

1. **Exploration phase** — use playwright-cli to walk the actual flow
   live, on the specific app being worked on. Report what you find. Do
   NOT write test code in this phase.
2. **Generation phase** — write code using ONLY the selectors/behavior
   confirmed in phase 1, for that app.

Never do both in one continuous pass. Merging them is the single most
common cause of broken generated code in this repo's history — the model
starts generalizing/guessing selectors instead of using what it actually
saw, especially once the exploration output scrolls out of recent
context.

## What "confirmed" means, concretely

A selector is confirmed only if you have done ONE of:
- Read it directly from a DevTools/snapshot dump of the real DOM, on the
  actual app and page being tested
- Clicked it live and verified the expected effect happened (e.g. read
  `isChecked()` before and after a click and confirmed only the intended
  element's state changed)
- Read it from an existing, already-passing test file for that same app

A selector is NOT confirmed if it was:
- Pattern-matched from a different field's structure, OR from a
  different app's similar-looking field, on the assumption the structure
  is the same ("Forms worked with this xpath shape on App A, so this
  field on App B probably has the same shape")
- Guessed from the label text alone without inspecting the DOM
- Copied from a component library's typical structure

## Build a locator table during exploration — mandatory, before any code

Don't just narrate findings in prose. For every field/control touched
during exploration, record one line in an explicit table, decided in the
moment you confirm it — not reconstructed later from memory during
codegen:

| Field | Confirmed selector | Strategy tier (1-5, see above) | Notes |
|---|---|---|---|
| Forms | `#Forms input` | 2 (simple CSS id) | |
| New Accounting Disclosures | `#NewAccountingDisclosuredAndPoliciesFilter input` | 1 (real id, confirmed via DevTools) | note app's own typo in the id |
| Early Adopted checkbox | `label[for="earlyAdopted"]` | 3 (label/for pairing) | outer div click silently no-ops — do not use |

Rules for this table:
- Every row must already meet the "confirmed" bar from above — no row for
  a field you only guessed at.
- If two possible selectors were tried and one failed (e.g. clicking the
  outer div vs. the label), record BOTH the failure and the working one —
  this prevents regenerating the failed version later.
- This table is the ONLY source of truth for locators during the
  generation phase (see generator.md). Generation must consume this table
  directly, not re-derive selectors from label text or a different app's
  pattern. If generation needs a selector that isn't in the table, that's
  a signal exploration was incomplete — go back and confirm it live
  before writing that line of code, don't fill the gap with a guess.

## `toBeVisible()` is not enough — verify the state the action actually needs

A visible element is not necessarily an interactable one. Confirmed real
case: a checkbox was simultaneously visible AND disabled — a script that
only checked `toBeVisible()` before clicking got false confidence; the
click silently did nothing because the element was disabled, not because
it was hidden.

Before recording a locator as "confirmed" for an action, verify the
SPECIFIC property that action depends on, not just presence:
- About to click something → check it's not disabled (not just visible)
- About to read a checkbox's state → read the state, don't infer it from
  whether the click "seemed to work"
- About to interact with a field → check whether it's currently enabled,
  and if not, identify what needs to happen first to enable it (a
  confirmed real case: a set of checkboxes stayed disabled+checked/inert
  until a DIFFERENT field's value was committed first — order of
  operations was itself part of what needed confirming, not just the
  selector)

## Record the actual commit mechanism per field — don't assume it's uniform

Two fields can look identical in structure (same typeahead-input pattern)
and still commit their value differently. Confirmed real case: one
typeahead field required clicking an exact-match suggestion from a
dropdown; a different field on the SAME page committed on pressing `Tab`
instead — clicking a suggestion never appeared as an option for it.

For every typeahead/autocomplete-style field, explicitly test and record
in the locator table HOW its value gets committed (click a suggestion,
press Tab, press Enter, etc.) — never assume it matches a similar-looking
field just because the input structure looks the same.

## A locator can be context-dependent — record what view/tab it requires

Some locators are only valid while a specific tab/view is active.
Confirmed real case: a filter checkbox's `label[for=...]` locator threw
"not found" not because the id changed, but because the script was on a
document detail view at that point in the flow, not the results/filter
view where that control lives. If a locator worked earlier in a flow and
then "disappears" later, check whether the current view changed before
assuming the selector itself is wrong — record in the table which
view/tab each locator requires.

## Prefer stable attributes, in this order

1. A real `id` or `data-notice`/`data-testid` attribute on the element or
   a close stable ancestor (confirmed via DevTools, not assumed)
2. A simple CSS id selector if one exists (`#Forms`) over a long xpath
3. `label[for="..."]` when the target has a real `for`/`id` pairing —
   confirmed reliable for checkbox-style controls on at least one app in
   this suite, since clicking the outer wrapping `<div>` was found to
   silently no-op or click through to an unrelated element. Verify this
   holds on whichever app you're currently working on — don't assume.
4. Hashed CSS-module class names (`styles__xyz___3ONua`) are a last
   resort only — these are build-hash-dependent and can change on
   redeploy. If you must use one, flag it in a comment as fragile.
5. Text-matching (`:has-text`, `text=/.../`) is the least reliable —
   it can match multiple unrelated elements page-wide. Scope it to a
   specific container whenever possible; never leave it unscoped across
   the whole page.

## Live-verify checkbox/toggle-style controls specifically

These have caused real bugs on at least one app in this suite. Before
trusting a checkbox locator, on whichever app you're testing:
- Click it, then immediately check `isChecked()` on it AND on every
  sibling control that should be unaffected — confirm ONLY the intended
  one changed. A click that silently no-ops or affects the wrong element
  will not throw an error; it fails silently unless you check state.
- Check whether the control is disabled under some prior condition (order
  of operations can matter and won't be obvious from the DOM alone — e.g.
  a filter that stays inert until a different field is committed first).

## Exploration prompt template

```
Using playwright-cli in --headed mode, open <app>, log in if needed.
Perform each step one at a time — after each one, take a fresh snapshot
and report exactly what you observed before moving to the next step.
Do NOT write any test code in this phase.

<numbered steps for the specific flow, on THIS specific app>

For every field/control you interact with, decide and record its
strategy-tier selector (see the priority order above) in a locator table
as you go — not narrated prose you'd have to re-derive later. End the
report with the complete table, one row per field.

Rules:
- One action per command. Never chain with ; or &&.
- Fresh snapshot before every click/fill — never reuse an older ref.
- Check for an existing browser session before opening a new one — don't
  restart unnecessarily.
- For any control whose effect isn't obvious from a snapshot (checkboxes,
  toggles), verify its state before and after interacting with it.
- Report the ACTUAL selector/id/attribute you used or found on THIS app
  — never a generalized guess carried over from a different app.

Stop and report after the last step, with the completed locator table.
Do not proceed to writing code.
```