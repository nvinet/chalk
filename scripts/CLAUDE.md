# Chalk

An iOS app that replaces a gym training spreadsheet. Expo + React Native,
SQLite via Drizzle, **entirely offline**, **portrait only**, single user.

Full plan: `docs/Chalk - project plan v0.2.docx`. Agreed decisions: `docs/decisions.md`.
Read `docs/decisions.md` before changing anything in `src/domain/`.

## The model — get this right, everything depends on it

Three levels: **family → muscle group → machine.**

- A **family** is a training day: push, pull, legs, abs, cardio.
- A **muscle group** sits inside a family and is what a session is scored on.
- A **machine** sits under one or more muscle groups, **possibly across
  families**. The Smith machine is chest and shoulders in push, and quads in
  legs. It is *one* machine row, not three.

Abs and cardio have **no muscle groups**. They are modelled with a single
`implicit: true` group so one completion rule covers every family. Never show
an implicit group in the UI.

### A set names its muscle group

`SetEntry` carries **both** `machineId` and `muscleGroupId`. Logging the Smith
machine for chest does nothing for shoulders. The same machine may appear twice
in one session as two separate entries for two groups — that is correct
behaviour, not a duplicate.

This is why Chalk has **no primary/secondary muscle concept**. Other trackers
need it because they infer which muscles a set worked. Chalk is told. Do not
add inference, weighting, or "counts as half a set" logic.

### The completion rule

1. A machine counts as logged for a group when at least one **working** set
   against that pairing records whatever that machine measures: **both reps and
   weight**, or a duration, or a distance. Weight may be `0` — a bodyweight
   machine is still a weighted machine (D14). Reps may not be 0.
   **Warm-up sets never count** (D15): not for completion, not for personal
   bests, not for volume.
2. A muscle group succeeds when the number of **distinct machines** logged
   against it reaches its required count. Many sets on one machine count once.
   **A required count of 0 means optional** — shown, trainable, never blocking.
3. A session succeeds when every group in its requirements has succeeded.

Required counts live **per muscle group per family**, so chest can require two
on push day and something else elsewhere.

Requirements are **snapshotted onto the session** when it starts. Changing a
family's counts must never retrospectively fail a past session.

### The pairing

History, "last time", charts and personal bests are all keyed on
`(machineId, muscleGroupId)` — **never on the machine alone**. Smith machine for
chest and Smith machine for shoulders are different histories with different
weights. Showing the wrong one mid-set is worse than showing nothing.

## Architecture rules

**`src/domain/` is pure TypeScript.** No React, no Drizzle, no Expo, no
`react-native` imports — not even types. It is the part worth keeping if the app
is ever rebuilt natively, and the part testable without a simulator.

> If it decides something, it goes in `domain/`. If it draws something, it does not.

- Weight is stored canonically in **kilograms**, converted only for display.
- Every set is written to SQLite **as it is entered**, never batched at the end.
  A crash mid-session must lose nothing.
- Data lives on the device. Nothing leaves without an explicit user action.

## Commands

```bash
npm test          # node --experimental-strip-types --test — no install needed
npm run typecheck # tsc --noEmit
npm run db:generate  # drizzle-kit generate, after editing src/db/schema.ts
npm run fixtures  # regenerate test fixtures from the original spreadsheet
npm start         # expo start
```

`npm test` runs on the TypeScript source via Node's built-in runner. It must
stay dependency-free — do not add vitest or jest.

## Tests are the specification

`src/__tests__/completion.test.ts` scores **the eleven sessions actually logged
in the spreadsheet** and asserts the exact outcome for each. Those expectations
were computed independently from the raw file before the code existed.

**If a change makes those tests fail, the change is wrong** unless a decision in
`docs/decisions.md` has changed too. Five of eleven pass. The important cases:

- `pull-20260829` — four back machines, no curls. Biceps must read **zero**.
- `push-20260830` — lateral raises recorded as `"Done"` with no numbers. Must
  **not** count.
- `legs-20260831` — hack squat recorded `"No"`; quads still met via the quad
  extension.

## Conventions

- TypeScript `strict` with `noUncheckedIndexedAccess`.
- Portrait only. No landscape layouts anywhere, including iPad.
- Touch targets ≥ 44pt; primary actions in the lower third, one-thumb reachable.
- Never block logging. Warn on an implausible value; never reject it.
- No accounts, no analytics, no ads, no network calls.

## Do not

- Do not write `tracking === "duration"`. There are three tracking types
  (`weightReps | duration | distance`, D12) and that comparison silently treats
  distance as a weights machine. Ask whether the measure is weight-based.
- **Do not use Realm.** Deprecated Sept 2024; Device Sync shut down Sept 2025.
- **Do not put training data in AsyncStorage.** No queries, indexes or schema.
- Do not add primary/secondary muscle weighting (see above).
- Do not infer a muscle group from a machine. Ask, or read it off the set.
- Do not import the old spreadsheet. That was dropped deliberately — the
  spreadsheet is the source of the *taxonomy*, not of data.

## Open questions — ask, do not guess

These are unanswered and marked in `docs/decisions.md`. If a task needs one,
stop and ask rather than inventing an answer:

- **Q27** — required machine count per group. Forearms currently ships as `0`.
- **Q28** — which machines belong under Abs and Cardio. Both are empty, and each
  one named also needs its measure (D12).
- **Q25, Q26, Q6** — the seed taxonomy is still a proposal, not confirmed.
- **Q9** — which families fall on which days. The schedule shape is settled by
  D13; the values are not.
