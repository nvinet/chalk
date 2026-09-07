# Chalk — decisions and open questions

The durable record of what was agreed and why. `CLAUDE.md` is the short version
loaded into every session; this is the reasoning behind it.

Source: `docs/Chalk - project plan v0.2.docx` (§3 taxonomy, §7 data model, §15 questions).

---

## Agreed

### D1 — Three levels of taxonomy
**Family → muscle group → machine.** The spreadsheet had only two (family →
machine), which is the limitation that prompted the app. Abs and cardio have no
muscle groups and go family → machine directly; internally they carry one
implicit group so a single completion rule covers everything.

### D2 — A session is composed of muscle groups, not machines
The session screen lists muscle groups. Machines are chosen inside a group, at
the moment of training. This is the answer to the commonest complaint about
existing trackers: they assume the session goes to plan, so every deviation
becomes a negotiation with the interface. If the bench is taken, another chest
machine satisfies chest and nothing is "missed".

### D3 — Completion is configurable and proportional
A muscle group succeeds at N distinct machines logged; a session succeeds when
all its groups do. N is set per group **per family**. N = 0 means optional.

Verified against the eleven historical sessions (§3.4 of the plan): five pass —
a different five from the spreadsheet's own rule. Legs improves from one to
three because a missed hack squat no longer sinks the session. Pull fails every
time on forearms, which has one machine that was skipped both times it appeared.
That finding is why **forearms ships with a required count of 0** pending Q27.

### D4 — Machines map to many muscle groups; each use counts once, for one group
The mapping says what a machine *can* be used for. Credit comes only from a set
naming the group. The same machine can be logged twice in a session for two
groups.

**Consequence:** no primary/secondary muscle distinction is needed. Hevy,
StrengthLog and GymBook carry one because they infer which muscles a set worked
and must weight secondaries (commonly at half a set). Chalk is told at logging
time, so its numbers are exact. Do not reintroduce inference.

**Granularity superseded by D17.** The claim that the Smith machine is "one row,
not three" was wrong about the *unit*, not about the rule. The catalogue now
models exercises, so those three are three rows. Everything above survives
unchanged: the mapping still only says what is possible, credit still comes only
from a set naming the group, and nothing is inferred.

### D5 — A machine counts only when properly recorded
Reps **and** weight, or a duration. Weight of 0 is valid (bodyweight sled);
reps of 0 is not. The spreadsheet's `"Done"` and `"N/A"` entries came from
logging at home from memory — exactly what the app exists to prevent — and must
not count.

### D6 — Per-set logging
The spreadsheet's single number per exercise is gone. Sets are individual rows.

### D7 — No import of the old spreadsheet
Starting clean. Eleven sessions of one-number-per-exercise data would not be
comparable with anything logged afterwards. The spreadsheet remains the source
of the exercise library and taxonomy only.

### D8 — Cardio records time, not weight
Tracking type lives on the machine (`weightReps` | `duration`), so cardio needs
no special case in the completion rule.

**Widened by D12:** a third type, `distance`, was added. The principle here —
one tracking type per machine, no special case in the rule — is what survived,
and is why D12 stayed cheap.

### D9 — Stack: Expo + React Native, SQLite via Drizzle
Chosen over SwiftUI because the developer is productive in React and momentum
matters more than the native polish gap for an app with no server, no login and
no sync.

**Taken as permanent, not as a step toward a native rewrite.** Portability comes
from architecture: `src/domain/` stays pure, and SQLite is directly readable by
a future Swift app.

### D10 — Name: Chalk
Agreed 7 Sep 2026, replacing the working title "Gym Progression", which sat too
close to Alpha Progression and was unsearchable. Nothing on the App Store uses
Chalk. If it ever ships publicly, run a proper UK IPO trademark check first.

