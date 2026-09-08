import { Alert } from 'react-native';

import { SKIP_REASONS, type SkipReason } from '@/domain/types';

/**
 * Asks why, then reports back.
 *
 * A skip without a reason is just a gap, and a gap tells him nothing in three
 * months (#24) — so the reason is asked for rather than offered. Cancelling
 * skips nothing, which is why there is no "no reason" option.
 */
export function promptForSkipReason(
  title: string,
  onChosen: (reason: SkipReason) => void,
): void {
  Alert.alert(title, 'Why?', [
    ...SKIP_REASONS.map((reason) => ({
      text: reason.label,
      onPress: () => onChosen(reason.id),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
