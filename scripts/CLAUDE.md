# Chalk

An iOS app that replaces a gym training spreadsheet. Expo + React Native,
SQLite via Drizzle, **entirely offline**, **portrait only**, single user.

Full plan: `docs/Chalk - project plan v0.2.docx`. Agreed decisions: `docs/decisions.md`.
Read `docs/decisions.md` before changing anything in `src/domain/`.

## The model — get this right, everything depends on it

Three levels: **family → muscle group → exercise.**

- A **family** is a training day: push, pull, legs, abs, cardio.
- A **muscle group** sits inside a family and is what a session is scored on.
- An **exercise** sits under one or more muscle groups, **possibly across
  families**. Hammer curl is biceps and forearms — one movement, two groups.

Exercises, not machines (D17). The Smith machine is not a row; "SM incline
bench press" is. Equipment is not modelled — it lives in the name, exactly as
the original spreadsheet had it.

Abs and cardio have **no muscle groups**. They are modelled with a single
`implicit: true` group so one completion rule covers every family. Never show
an implicit group in the UI.

### A set names its muscle group

`SetEntry` carries **both** `machineId` and `muscleGroupId`. Logging the Smith
exercise for chest does nothing for shoulders. The same exercise may appear twice
in one session as two separate entries for two groups — that is correct
behaviour, not a duplicate.

This is why Chalk has **no primary/secondary muscle concept**. Other trackers
need it because they infer which muscles a set worked. Chalk is told. Do not
add inference, weighting, or "counts as half a set" logic.

### The completion rule

1. An exercise counts as logged for a group when at least one **working** set
   against that pairing records whatever that exercise measures: **both reps and
   weight**, or a duration, or a distance. Reps may not be 0. Weight of `0` is
   still accepted — logging is never blocked — but on a bodyweight exercise it
   is an incomplete entry: he enters his bodyweight as the load (D14), so warn
   on a 0 rather than treating it as correct.
   **Warm-up sets never count** (D15): not for completion, not for personal
   bests, not for volume.
2. A muscle group succeeds when the number of **distinct exercises** logged
   against it reaches its required count. Many sets on one exercise count once.
   **A required count of 0 means optional** — shown, trainable, never blocking.
3. A session succeeds when every group in its requirements has succeeded.

Required counts live **per muscle group per family**, so chest can require two
on push day and something else elsewhere.

Requirements are **snapshotted onto the session** when it starts. Changing a
family's counts must never retrospectively fail a past session.

### The pairing

History, "last time", charts and personal bests are all keyed on
`(exerciseId, muscleGroupId)` — **never on the exercise alone**. Hammer curl for
biceps and hammer curl for forearms are different histories with different
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

## Tests

`npm test` runs 60 tests on synthetic sessions — the completion rule, warm-up
exclusion, the three tracking types, the pairing, the mappers, and seed
integrity. All of them run; none are skipped.

**The eleven historical sessions are gone** (D18). They were once described here
as the specification, scored from the spreadsheet with expectations computed
independently of the code. That stopped being true twice over: the spreadsheet
is no longer the taxonomy source, and D17 invalidated the expectations anyway —
`legs-20260831` flips now that hack squat is the only whole-leg exercise.

So there is no oracle outside the code any more. Treat the rule tests as the
closest thing: if a change makes them fail, be sure a decision in
`docs/decisions.md` changed too.

The seed integrity tests are worth keeping green for a duller reason — they
catch the likeliest seed bug, a typo in an id, before it becomes a foreign key
failure on first launch.

## Conventions

- TypeScript `strict` with `noUncheckedIndexedAccess`.
- Portrait only. No landscape layouts anywhere, including iPad.
- Touch targets ≥ 44pt; primary actions in the lower third, one-thumb reachable.
- Never block logging. Warn on an implausible value; never reject it.
- No accounts, no analytics, no ads, no network calls.

## Do not

- Do not write `tracking === "duration"`. There are three tracking types
  (`weightReps | duration | distance`, D12) and that comparison silently treats
  distance as a weights exercise. Ask whether the measure is weight-based.
- **Do not use Realm.** Deprecated Sept 2024; Device Sync shut down Sept 2025.
- **Do not put training data in AsyncStorage.** No queries, indexes or schema.
- Do not add primary/secondary muscle weighting (see above).
- Do not infer a muscle group from an exercise. Ask, or read it off the set.
- Do not import the old spreadsheet. That was dropped deliberately — the
  spreadsheet is the source of the *taxonomy*, not of data.

## Open questions — ask, do not guess

These are unanswered and marked in `docs/decisions.md`. If a task needs one,
stop and ask rather than inventing an answer:

- **Q27** — the required exercise count per group per family. Everything ships
  as `1`, which means a successful legs session needs all five of its groups.
- **Q20** — rest by feel or by the clock, and how long.
- **Q11** — body weight and measurements, deliberately out of v1.

The taxonomy is settled (D18), and so is the plan: the schedule is defined by
hand and nothing is seeded (D19), and abs uses the normal session flow rather
than a quick-log path (D20).
