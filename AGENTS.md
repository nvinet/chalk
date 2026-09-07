# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Work is tracked in issues

Every task is a GitHub issue on the [Chalk App board](https://github.com/users/nvinet/projects/5).
The user refers to them by number — "code issue 22". Read the issue with
`gh issue view <n> --comments` and work from what it says.

Move the card to **In progress** when starting and **In review** when finished.
**Never move a card to Done** — the user verifies and does that himself.

Code on local `main`; no feature branches. Work is ready for review when it is
**committed on local `main`**. Do not push — `origin/main` is updated only after
the user has reviewed.

# Answering an open question

`docs/decisions.md` is the durable record. Its "Open — ask, do not guess" table
is authoritative: if a question is listed there, stop and ask rather than
inventing an answer.

Questions are also issues (milestone **M0 Decisions**, label `type:decision`).
The user answers one by commenting the answer on the issue and closing it. That
comment is the source of truth, but **closing the issue changes nothing else** —
the answer has to be propagated by hand, as a task the user asks for ("sync
Q16"). Until that happens `decisions.md` still calls the question open, and a
later session will ask it again.

Propagating one answer means all of:

1. Add a `D<n>` entry to the **Agreed** section of `docs/decisions.md` — the
   decision, the reasoning, and the issue number. Write it properly; do not
   paste the comment.
2. Delete the question's row from the **Open** table.
3. If `scripts/CLAUDE.md` lists the question under "Open questions", remove it
   there too, and fold the answer into the relevant rule if it changes one.
4. Check the question's "Blocks" column and review each issue it named. If the
   answer changes that issue's scope, update the issue and say so.

Capture deferrals as deferrals. "Not now, but still possible" is not a
rejection, and the record must not read as one.
