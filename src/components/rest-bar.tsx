import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { formatRemaining } from '@/domain/rest';
import { useTheme } from '@/hooks/use-theme';

/**
 * The rest countdown (#27), shared by every screen that can show one (#63).
 *
 * Reads at arm's length from the bench and never takes the screen over:
 * whatever sits underneath it stays usable, so the whole thing can be ignored.
 *
 * It lives here rather than on the logging screen because a rest outlives that
 * screen deliberately. Once it could outlive the screen, the control that ends
 * it had to exist somewhere else too — a rest with no reachable `skip` is what
 * delivered a notification after he had left the gym.
 *
 * `onExtend` is optional. Away from the logging screen the useful action is
 * ending a rest, not lengthening one, and +30s there would be a button for a
 * decision nobody is making.
 */
export function RestBar({
  remaining,
  progress,
  done,
  label,
  onSkip,
  onExtend,
}: {
  remaining: number;
  progress: number;
  done: boolean;
  /** Which exercise is resting — only worth saying where it is not obvious. */
  label?: string;
  onSkip: () => void;
  onExtend?: () => void;
}) {
  const colors = useTheme();
  const tint = done ? colors.met : colors.accent;

  return (
    <View style={styles.rest}>
      <View style={styles.restHead}>
        <ThemedText type="code">
          {done ? 'rest is up' : 'resting'}
          {label ? ` · ${label.toLowerCase()}` : ''}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: tint }}>
          {formatRemaining(remaining)}
        </ThemedText>
      </View>

      <View style={[styles.restTrack, { backgroundColor: colors.backgroundElement }]}>
        <View style={[styles.restFill, { backgroundColor: tint, width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.restActions}>
        <Pressable onPress={onSkip} accessibilityRole="button" style={styles.restButton}>
          <ThemedText type="link">{done ? 'clear' : 'skip'}</ThemedText>
        </Pressable>
        {onExtend && (
          <Pressable onPress={onExtend} accessibilityRole="button" style={styles.restButton}>
            <ThemedText type="link">+30s</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rest: { gap: Spacing.two },
  restHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  restTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  restFill: { height: 6, borderRadius: 3 },
  restActions: { flexDirection: 'row', justifyContent: 'space-between' },
  restButton: { minHeight: MinTouchTarget, minWidth: 72, justifyContent: 'center' },
});
