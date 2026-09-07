#!/usr/bin/env bash
#
# Creates the Chalk backlog: labels, milestones and issues.
#
#   gh auth login
#   cd <your repo>
#   bash scripts/bootstrap-issues.sh
#
# Safe to re-run: label and milestone creation failures are ignored, but
# ISSUES ARE NOT DEDUPLICATED — running twice creates duplicates.
#
set -uo pipefail

echo "Creating labels..."
label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null 2>&1; }

label "area:taxonomy"  "0E8A16" "Families, muscle groups, machines, mappings"
label "area:session"   "1D76DB" "Logging a session — the core loop"
label "area:plan"      "5319E7" "Today, weekly plan, adherence"
label "area:progress"  "B60205" "History, charts, personal bests, targets"
label "area:data"      "FBCA04" "Persistence, export, backup, migrations"
label "area:infra"     "666666" "Tooling, CI, build, release"
label "type:feature"   "A2EEEF" "New capability"
label "type:chore"     "CFD3D7" "Plumbing and maintenance"
label "type:test"      "BFD4F2" "Tests and verification"
label "type:decision"  "D93F0B" "Needs a human answer before work can start"
label "must"           "B60205" "v1 does not ship without it"
label "should"         "FBCA04" "v1 is poorer without it"
label "could"          "C2E0C6" "Nice, if cheap"
label "blocked"        "000000" "Waiting on a decision"

echo "Creating milestones..."
milestone() {
  gh api "repos/{owner}/{repo}/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 \
    && echo "  + $1" || echo "  = $1 (exists)"
}
milestone "M0 Decisions"       "Answers needed before or during build. Owner: the athlete."
milestone "M1 Taxonomy"        "Data model, storage, seed catalogue and the taxonomy editors."
milestone "M2 Log a session"   "The core loop. If we ship only M1+M2 the project is a success."
milestone "M3 Today and Plan"  "Weekly plan, adherence, quick logging."
milestone "M4 Progress"        "History, charts, personal bests, targets."
milestone "M5 Data"            "Backup, restore, resilience."
milestone "M6 Polish and ship" "iPad, accessibility, TestFlight, four-week trial."

issue() {
  local title="$1" milestone="$2" labels="$3" body="$4"
  gh issue create --title "$title" --milestone "$milestone" --label "$labels" --body "$body" \
    >/dev/null && echo "  + $title" || echo "  ! FAILED: $title"
}

echo "Creating issues..."

# ---------------------------------------------------------------- M0 decisions
issue "Decide what a 'target' actually is (Q3)" "M0 Decisions" "type:decision,area:progress,must" \
"The last open question that changes the shape of anything.

Is a target a weight on a machine by a date? A number of sessions per week? Sets per muscle group per week? All three?

