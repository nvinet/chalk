/**
 * Row identifiers.
 *
 * Not a UUID, and deliberately so: this is a single-user offline app with one
 * writer, so the collision risk a UUID guards against does not exist, and a
 * native crypto dependency would be carried for nothing.
 *
 * Time first, so ids sort in creation order — which makes a database dump
 * readable and "the set he entered last" answerable without a timestamp.
 */
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${time}-${random}`;
}

/** Local calendar date, `YYYY-MM-DD`. Sessions group by this, not by timestamp. */
export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
