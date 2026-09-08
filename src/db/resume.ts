import { router } from 'expo-router';
import { useEffect } from 'react';

import { activeSession } from './repository';

/**
 * True once this launch has already decided whether to resume.
 *
 * Module scope on purpose: it must survive re-renders but not a relaunch, and
 * a fresh JS context is exactly what a relaunch gives. A ref would reset if the
 * root ever remounted, and then closing a session would bounce straight back
 * into it.
 */
let decided = false;

/**
 * Reopens an interrupted session on launch (#23).
 *
 * A session that was force-quit mid-set is still in progress, and every set is
 * already on disk (N7) — so resuming is a navigation, not a recovery. There is
 * no draft state to restore because there never was any.
 *
 * Pushed rather than replaced, so closing the session still lands on the tabs.
 */
export function useResumeInterruptedSession(ready: boolean): void {
  useEffect(() => {
    if (!ready || decided) return;
    decided = true;

    const open = activeSession();
    if (open) {
      router.push({ pathname: '/session/[id]', params: { id: open.id } });
    }
  }, [ready]);
}

/** Test seam: lets a launch be simulated without restarting the app. */
export function resetResumeForTesting(): void {
  decided = false;
}