\`docs/decisions.md\` Q3. Blocks all of §8.4 and the Targets screen (W9). Everything currently in the plan for targets is a guess."

issue "Confirm the seed muscle group assignments (Q25)" "M0 Decisions" "type:decision,area:taxonomy,must" \
"Review \`src/db/seed.ts\` against how the machines actually feel in the gym.

Specifically:
- Rear delt row is under **shoulders** — right?
- Hammer curl is mapped to **biceps and forearms** — right?
- Hips is one group covering abduction and adduction. Should it be two?

Everything downstream depends on this."

issue "Confirm which machines serve several muscle groups (Q26)" "M0 Decisions" "type:decision,area:taxonomy,must" \
"The seed maps the Smith machine (chest, shoulders, quads), the cable station (triceps, back, forearms), the bench press (chest, triceps) and the hammer curl (biceps, forearms).

Which others? This mapping is where the model earns its keep and it is cheap to get right now."

issue "Set the required machine count per muscle group per family (Q27)" "M0 Decisions" "type:decision,area:taxonomy,must" \
"This IS the completion rule. Default is 1 everywhere.

Forearms currently ships at **0 (optional)** because it has one machine and failed all three historical pull sessions. Decide deliberately rather than inheriting.

Do this with §3.4 of the plan open — it shows what each setting would have done to real sessions."

issue "Name the machines for Abs and Cardio (Q28)" "M0 Decisions" "type:decision,area:taxonomy,must" \
"Both families exist and are wired to an implicit muscle group, so the completion rule already covers them — but they have no machines, so nothing can be logged.

Cardio machines record **time**, not weight. Also answers Q29: is time enough, or is distance needed too?"

issue "Decide how the app gets onto the phone (Q16)" "M0 Decisions" "type:decision,area:infra,must" \
"Three options:
- Free personal provisioning — expires every 7 days, needs a Mac to reinstall. Fine for the build, unusable long term.
- Apple Developer Program (~GBP 79/yr) + TestFlight — 90-day builds, one-tap reinstall.
- App Store — same cost plus review, screenshots, privacy label, support.

Needed **before M2** so the whole build is tested through the real install path."

issue "Identify the unnamed legs exercise (Q6)" "M0 Decisions" "type:decision,area:taxonomy,should" \
"The legs sheet had a seventh exercise in unnamed columns, used 21 and 31 August: 30 reps @ 27.5 kg, then 10 @ 25 kg. What is it? It needs a name to enter the library."

issue "Hack squat logged at 0 kg — bodyweight or uncounted sled? (Q7)" "M0 Decisions" "type:decision,area:taxonomy,should" \
"\`isSetLogged\` currently accepts weight 0 as valid, on the assumption the sled is bodyweight-loaded.

If the answer is 'the sled just isn't counted', that machine needs a reps-only tracking type and the rule changes."

issue "Set the weekly frequency target per family (Q9)" "M0 Decisions" "type:decision,area:plan,should" \
"How many times a week for each of push, pull, legs, cardio, abs? Seeds the weekly plan. The old tick sheet implied all five, most days."

# ------------------------------------------------------------------- M1
issue "Wire Drizzle to expo-sqlite" "M1 Taxonomy" "type:chore,area:data,must" \
"\`openDatabaseSync\` with \`enableChangeListener: true\`, the \`drizzle-orm/expo-sqlite\` driver, and the \`useLiveQuery\` hook available to screens.

Migrations must be bundled into the app: Metro does not resolve \`.sql\` files by default, so the Drizzle Babel plugin and metro/babel config changes are required. Add the Drizzle Studio dev plugin while you are there.

Acceptance: the app opens a database on device and a trivial query returns."

issue "Generate the initial migration from the schema" "M1 Taxonomy" "type:chore,area:data,must" \
"\`npm run db:generate\` against \`src/db/schema.ts\`, committed to \`drizzle/\`.

Migrations are versioned from the first release — no future version may orphan his history (N9)."

issue "Seed the catalogue on first launch" "M1 Taxonomy" "type:feature,area:taxonomy,must" \
"Load \`src/db/seed.ts\` into the database on first run. Idempotent: safe to run on every launch, must never duplicate or overwrite edits he has made.

Acceptance: fresh install shows 5 families, 12 muscle groups, 21 machines, and the Smith machine appears under chest, shoulders and quads."

issue "Repository layer for catalogue queries" "M1 Taxonomy" "type:feature,area:data,must" \
"Thin functions returning domain types from Drizzle rows: families, muscle groups for a family (with required counts), machines for a muscle group (with variant labels), machine by id.

The domain layer must stay free of Drizzle imports — mapping happens here."

issue "App shell: expo-router tabs, portrait lock, theme tokens" "M1 Taxonomy" "type:feature,area:infra,must" \
"Five tabs: Today, History, Progress, Plan, More. Portrait locked in \`app.json\` for both iPhone and iPad (N1).

Theme tokens for light and dark from the start — retrofitting colour is worse than doing it now. Minimum touch target 44pt as a shared constant."

issue "Family editor screen (W10)" "M1 Taxonomy" "type:feature,area:taxonomy,must" \
"Ordered list of muscle groups in a family, each with a required-machine-count selector (0-3+).

0 must be labelled clearly as optional — it is the release valve for single-machine groups. Reordering, adding and removing groups.

Editing a family must never alter sessions already logged (requirements are snapshotted)."

issue "Machine editor screen (W11)" "M1 Taxonomy" "type:feature,area:taxonomy,must" \
"Name, tracking type (reps+weight | time), weight increment, default rest, notes.

'Used for' section: map to any number of muscle groups, **including across families**, each with an optional variant label ('incline press', 'squat').

The screen should state the rule plainly: logging for one group does not count for another."

issue "Machine library list with alias search" "M1 Taxonomy" "type:feature,area:taxonomy,should" \
"Browse and search all machines. Search must match aliases, so typing 'peck fly' or 'hax squat' finds the corrected names.

Archive rather than delete when a machine has logged sets."

issue "CI: typecheck and test on every push" "M1 Taxonomy" "type:chore,area:infra,should" \
"GitHub Actions running \`npm run typecheck\` and \`npm test\`.

\`npm test\` needs no dependencies — it runs on the TypeScript source via Node's built-in runner — so the test job can be very fast."

# ------------------------------------------------------------------- M2
issue "Start a session and snapshot its requirements" "M2 Log a session" "type:feature,area:session,must" \
"Starting a session for a family copies the current required counts onto the session (\`session_requirements\`).

Acceptance: raising chest from 1 to 2 machines afterwards does not change the outcome of the session already logged."

issue "Session screen: muscle groups with progress (W2)" "M2 Log a session" "type:feature,area:session,must" \
"The spine of a session. Lists the family's muscle groups, each showing machines logged against the required count, and which machines were used.

Optional groups (required 0) sit in their own section. Progress reads '2 of 3 muscle groups met'. Finish is always reachable.

Uses \`evaluateSession\` from the domain layer — do not reimplement the rule in the UI."

issue "Muscle group screen: machines with last time (W3)" "M2 Log a session" "type:feature,area:session,must" \
"Every machine mapped to this group, each showing what he last did **on that machine for that muscle group** (\`lastTimeForPairing\`).

This is the screen that makes a busy gym a non-event: if the bench is taken, another chest machine satisfies chest."

issue "Log a machine: per-set entry (W4)" "M2 Log a session" "type:feature,area:session,must" \
"Header names both the machine and the muscle group it is being logged for.

Set rows; next set pre-filled from the last one; large +/- steppers using the machine's increment; tap a number for a keypad. Add and remove sets freely.

Target N4: repeating a set is one tap; changing the weight and logging is no more than three."

issue "Persist every set as it is entered, and resume an interrupted session" "M2 Log a session" "type:feature,area:data,must" \
"Writes are committed per set, never batched at the end (N7).

Acceptance: force-quit the app mid-set, reopen, and the session resumes exactly where it stopped with nothing lost. This is a required manual test before every release."

issue "Skip a machine or muscle group with a reason" "M2 Log a session" "type:feature,area:session,must" \
"Reasons: machine busy, machine broken, injury, short of time, other.

A skipped group with a required count above 0 fails the session honestly rather than silently. A skipped set never counts as logged."

issue "Use a machine not yet mapped to the group, mid-session" "M2 Log a session" "type:feature,area:session,should" \
"He should never be blocked mid-session by a missing mapping. Let him pick any machine, log against the current group, and offer to make the mapping permanent afterwards."

issue "Warn on implausible values without rejecting them" "M2 Log a session" "type:feature,area:session,should" \
"'408 kg — did you mean 40?' inline, dismissible.

Never block logging. Wrong data that can be corrected later beats an argument in the middle of a set. The 408 kg in the original spreadsheet is the motivating case."

issue "Rest timer with background notification" "M2 Log a session" "type:feature,area:session,should" \
"Per-machine default, starts when a set is logged, survives backgrounding.

On iOS from React Native this is a **scheduled local notification** at the end time rather than a real background timer. Same behaviour for the user, different implementation.

Haptic on completion."

issue "Session summary screen (W5)" "M2 Log a session" "type:feature,area:session,should" \
"Verdict first — successful or not, by his own rule — then the evidence: each muscle group and how it was met. Then duration, sets, volume, personal bests, notes.

Personal bests come from \`personalBestsInSession\`, detected not entered."

issue "Keep the screen awake during a session" "M2 Log a session" "type:chore,area:session,must" \
"\`expo-keep-awake\`, active only while a session is in progress (G3). Release it on finish or abandon."

issue "CSV export" "M2 Log a session" "type:feature,area:data,must" \
"One row per set, carrying machine **and** muscle group, through the iOS share sheet.

Deliberately in M2 rather than M5: there must always be a way out of the app from the moment real data goes in."

issue "Gym test: two real sessions before adding anything else" "M2 Log a session" "type:test,area:session,must" \
"Not a code task. Use the build for two real sessions in the actual gym.

Count taps against N4. If logging is slower than the spreadsheet, nothing else in the backlog matters — fix that first."

# ------------------------------------------------------------------- M3
issue "Today screen (W1)" "M3 Today and Plan" "type:feature,area:plan,must" \
"What is due today, one tap to start it, this week at a glance across all five families.

The suggested family is the one furthest behind the weekly plan; overriding it must be one tap away."

issue "Weekly plan and adherence (W6)" "M3 Today and Plan" "type:feature,area:plan,must" \
"Target frequency per family, a week view navigable in both directions, and progress against target.

**Attendance and success are different measures** (C3) and both are shown: a session counts toward the weekly target once anything is logged, whether or not every group succeeded."

issue "Quick log for abs and cardio" "M3 Today and Plan" "type:feature,area:plan,should" \
"Making abs and cardio proper families removed the one-tap tick they had in the spreadsheet. That may be more ceremony than abs deserves (Q30).

A minimal path: log the family as done with one machine and no fuss."

issue "Streak and adherence summary" "M3 Today and Plan" "type:feature,area:plan,could" \
"Weeks meeting the plan. Note Q19 — streaks motivate some people and pressure others. Keep it removable."

# ------------------------------------------------------------------- M4
issue "History list and calendar (W7)" "M4 Progress" "type:feature,area:progress,must" \
"Sessions by date, newest first, filterable by family. Calendar marks the family trained and whether the session succeeded — filled for all groups met, hollow for some missed.

Any session opens for editing."

issue "Progress browsing: family to muscle group to machine (W8)" "M4 Progress" "type:feature,area:progress,must" \
"The same three levels used everywhere else, so there is nothing new to learn."

issue "Chart per pairing with target line" "M4 Progress" "type:feature,area:progress,must" \
"Top-set weight over time for a (machine, muscle group) pairing, from \`topSetSeries\`, with the active target drawn on it.

Toggle to estimated 1RM and volume."

issue "Sets and volume per muscle group" "M4 Progress" "type:feature,area:progress,should" \
"Exact, not estimated — every set names its group, so nothing is attributed by guesswork. This is the payoff for the data model.

\`volumeByMuscleGroup\` already exists in the domain layer."

issue "Personal bests list" "M4 Progress" "type:feature,area:progress,should" \
"Across all pairings: heaviest, best estimated 1RM, best set volume."

issue "Targets: create, edit, track" "M4 Progress" "type:feature,area:progress,must" \
"**Blocked by Q3.** A target belongs to a (machine, muscle group) pairing, not to a machine alone.

Status computed, never set by hand. Achieved targets kept with their date rather than deleted."

issue "Edit any historical set" "M4 Progress" "type:feature,area:data,must" \
"The app is a notebook, not a form. Any past set editable or deletable, with the session's outcome recomputed from its snapshotted requirements."

# ------------------------------------------------------------------- M5
issue "iCloud backup and restore" "M5 Data" "type:feature,area:data,should" \
"His own iCloud, no account, no server. Acceptance: restore onto a wiped device with nothing lost."

issue "JSON backup export and import" "M5 Data" "type:feature,area:data,should" \
"A complete round-trip of the database, distinct from the CSV export which is for reading elsewhere."

issue "Migration test harness" "M5 Data" "type:test,area:data,should" \
"Prove that a database created by an earlier release opens correctly under the current schema. Cheap now, expensive to retrofit after a year of real data."

# ------------------------------------------------------------------- M6
issue "iPad portrait two-pane layout (W13)" "M6 Polish and ship" "type:feature,area:session,should" \
"Muscle groups left, the chosen group's machines right. Portrait only.

Touch targets stay phone-sized rather than stretching; extra width goes to context. Check Q14 first — if the iPad is only ever a sofa device this is worth much less."

issue "Dark mode" "M6 Polish and ship" "type:feature,area:infra,should" \
"Following the system setting. Should be nearly free if theme tokens went in at M1."

issue "Dynamic Type and VoiceOver" "M6 Polish and ship" "type:feature,area:infra,should" \
"N10. React Native supports both but neither comes free — avoid fixed heights, keep \`allowFontScaling\` on, label every control.

The known weak spot of the stack choice, so budget real time."

issue "TestFlight setup and install" "M6 Polish and ship" "type:chore,area:infra,must" \
"Depends on Q16. EAS Build produces iOS builds without a Mac; EAS Update pushes JavaScript fixes without a new build, which matters when you are the support desk for someone mid-session."

issue "Four-week trial" "M6 Polish and ship" "type:test,area:infra,must" \
"Success criterion S1: four consecutive weeks logged in Chalk without opening the spreadsheet.

Do not archive the spreadsheet until this passes."

echo
echo "Done. Next:"
echo "  1. Create a Project (board) in the repo's Projects tab."
echo "  2. Add a built-in workflow to auto-add new issues to it."
echo "  3. Start with the M0 Decisions milestone — most of it is not yours to answer."
