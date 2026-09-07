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

---

## Open — ask, do not guess

| | Question | Blocks |
|---|---|---|
| **Q3** | What is a "target"? A weight on a machine by a date? Sessions per week? Sets per muscle group? | All target logic (§8.4), the Targets screen |
| **Q27** | Required machine count for each group in each family. Default is 1; forearms currently 0. | Seed values; the meaning of a successful session |
| **Q25** | Are the seed muscle group assignments right? Specifically rear delt row under shoulders, and whether hips should split into abduction and adduction. | Seed catalogue |
| **Q26** | Which machines besides the Smith machine and cable station serve several groups? | Seed catalogue |
| **Q28** | What machines belong under Abs and Cardio? Both families are currently empty. | Abs and cardio being usable at all |
| **Q7** | Hack squat logged at 0 kg — bodyweight, or is the sled not counted? | Whether a reps-only tracking type is needed |
| **Q6** | The legs sheet's unnamed seventh exercise (30 reps @ 27.5 kg, then 10 @ 25 kg). What is it? | One machine missing from the library |
| **Q9** | Weekly frequency target per family. | The weekly plan |
| **Q29** | Should cardio record distance as well as time? | Whether a third tracking type is needed |
| **Q30** | Is a full session too much ceremony for abs, which used to be one tick? | Whether a quick-log path is built |
| **Q11** | Body weight / measurements — wanted at all? | Deliberately out of v1 |
| **Q20** | Rest by feel or by the clock, and how long? | Whether the rest timer is a headline feature |
| **Q21** | Are warm-up sets recorded separately from working sets? | Volume and personal-best maths |

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
