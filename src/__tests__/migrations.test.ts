/**
 * The migration harness (#45).
 *
 * **Proves that a database created by an earlier release opens under the
 * current schema.** Cheap now; expensive to retrofit after a year of real
 * data, which is the entire argument for writing it before that year happens.
 *
 * It runs against `node:sqlite` rather than expo-sqlite. The migrations are
 * plain SQL applied in journal order, so the thing under test is the SQL and
 * the order — neither of which needs a simulator. What this cannot prove is
 * that expo-sqlite's driver applies them the same way; it can prove they are
 * valid SQLite and that the sequence lands where the schema says.
 *
 * Node ships SQLite 3.53, well past the 3.35 that `ALTER TABLE … DROP COLUMN`
 * needs — which matters for `0005`, the first destructive migration and the
 * one that had never been executed anywhere when this was written.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DRIZZLE = join(process.cwd(), "drizzle");

interface JournalEntry {
  idx: number;
  tag: string;
}

function journal(): JournalEntry[] {
  const raw = readFileSync(join(DRIZZLE, "meta", "_journal.json"), "utf8");
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries;
}

/** Applies one migration, splitting on drizzle's own statement separator. */
function apply(db: DatabaseSync, tag: string): void {
  const sql = readFileSync(join(DRIZZLE, `${tag}.sql`), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed !== "") db.exec(trimmed);
  }
}

/** A database at the state some earlier release shipped. */
function databaseAt(upTo: number): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const entry of journal()) {
    if (entry.idx > upTo) break;
    apply(db, entry.tag);
  }
  return db;
}

function columns(db: DatabaseSync, table: string): string[] {
  return db
    .prepare(`select name from pragma_table_info(?)`)
    .all(table)
    .map((row) => String((row as { name: unknown }).name));
}

function tables(db: DatabaseSync): string[] {
  return db
    .prepare(`select name from sqlite_master where type = 'table' order by name`)
    .all()
    .map((row) => String((row as { name: unknown }).name));
}

const LATEST = journal().length - 1;

// ---------------------------------------------------------------------------
// The chain itself
// ---------------------------------------------------------------------------

test("every migration in the journal applies, in order, from empty", () => {
  const db = databaseAt(LATEST);
  // If any statement were invalid SQLite, `apply` would have thrown.
  assert.ok(tables(db).length > 0);
  db.close();
});

test("the journal and the files on disk agree", () => {
  for (const entry of journal()) {
    // Throws if the file named by the journal is missing.
    readFileSync(join(DRIZZLE, `${entry.tag}.sql`), "utf8");
  }
  assert.deepEqual(
    journal().map((e) => e.idx),
    journal().map((_, i) => i),
    "journal indices must be contiguous and ordered",
  );
});

test("the final schema holds every table the app reads", () => {
  const db = databaseAt(LATEST);
  const present = tables(db);
  for (const table of [
    "families",
    "muscle_groups",
    "exercises",
    "exercise_muscle_groups",
    "family_muscle_groups",
    "sessions",
    "session_requirements",
    "session_exercise_notes",
    "set_entries",
    "weekly_schedule",
    "settings",
  ]) {
    assert.ok(present.includes(table), `${table} is missing after all migrations`);
  }
  db.close();
});

// ---------------------------------------------------------------------------
// Upgrading a populated database, which is the case that actually matters
// ---------------------------------------------------------------------------

test("a database from before minimumSets gains it with the default (#68)", () => {
  // 0002 was the last schema before `minimum_sets` existed.
  const db = databaseAt(2);
  assert.ok(!columns(db, "exercises").includes("minimum_sets"));

  db.exec(
    `insert into exercises (id, name) values ('bench', 'Bench press')`,
  );

  apply(db, "0003_minimum_sets");

  const row = db.prepare(`select minimum_sets as n from exercises where id = 'bench'`).get();
  // Three working sets complete an exercise (D23), and a row written before
  // the column existed has to arrive at that answer too.
  assert.equal((row as { n: unknown }).n, 3);
  db.close();
});

test("the destructive migration drops the column and keeps everything else (#66)", () => {
  // 0004 is the last schema that still had `exercises.notes`.
  const db = databaseAt(4);
  assert.ok(columns(db, "exercises").includes("notes"));

  db.exec(
    `insert into exercises (id, name, notes, minimum_sets)
     values ('bench', 'Bench press', 'bench at 30 degrees', 5)`,
  );

  apply(db, "0005_drop_exercise_notes");

  // The column is gone...
  assert.ok(!columns(db, "exercises").includes("notes"));
  // ...and the row survived it, values intact.
  const row = db
    .prepare(`select name, minimum_sets as n from exercises where id = 'bench'`)
    .get() as { name: unknown; n: unknown };
  assert.equal(row.name, "Bench press");
  assert.equal(row.n, 5);
  db.close();
});

test("a session and its sets survive the whole chain", () => {
  // Written against the very first schema, then carried all the way forward.
  const db = databaseAt(0);
  db.exec(`insert into families (id, name, position) values ('push', 'Push', 1)`);
  db.exec(`insert into muscle_groups (id, name, position) values ('chest', 'Chest', 1)`);
  db.exec(`insert into exercises (id, name) values ('bench', 'Bench press')`);
  db.exec(
    `insert into sessions (id, family_id, date, started_at)
     values ('s1', 'push', '2026-08-01', '2026-08-01T18:00:00Z')`,
  );
  db.exec(
    `insert into set_entries (id, session_id, exercise_id, muscle_group_id, set_number, reps, weight_kg)
     values ('set1', 's1', 'bench', 'chest', 1, 8, 80)`,
  );

  for (const entry of journal()) {
    if (entry.idx === 0) continue;
    apply(db, entry.tag);
  }

  const set = db
    .prepare(`select reps, weight_kg as w from set_entries where id = 'set1'`)
    .get() as { reps: unknown; w: unknown };
  assert.equal(set.reps, 8);
  assert.equal(set.w, 80);

  const session = db.prepare(`select family_id as f from sessions where id = 's1'`).get();
  assert.equal((session as { f: unknown }).f, "push");
  db.close();
});

test("at most one session in progress survives as a constraint (#58)", () => {
  const db = databaseAt(LATEST);
  db.exec(`insert into families (id, name, position) values ('push', 'Push', 1)`);
  db.exec(
    `insert into sessions (id, family_id, date, started_at, status)
     values ('s1', 'push', '2026-08-01', '2026-08-01T18:00:00Z', 'inProgress')`,
  );

  // The partial unique index from 0001 must still be in force at the head of
  // the chain, not merely have existed when it was added.
  assert.throws(() => {
    db.exec(
      `insert into sessions (id, family_id, date, started_at, status)
       values ('s2', 'push', '2026-08-02', '2026-08-02T18:00:00Z', 'inProgress')`,
    );
  });
  db.close();
});
