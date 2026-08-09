# Healer — Diagnosing Stuck or Failing Tests

Applies to any app in this repo — the causes below are patterns, not
tied to any one app's specific DOM.

## The definition of "done": the whole file runs end-to-end, not one fix

Fixing the first blocker is not the task. A file with 5 sequential steps
can have 5 separate, unrelated bugs — fixing step 1's blocker often just
reveals step 2's, which was previously unreachable. Treat every "healer"
task as a loop, not a single diagnose-and-patch action:

```
1. Run the file.
2. If it fails/hangs, diagnose THAT specific failure (see below).
3. Fix ONLY that specific issue.
4. Run the file again from the top.
5. If a NEW failure appears further along, go to step 2 for that new
   failure.
6. Repeat until the file completes successfully end-to-end, OR until
   every remaining failure has been reported as a distinct, named issue
   that could not be resolved (never silently stop partway through
   without saying so).
```

Do not report a task as fixed after step 3 of the first pass. Do not stop
after removing the first hang and call it done — that's fixing a
symptom, not completing the healing. The task is only complete when
either (a) a full run passes, or (b) you've explicitly told the user
"fixed X, but hit a new, different issue at Y — here's what I found."
Silently stopping after one fix, without confirming what happens next in
the file, is the single most common way a "fixed" test turns out to still
be broken.

## First question: is it actually hung, or just slow/waiting?

Before treating anything as "stuck," rule out these specific known causes
in this repo's history — check each one before doing live debugging:

1. **`page.pause()` left in the code.** This is Playwright's interactive
   debugger breakpoint — it deliberately freezes the ENTIRE script until
   a human manually clicks "Resume" in the Inspector UI. It is not a way
   to inject a value mid-run. If a script "hangs" and `page.pause()`
   appears anywhere in the call path, that's the cause — remove it.
2. **An input field wasn't cleared before being reused.** Calling a
   fill/type helper twice on the same field without clearing it first
   (e.g. selecting one value then another on the same field) can leave
   both values concatenated in the input, which then never matches an
   exact-text suggestion filter — `toBeVisible` waits its full timeout
   looking for a match that will never appear. Always clear
   (`Ctrl+A` + `Backspace`, or use an existing helper like
   `fillAndEnter` that already handles this) before typing into a field
   that may have prior content.
3. **A scroll-and-retry loop with no exit condition.** If a loop scrolls
   a virtualized grid looking for more rows, and nothing tracks whether
   scrolling is actually producing new content, it can loop forever once
   the grid is exhausted or the target count was miscounted upstream.
   Always pair scroll-and-retry with a stagnation counter that breaks
   after N attempts with no progress.
4. **Scrolling inside a per-row processing loop**, not once per batch.
   Virtualized-list components (`.ReactVirtualized__Grid` and similar)
   unmount/remount rows on scroll — scrolling mid-loop shifts what index
   `i` points to, silently skipping rows. Always fully drain the current
   visible batch first, THEN scroll once, THEN re-query fresh — never
   interleave. This pattern is app-agnostic — any virtualized list
   anywhere in this suite is at risk of the same bug.

## When it's a genuine selector/DOM problem, not a code-logic bug

Don't guess a fix from re-reading the static code a second time — that's
how the same wrong assumption gets repeated. Attach live instead:

```bash
npx playwright test <file> --debug=cli
```
This pauses the real test at the start and prints a session name. Then,
in the SAME harness (Claude Code / Gemini CLI), attach and inspect:
```bash
playwright-cli attach <session-name>
playwright-cli snapshot
playwright-cli eval "() => /* whatever specific state needs checking */"
```

Rules while doing this, regardless of which app:
- One command at a time. Never chain with `;` or `&&` — a click can
  change the DOM, invalidating refs from before it, so every action needs
  its own fresh snapshot before the next one.
- Never restart the browser session if one is already open and attached —
  check with `playwright-cli list` first.
- Report the SPECIFIC live state that confirms or refutes the hypothesis
  (e.g. "scrollTop was 4200 before and after — scroll is not moving the
  grid" or "resultsFound stayed at 3 across two scroll attempts — no new
  row ids appeared") before proposing a fix. A fix proposed without this
  confirmation is a guess, not a diagnosis.

## Fail fast, don't hang silently

When writing or fixing a helper function for ANY app, prefer an explicit
short timeout plus a descriptive thrown error over letting Playwright's
default `toBeVisible` timeout run its full course with a generic message:

```typescript
try {
  await expect(someLocator).toBeVisible({ timeout: 8000 });
} catch {
  throw new Error(
    `<function name>: could not find <specific thing> for <specific label/context> ` +
    `on <app name>. <hypothesis about why, if known>`
  );
}
```
This turns a multi-minute silent stall into an immediate, readable failure
that names exactly what broke and on which app — critical for keeping
debug/fix cycles short instead of re-running a whole long session to find
out what's wrong.

## Before re-running the whole suite to test a fix

Narrow scope first while diagnosing ONE specific failure — don't pay for
a full run just to confirm one small fix:
- Reduce to 1 scenario / 1 document / 1 iteration while iterating on that
  specific bug
- Use `npx playwright test --trace on` once, then replay the trace with
  `npx playwright show-trace` for pure logic bugs that don't need another
  live hit against the real site

This narrowing is a diagnostic convenience, not an exit condition. Once
the narrow case passes, widen back to the full scope and continue the
end-to-end loop from the top section of this doc — narrowing doesn't
excuse skipping the full run before declaring the file done.