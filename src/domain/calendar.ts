/**
 * Month grids for the history calendar.
 *
 * Pure, and here rather than in the screen because off-by-one week alignment
 * is the classic silent calendar bug: the grid looks plausible while every
 * badge sits on the wrong day.
 */

import type { IsoDate } from "./types.ts";

export interface Month {
  year: number;
  /** 1-12, not the 0-11 the Date constructor uses. */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function monthOf(date: IsoDate): Month {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

export function shiftMonth({ year, month }: Month, by: number): Month {
  const zeroBased = month - 1 + by;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  };
}

export function daysInMonth({ year, month }: Month): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month, 0).getDate();
}

/**
 * The month as weeks of seven, Monday first, padded with nulls.
 *
 * Monday first to match `startOfWeek` in planning.ts — two different week
 * starts in one app would be a quiet source of wrong answers.
 */
export function monthGrid(month: Month): (IsoDate | null)[][] {
  const first = new Date(month.year, month.month - 1, 1);
  // getDay is 0 for Sunday; shift so Monday is 0.
  const leading = (first.getDay() + 6) % 7;
  const total = daysInMonth(month);

  const cells: (IsoDate | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, i) => isoDate(month.year, month.month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function monthName({ year, month }: Month): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/**
 * A distinct letter per family, for the calendar badges.
 *
 * First letters collide — Push and Pull are both P — so a family that cannot
 * have its first letter takes the next letter of its own name that is still
 * free. Push keeps P and Pull becomes U, which is what the wireframe arrived
 * at by hand.
 *
 * Derived rather than hardcoded because families are his to rename (#15), and
 * a fixed table would silently go wrong the moment he did.
 */
export function familyInitials(
  families: { id: string; name: string; position: number }[],
): Map<string, string> {
  const taken = new Set<string>();
  const initials = new Map<string, string>();

  // In display order, so the first-listed family keeps the obvious letter.
  for (const family of [...families].sort((a, b) => a.position - b.position)) {
    const letters = [...family.name.toUpperCase()].filter((c) => /[A-Z0-9]/.test(c));
    const free = letters.find((c) => !taken.has(c));
    const letter = free ?? letters[0] ?? '?';
    taken.add(letter);
    initials.set(family.id, letter);
  }

  return initials;
}
