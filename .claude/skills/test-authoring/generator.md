# Generator — Writing the Actual Test Code

Applies to any app in this repo.

## Reuse existing helpers, don't reinvent them

Before writing new interaction logic for ANY app, check
`tests/utils/helpers.ts` for an existing helper that already does it.
Confirmed existing helpers in this repo include `fillAndEnter`,
`getTabText`, `parseCount`, `closeAllOpenTabs`. Prefer these over
hand-rolled `page.keyboard.type` / manual focus+clear sequences — the
helpers already encode fixes for issues like stale field content (see
healer.md #2). This applies regardless of which app the test targets —
these helpers are shared infrastructure, not app-specific.

## Don't reuse a selector pattern from a different feature, even in the same file/app

Confirmed real case: a highlight-verification check used `<em>` as the
highlighted-text selector, copied from a DIFFERENT function's convention
in the same app (a keyword-highlight check elsewhere in the repo). It
looked like a reasonable assumption — both are "highlighted text in an
iframe" — but this feature's actual highlighting used a completely
different element (`<span class="acctItem-highlight ...">`), so the check
silently failed every time, even against a manually-confirmed-correct
click. The two features happened to share a superficial description
("highlighted text") but not an implementation.

Every distinct verification target needs its own live confirmation of the
actual rendering mechanism — never assume "this looks like that other
highlight/badge/status check I already wrote" is safe to reuse without
checking. This applies within one file, across files in the same app, and
across apps — the scope of "different context, don't assume" is broader
than just "different app."

## Locators come from the exploration table, not from generation-time guessing

Before writing any `page.locator(...)` call, check the locator table
produced during the planning/exploration phase (see planner.md). Use
exactly what's there. If a selector needed for the code being written
isn't in that table, that's a sign exploration was incomplete — stop and
go confirm it live, don't fill the gap with a plausible-looking guess.
This is the most common way generated code silently regresses to a
weaker selector than what was already found working.

## Keep locators as simple as the DOM allows

Don't default to a long xpath climb if a simpler selector already works,
on whichever app is being tested. Priority order (see planner.md for the
full reasoning):
1. `#id` / `[data-testid]` / `[data-notice]` if a stable one exists
2. Simple CSS (`page.locator("#Forms").locator("input")`)
3. `label[for="..."]` for checkbox/toggle-style controls
4. xpath climbs — only when nothing simpler is confirmed to work
5. Text-matching — last resort, always scoped to a container

## Graceful fallback over hard failure, where the app's behavior is variable

When a control might be reached more than one way (e.g. a checkbox that's
sometimes better clicked via its label, sometimes needs a direct
`.check()`), prefer a fallback pattern over assuming one path always
works:
```typescript
(await label.isVisible())
  ? await label.click()
  : await checkbox.check({ force: true });
```
This is more resilient than either a single hard-coded path or a thrown
error — reserve throwing (see healer.md) for cases where NO reasonable
path exists, not for "the primary path didn't work, try a fallback."

## Structural rules — non-negotiable, all caused real bugs when skipped

- **Never declare the same `const` name twice in one function scope.**
  Basic, but happened — it's a compile error, not a logic bug, and wastes
  a full debug cycle to catch.
- **Never call a cleanup function like `closeAllOpenTabs(page)` and then
  continue using `page` afterward in the same function.** If cleanup runs
  mid-function, either the function ends there, or cleanup is deferred to
  the actual end.
- **Never leave a plan as comments instead of implementing it.** A
  comment describing what a loop should do (`// do that for 5 docs`,
  `// repeat steps`) is not code. If the logic isn't implemented, say so
  explicitly rather than submitting it as if it were done — see the
  "run it for real before reporting done" rule below.
- **Never invent a file, command, or script that hasn't been confirmed to
  exist.** If a helper script would be useful, create it explicitly and
  confirm it exists before referencing it — don't assume a prior turn
  created something it didn't.

## Grid/virtualized-list processing pattern (confirmed working)

For any app with a virtualized results grid: drain the full current
visible batch of unprocessed rows before scrolling, scroll exactly once
per outer-loop pass, always pair scrolling with a stagnation counter, and
use a stable row id (not a positional index) to detect already-processed
rows across scrolls. This pattern is app-agnostic — apply it anywhere a
`.ReactVirtualized__Grid` or similar virtualized list appears.

## Before reporting a task done

Always run the file for real and confirm it actually passes:
```bash
npx playwright test <file>
```
Do not report success, or hand back generated code, without having run
it. Static-looks-correct is not the same as verified-working — several
real bugs in this repo's history (duplicate declarations, dangling
`page.pause()`, stale-ref chaining) would have been caught immediately by
an actual run and were not caught because the code was handed back
unverified.

## When a confirmed-working reference exists for a similar flow

If another app's test already solves a similar problem (e.g. a
graceful-fallback checkbox toggle, a scroll-and-verify grid loop), read
that file as a concrete reference before writing new logic from scratch
— a real working example is a better anchor than a description of the
pattern. Do not assume its exact selectors transfer to a different app;
only the structural pattern does (see planner.md).