import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The header every catalogue editor shares (#69).
 *
 * It exists because the two screens disagreed: families offered a `+` in the
 * header, muscle groups a "+ Add a group" link at the foot of the list. Both
 * worked; having both meant the same action was in two places depending on
 * which screen you were on. `+` in the top right is the iOS convention, so
 * that is the one that survives.
 *
 * Shared rather than copied, so the next editor cannot drift again.
 */
export function CatalogueHeader({
  title,
  adding,
  onToggleAdd,
  addLabel,
}: {
  title: string;
  /** Omit `onToggleAdd` for a screen with nothing to add. */
  adding?: boolean;
  onToggleAdd?: () => void;
  addLabel?: string;
}) {
  const colors = useTheme();

  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.headerButton}
        accessibilityRole="button">
        <ThemedText type="link">‹ More</ThemedText>
      </Pressable>

      <ThemedText type="smallBold">{title}</ThemedText>

      {onToggleAdd ? (
        <Pressable
          onPress={onToggleAdd}
          accessibilityRole="button"
          // The same control closes the field again, so it is never a button
          // that only ever opens something.
          accessibilityLabel={adding ? 'Cancel' : (addLabel ?? 'Add')}
          style={[styles.headerButton, styles.headerAction]}>
          <SymbolView name={adding ? 'xmark' : 'plus'} tintColor={colors.accent} size={20} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
    </View>
  );
}

/** The inline field the header's `+` opens. Sits directly beneath it. */
export function CatalogueAddField({
  value,
  onChangeText,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  const colors = useTheme();

  return (
    <View style={styles.addRow}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoFocus
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />
      <Pressable onPress={onSubmit} accessibilityRole="button" style={styles.addButton}>
        <ThemedText type="link">Add</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerButton: { minHeight: MinTouchTarget, minWidth: 80, justifyContent: 'center' },
  headerAction: { alignItems: 'flex-end' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  addButton: { minHeight: MinTouchTarget, justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
