import { useKeepAwake } from 'expo-keep-awake';

import { useHasSessionInProgress } from '@/db/repository';

/**
 * Holds the screen awake while a session is in progress (#29, G3).
 *
 * `useKeepAwake` releases its lock on unmount, so the lifetime of the lock is
 * the lifetime of this component — mount it only while training and there is
 * nothing to remember to release. Finishing or abandoning unmounts it.
 *
 * Deliberately not tied to the session *screen*: he might be on Today or
 * History mid-session, and the phone should still not sleep while a session is
 * open. It is the session that keeps the screen awake, not the view.
 */
function Lock() {
  useKeepAwake('chalk-session');
  return null;
}

export function KeepAwakeWhileTraining() {
  return useHasSessionInProgress() ? <Lock /> : null;
}
