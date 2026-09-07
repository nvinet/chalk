# Chalk

An iOS app that replaces a gym training spreadsheet. Offline, portrait-only,
single user. No accounts, no analytics, no ads, no network calls — the data
lives on the device and nothing leaves it without an explicit action.

## Why it exists

The spreadsheet it replaces had two levels: a training day, and the exercises
used on it. That is the limitation that prompted the app. Existing trackers
were not a fit either — they assume a session goes to plan, so every deviation
becomes a negotiation with the interface. If the bench is taken, Chalk lets
another chest exercise satisfy chest, and nothing is recorded as "missed".

## The model

Three levels: **family → muscle group → exercise.**

- A **family** is a training day: push, pull, legs, abs, cardio.
- A **muscle group** sits inside a family and is what a session is scored on.
- An **exercise** sits under one or more muscle groups, possibly across
  families. Hammer curl is biceps and forearms — one movement, two groups.

Exercises, not machines. Equipment is not modelled: the original spreadsheet
called a column "SM incline bench press", and so does the catalogue.

Abs and cardio have no muscle groups; internally they carry a single implicit
group so one completion rule covers every family.

### A set names its muscle group

A set records both the exercise and the muscle group it was performed for.
Logging hammer curl for biceps does nothing for forearms, and the same exercise
may legitimately appear twice in a session as two entries for two groups.

Because the set is explicit about this, Chalk needs no primary/secondary muscle
weighting. Other trackers carry one because they *infer* which muscles a set
worked and must discount secondaries. Chalk is told, so its numbers are exact.

### Completion

1. An exercise counts as logged for a group when a set against that pairing
   records **reps and weight**, or a duration for a timed exercise. A weight of
   0 is valid (bodyweight sled); 0 reps is not.
2. A muscle group succeeds when the number of **distinct exercises** logged
   against it reaches its required count. Many sets on one exercise count once.
   A required count of 0 means optional — trainable, never blocking.
3. A session succeeds when every group in its requirements has succeeded.

Required counts are set per muscle group **per family**, and are snapshotted
onto a session when it starts, so changing a family's configuration never
retrospectively fails a past session.

### The pairing

History, "last time", charts and personal bests are all keyed on
`(exercise, muscle group)` — never on the exercise alone. Hammer curl for biceps
and hammer curl for forearms are different histories with different weights.

## Stack

Expo + React Native, with SQLite via Drizzle for persistence. Chosen over
SwiftUI because the app has no server, no login and no sync, and momentum
matters more than the native polish gap. This is a permanent choice rather than
a step toward a native rewrite; portability comes from keeping `src/domain/`
pure and from SQLite being directly readable by any future native app.

Expo 57 / React Native 0.86 / React 19. See
[the versioned Expo docs](https://docs.expo.dev/versions/v57.0.0/) — the API has
changed substantially in recent versions.

## Status

Early. The repository currently holds the Expo starter scaffold under `src/`
plus the planning material in `docs/`. The domain layer, database schema and
session-logging screens described above are designed but not yet built.

Several decisions are still open and are listed in `docs/decisions.md` — most
significantly the required exercise count per group (Q27), and which exercises
belong under abs and cardio (Q28, both families currently empty). These block
the corresponding features; they are questions to ask, not to guess at.

Targets are deliberately out of v1 (D16).

## Getting started

```bash
npm install
npm start        # then press i for the iOS simulator
```

Other scripts:

```bash
npm run ios      # expo start --ios
npm run android  # expo start --android
npm run web      # expo start --web
npm run lint     # expo lint
```

Routing is file-based via `expo-router`, with screens under `src/app/`.

## Layout

The model splits in two, and the split runs through every layer. **Catalogue**
is what exists to be trained: reference data, seeded once, edited rarely.
**Sessions** are what actually happened: written constantly, and irreplaceable
— the catalogue can be re-seeded, a session cannot.

```
src/
  domain/       pure TypeScript: the rules. No React, Drizzle or Expo
    types.ts      barrel over types/catalogue.ts and types/sessions.ts
    completion.ts the completion rule
    scoring.ts    volume, estimated 1RM, personal bests, "last time"
  db/
    schema.ts     barrel over schema/{catalogue,sessions,config}.ts
    repository.ts catalogue queries, returning domain types
    mappers.ts    Drizzle rows in, domain types out
    client.ts     openDatabaseSync + the Drizzle handle
    migrate.ts    applies migrations on launch
  app/          screens and routes (expo-router)
  components/   presentation
  __tests__/
drizzle/        generated migrations — never edit by hand
docs/
  decisions.md              what was agreed, and why
  wireframes/               14 screens, plus a navigation map
```

Import from `types.ts` and `schema.ts`, not from the parts beneath them. The
barrels are the public surface, which keeps the seam free to move.

### Why the layers are separate

`src/domain/` holds the completion rules, progression maths and taxonomy as
**pure TypeScript** — no React, no Drizzle, no Expo, not even type imports. It
is the part worth keeping if the app is ever rebuilt natively, and the part
testable without a simulator. If it decides something it belongs there; if it
draws something it does not. `mappers.ts` is the seam that enforces it.

`src/db/` holds the Drizzle schema. Weight is stored canonically in kilograms
and distance in metres, converted only for display. Every set is written to
SQLite as it is entered, never batched at the end of a session — a crash
mid-session must lose nothing.

**One database, deliberately.** Four foreign keys run from sessions into the
catalogue, and SQLite does not enforce foreign keys across attached databases.
Every history, chart and personal best is keyed on the (exercise, muscle group)
pairing, so a set pointing at an exercise that no longer exists would break
"last time" silently. That is why exercises and muscle groups archive rather
than delete.

## Conventions

- TypeScript `strict`, with `noUncheckedIndexedAccess`.
- Portrait only, everywhere, including iPad — iPad is a wider view of the same
  data, not a different layout.
- Touch targets ≥ 44pt, primary actions in the lower third and reachable with
  one thumb.
- Never block logging. Warn on an implausible value; never reject it.

## License

MIT — see `LICENSE`.
