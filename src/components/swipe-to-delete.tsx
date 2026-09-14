import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Swipe a row to reveal Delete — the native list gesture (#69).
 *
 * One component for all three catalogue lists, because they had three
 * different answers to the same question: muscle groups carried a `×` on every
 * row, exercises hid deletion inside the editor, and families had no way at
 * all. A row is a row.
 *
 * Swiping either way reveals the button. iOS conventionally only swipes left,
 * but the other direction costs nothing and rewards the wrong guess instead of
 * doing nothing.
 *
 * The button is revealed, never destructive on its own: the swipe shows an
 * option, and `onDelete` is expected to confirm before anything is lost. A
 * gesture that deleted on release would be one flick away from a mistake.
 */
export function SwipeToDelete({
  onDelete,
  accessibilityLabel,
  children,
}: {
  onDelete: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const colors = useTheme();

  const action = (methods: SwipeableMethods) => (
    <Pressable
      onPress={() => {
        // Closed first, so the row is back in place whatever the confirmation
        // decides — including when it is dismissed.
        methods.close();
        onDelete();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.action, { backgroundColor: colors.warning }]}>
      <ThemedText type="smallBold" style={styles.label}>
        Delete
      </ThemedText>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={(_progress, _translation, methods) => action(methods)}
      renderLeftActions={(_progress, _translation, methods) => action(methods)}>
      <View>{children}</View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 96,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  label: { color: '#ffffff' },
});