### D11 — Distribution: Apple Developer Program + TestFlight
Agreed 7 Sep 2026 (issue #6, answering Q16). Personal provisioning was rejected
because a build expires after seven days, which would mean re-installing mid-week
to keep training. TestFlight builds last 90 days.

The developer already holds a paid Apple Developer Program membership, so the
annual cost that Q16 raised is settled and is not a factor.

**App Store publication is deferred, not rejected.** It stays possible once the
app is in good shape, but it carries admin work that is deliberately not being
started now. Nothing in the build should assume App Store review — no
subscription plumbing, no marketing metadata.

### D12 — Cardio records duration *or* distance, one per machine
Agreed 7 Sep 2026 (issue #51, answering Q29). `TrackingType` becomes
`weightReps | duration | distance`. Jogging and swimming are distance; HIIT and
rowing are duration.

Distance is stored canonically in **metres** and displayed in kilometres, for the
same reason weight is stored in kilograms (G1).

**Laps were rejected.** A lap is meaningless without the pool length, so 80 laps
at one pool is not comparable with 80 at another — it would corrupt a history the
first time he swam somewhere else.

**One measure per machine, not per set.** An earlier reading of the answer let
swimming be logged as either time or distance interchangeably. Dropping that is
what kept this change small: the measure stays a property of the machine, so
nothing moves onto `SetEntry`, the call sites that branch on `machine.tracking`
keep their shape, and each machine keeps exactly one comparable history for
charts and "last time".

**The trap this creates.** Every guard in the engine was written as
`tracking === "duration"` — meaning "duration versus everything else, and
everything else is weights". A third value silently makes "everything else"
wrong: `bestsForPairing` would record a heaviest of 0, `personalBestsInSession`
would emit a bogus 0 kg best after every run, `lastTimeForPairing` would read
"1x0 @ 0 kg" instead of "5.0 km", and `topSetSeries` would chart a flat line of
zeroes. Those guards must become a predicate (`isWeightBased`) **in the same
change as the enum**, not after it.

Cardio stays out of personal bests for now, as timed machines already are.
Whether "furthest" and "longest" count as bests is really Q3's question, and
belongs to M4.

**Consequence for Q28 (#5):** naming a cardio machine now also means declaring
its measure. That is no longer a separate decision.

### D13 — The weekly plan is a configurable schedule, not a frequency count
Agreed 7 Sep 2026 (issue #9, answering part of Q9). The routine alternates the
muscle family across the week, and the schedule is editable when it is created
or changed.

**This makes `families.times_per_week` the wrong shape.** An integer per family
expresses "push twice a week" but cannot express an order, so it cannot say
push then pull then legs. The draft schema in `src/db/schema.ts` still carries
that column and it should be replaced by a schedule table before the first
migration (#54, #11).

**Still open:** which families fall on which days, and how often. The shape is
decided; the values are not. Q9 stays open for those.

### D14 — Bodyweight work is entered as a weight, by hand
Agreed 7 Sep 2026 (issue #8, answering Q7). A bodyweight-loaded machine such as
the hack squat sled is recorded with a real number: **he works out his bodyweight
and enters it as the weight.** It is not left at 0, and it is not a separate kind
of machine.

**No reps-only tracking type is needed.** `TrackingType` stays at the three
values D12 settled, and every lift behaves the same way.

**The app never asks for his bodyweight and never stores it.** He supplies the
number when he logs. That keeps body-weight tracking out of v1 (Q11) while still
giving bodyweight machines a comparable load to chart.

**0 kg stays accepted, but now means something different.** The rule is
unchanged — `isSetLogged` still takes a weight of 0 as valid, because logging is
never blocked (N-rule). But a 0 on a bodyweight machine is now an *incomplete*
entry rather than a correct one, so it is a good candidate for the implausible
value warning in #26. It must warn, never reject.

**No code change to the completion rule**, and the historical fixtures keep the
outcomes they were computed with.

### D15 — Warm-up sets are recorded, and count for nothing
Agreed 7 Sep 2026 (issue #52, answering Q21). `SetEntry` gains a warm-up flag.
A warm-up set is kept, and is excluded from personal bests and from session
completion — a warm-up alone must never count a machine as logged for a group.

**Volume too — confirmed 7 Sep 2026.** The exclusion belongs in `isSetLogged`,
which is what both the completion rule and all of `scoring.ts` go through, so
warm-ups drop out of volume as well as bests and completion. One predicate, one
meaning of "a set that counted": a warm-up is not working volume.

### D16 — Targets are dropped from v1
Agreed 7 Sep 2026 (issue #1). Q3 asked what a target actually is; the answer is
that the app does not need them yet. Revisit only if it is ever worth gamifying.

**Consequences:**

- The `targets` table comes out of `src/db/schema.ts` before the first
  migration. It was fully specified while the question that defines it was
  unanswered — exactly the risk #54 exists to avoid.
- #41 (targets: create, edit, track) and the target line in #38 leave v1.
- Wireframe W09 has no v1 screen behind it.

### D17 — The catalogue models exercises, not machines
Agreed 7 Sep 2026 (issue #56). `Machine` becomes `Exercise`, and the `variant`
label disappears into the exercise name. One row per column of the original
spreadsheet.

**Two reasons.** Cardio broke the old name: D12 made jogging and swimming
distance-tracked, and neither is a machine. And "machine" was never the grain
the source data used — the spreadsheet columns are already exercises. The cable
station appears as three of them ("cable pull up", "cable forearm curl",
"trycept pushdown"); the Smith machine appears as "SM incline bench press". The
generated seed collapsed those into machine + variant, which was a modelling
choice made in code rather than something the data did. D7 makes the
spreadsheet the source of the taxonomy, so the taxonomy should match it.

**Equipment is not modelled.** It lives in the name, as it did in the
spreadsheet. Add a field only when a screen needs one — D2 already answers the
"the bench is taken" case by offering another exercise for the same muscle
group.

`SkipReason.machineBusy` and `machineBroken` become `equipmentBusy` and
`equipmentBroken`: it is the equipment that is busy, not the exercise.

**What survives.** The `(exerciseId, muscleGroupId)` pairing still keys every
history, chart and personal best. The many-to-many survives where it is genuine
— hammer curl is biceps *and* forearms, one movement worked for two groups —
it is simply rarer now that three movements on one frame are three rows.

**The migration was regenerated from scratch rather than migrated.** Nothing had
shipped: #49 was open, there were no tags, and `0000` existed only in git and on
a simulator. N9 protects *released* history and there was none. A rename
migration would have left permanent cruft in the very first migration for no
benefit. That freedom ends the moment a build reaches the phone.

**Consequence for Q26 (#3):** "which machines besides the Smith machine and
cable station serve several groups?" becomes "which *exercises* serve several
muscle groups?" — a smaller question, and hammer curl is the obvious answer.

**Consequence for the seed:** rebuilt at exercise grain, 23 exercises. Two
mappings the generated seed had invented beyond the spreadsheet are gone — the
Smith machine as a squat, and the flat bench as a close-grip triceps press. At
exercise grain those are separate exercises that never appear in the data; Q25
and Q26 decide whether to add them.

---

## Open — ask, do not guess

| | Question | Blocks |
|---|---|---|
| **Q27** | Required machine count for each group in each family. Default is 1; forearms currently 0. | Seed values; the meaning of a successful session |
| **Q25** | Are the seed muscle group assignments right? Specifically rear delt row under shoulders, and whether hips should split into abduction and adduction. | Seed catalogue |
| **Q26** | Which *exercises* serve several muscle groups? Hammer curl is biceps and forearms; are there others? Reframed by D17 — much smaller than when this modelled machines. | Seed catalogue |
| **Q28** | What machines belong under Abs and Cardio? Both families are currently empty. | Abs and cardio being usable at all |
| **Q6** | The legs sheet's unnamed seventh exercise (30 reps @ 27.5 kg, then 10 @ 25 kg). What is it? | One machine missing from the library |
| **Q9** | Which families fall on which days, and how often. The schedule *shape* is settled by D13; these are the values it needs. | Seeding the weekly plan |
| **Q30** | Is a full session too much ceremony for abs, which used to be one tick? | Whether a quick-log path is built |
| **Q11** | Body weight / measurements — wanted at all? | Deliberately out of v1 |
| **Q20** | Rest by feel or by the clock, and how long? | Whether the rest timer is a headline feature |

---

## Rejected, with reasons

- **Primary/secondary muscle weighting** — unnecessary once the set names its
  group (D4). Reintroducing it would make exact numbers approximate.
- **Importing the spreadsheet** — D7.
- **A fixed muscle-group list shipped by us** — a user complaint about RP
  ("lats and mid back count as the same") is the argument for him defining his
  own. Muscle groups are a managed, editable list.
- **Landscape and iPad-only layouts** — portrait everywhere, iPad is a wider
  view of the same data.
- **Anything requiring a server, account or subscription.**
