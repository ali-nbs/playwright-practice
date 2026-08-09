---
name: test-authoring
description: >
  Repo-wide conventions for writing and fixing Playwright tests against
  any app in this platform (SEC Filings, SEC Enforcement, No-Action
  Letters, Accounting Analytics, and others), using playwright-cli for
  live DOM verification. Covers three phases of the work — planning/
  exploring, healing/debugging, and generating/writing code — as three
  separate reference docs. Applies to every app, not just one.
---

# Test Authoring

This skill exists because of real, repeated failures observed while
writing tests for apps on this platform — skipped verification, guessed
locators, stuck scripts mistaken for hangs, and generated code that
ignored what live exploration had already found. Each doc below is a
direct response to a specific failure that actually happened, generalized
so it applies regardless of which app is being tested.

Read in this order, depending on the task:

- **`planner.md`** — before writing ANY new test, for any app. How to
  explore the live app and confirm selectors before touching code.
- **`healer.md`** — when a test is stuck, hanging, or failing, for any
  app. How to diagnose using live browser state instead of guessing from
  static code.
- **`generator.md`** — when actually writing/editing test code, for any
  app. Style and structure conventions for this repo, based on what has
  been confirmed to work.

## The one rule that overrides everything else

**Never write a locator for a field you haven't confirmed live, on
whichever app you're currently working on.** Every failure this skill was
built from traces back to this rule being skipped — including assuming a
selector pattern that worked on one app's field would work on a different
field, or a different app entirely, without checking. Each app on this
platform may structure its filters/controls differently; a pattern
confirmed on one is a starting hypothesis for another, never an
assumption.
