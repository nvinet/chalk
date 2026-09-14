import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/** Never changes: hydration happens once, and this store has nothing to emit. */
const subscribe = () => () => {};

/**
 * The colour scheme, on web.
 *
 * Static rendering has no scheme to read, so the first paint has to be light
 * and the real value can only arrive on the client. `useSyncExternalStore` is
 * how React says "this differs between server and client": its server snapshot
 * is `false` and its client snapshot is `true`, so the swap happens during
 * hydration rather than in an effect afterwards.
 *
 * It used to do that with `useState` plus an effect, which works but sets state
 * synchronously inside one — the cascading-render pattern the lint rule exists
 * to catch, and the only error this project had left.
 *
 * Web is not a target (D11). This file is here because Metro resolves it for
 * the web bundle, and being wrong in a corner nobody visits is still wrong.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
