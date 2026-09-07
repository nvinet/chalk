import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * A tab that exists but has nothing in it yet.
 *
 * The shell (#14) is deliberately separate from the screens it holds, so each
 * tab names the issue that will fill it. Delete this component once the last
 * one is built.
 */
export function ScreenPlaceholder({
  title,
  description,
  issue,
}: {
  title: string;
  description: string;
  issue: string;
}) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText>{description}</ThemedText>
          <ThemedText type="small">Built by {issue}</ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  title: { textAlign: 'left' },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
