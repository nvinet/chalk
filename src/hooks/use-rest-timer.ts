import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  extendRest,
  isFinished,
  isForPairing,
  startRest,
  type RestTimer,
} from '@/domain/rest';

/**
 * The one rest in progress (#27).
 *
 * It lives outside React because it outlives the screen that started it:
 * walking back to the muscle group and returning to the same exercise must
 * find the same rest still running, not a fresh one. There is only ever one —
 * he is one person doing one set at a time — so a module-level value is the
 * honest shape, and a context would only add ceremony.
 */
let current: RestTimer | null = null;
let scheduledId: string | null = null;
const listeners = new Set<() => void>();

function set(next: RestTimer | null) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Asked for the first time a rest starts, not on launch.
 *
 * A permission prompt before the app has done anything is the kind that gets
 * refused. Refusal is survivable in any case: the on-screen countdown is the
 * feature, and the notification is what makes it useful with the phone in a
 * pocket.
 */
async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true },
  });
  return asked.granted;
}

/**
 * On iOS this is a scheduled local notification rather than a background
 * timer — the OS will not let an app count in the background, and there is no
 * need for it to. Same behaviour for him, different mechanism.
 */
async function schedule(exerciseName: string, seconds: number) {
  if (!(await ensurePermission())) return;
  scheduledId = await Notifications.scheduleNotificationAsync({
    content: { title: 'Rest is up', body: exerciseName, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

async function unschedule() {
  if (!scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  await Notifications.cancelScheduledNotificationAsync(id);
}

/**
 * Ends the rest from outside React (#63).
 *
 * Finishing or abandoning a session has to cancel the pending notification,
 * and neither happens on the screen that owns the countdown — by then the
 * exercise screen is unmounted and its `skip` went with it. A module-level
 * function is reachable from wherever the session actually ends.
 */
export function clearRest() {
  void unschedule();
  set(null);
}

/**
 * The one-second repaint, shared by every screen showing a rest.
 *
 * Only the repaint: remaining time is always derived from the end time, so a
 * throttled or suspended interval costs a stale pixel and never a wrong
 * number.
 */
function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    // Coming back from the lock screen: repaint at once rather than waiting
    // out the rest of a second that may have been throttled away.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [active]);

  return now;
}

/**
 * The running rest whatever pairing it belongs to, for screens that do not own
 * it (#63).
 *
 * The exercise screen shows only its own rest, because a countdown for some
 * other exercise above its steppers would be noise. Everywhere else inside a
 * session the opposite is true: a rest running with no way to stop it is what
 * put a notification on his phone after he had gone home.
 */
export function useCurrentRest(): {
  timer: RestTimer | null;
  now: number;
  skip: () => void;
} {
  const timer = useSyncExternalStore(subscribe, () => current, () => current);
  return { timer, now: useTick(timer !== null), skip: clearRest };
}

export interface Pairing {
  exerciseId: string;
  muscleGroupId: string;
}

export interface RestControls {
  /** The rest running for this pairing, or null — another exercise's is not shown. */
  timer: RestTimer | null;
  /** Re-rendered every second while one is running. */
  now: number;
  start: (seconds: number, exerciseName: string) => void;
  extend: (seconds: number, exerciseName: string) => void;
  skip: () => void;
}

/**
 * Drives the countdown for one exercise's screen.
 *
 * `now` comes from a one-second interval, and the interval is only the thing
 * that repaints — the remaining time is always derived from the end time, so a
 * throttled or suspended interval costs a stale pixel and never a wrong
 * number.
 */
export function useRestTimer(pairing: Pairing, enabled = true): RestControls {
  const timer = useSyncExternalStore(subscribe, () => current, () => current);
  const now = useTick(timer !== null);
  const finishedAt = useRef<number | null>(null);

  const mine = timer && isForPairing(timer, pairing) ? timer : null;

  // A single buzz the moment it runs out, and only for the screen that owns
  // the rest — so leaving it running and coming back does not re-buzz.
  useEffect(() => {
    if (!mine || !enabled) return;
    if (!isFinished(mine, now)) return;
    if (finishedAt.current === mine.endsAtMs) return;
    finishedAt.current = mine.endsAtMs;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [mine, now, enabled]);

  const start = useCallback(
    (seconds: number, exerciseName: string) => {
      void unschedule();
      const next = startRest(pairing, seconds, Date.now());
      set(next);
      if (next) void schedule(exerciseName, seconds);
    },
    [pairing],
  );

  const extend = useCallback(
    (seconds: number, exerciseName: string) => {
      if (!current) return;
      void unschedule();
      const next = extendRest(current, seconds);
      set(next);
      const remaining = Math.max(1, Math.round((next.endsAtMs - Date.now()) / 1000));
      void schedule(exerciseName, remaining);
    },
    [],
  );

  const skip = useCallback(() => clearRest(), []);

  return { timer: mine, now, start, extend, skip };
}
