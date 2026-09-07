import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMigrationState } from '@/db';
import { checkDatabaseHealth, type DatabaseHealth } from '@/db/health';

/**
 * Settings, taxonomy editors and export will live here (#12 onwards, W12).
 *
 * For now it carries the database diagnostics that proved #10 and #11. They
 * were on the home screen; a tab called More is a better home for them than
 * the screen he opens to start training. Both rows go once real data is on
 * screen.
 */
function useDatabaseHint() {
  // Lazy initialiser, not an effect: the check is synchronous and wants to run
  // exactly once.
  const [health] = useState<DatabaseHealth>(checkDatabaseHealth);

  if (!health.ok) return <ThemedText type="small">failed — {health.error}</ThemedText>;
  return <ThemedText type="small">SQLite {health.sqliteVersion}</ThemedText>;
}

function useMigrationHint() {
  const state = useMigrationState();
  if (state.status === 'running') return <ThemedText type="small">migrating…</ThemedText>;
  if (state.status === 'failed') {
    return <ThemedText type="small">failed — {state.error}</ThemedText>;
  }
  return <ThemedText type="small">up to date</ThemedText>;
}

export default function MoreScreen() {
  const databaseHint = useDatabaseHint();
  const migrationHint = useMigrationHint();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">More</ThemedText>

        <ThemedText type="code" style={styles.heading}>
          diagnostics
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow title="Database" hint={databaseHint} />
          <HintRow title="Migrations" hint={migrationHint} />
        </ThemedView>

        <ThemedText type="code" style={styles.heading}>
          not built yet
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow title="Families" hint={<ThemedText type="small">#15</ThemedText>} />
          <HintRow title="Machines" hint={<ThemedText type="small">#16</ThemedText>} />
          <HintRow title="Settings" hint={<ThemedText type="small">#48</ThemedText>} />
          <HintRow title="Export" hint={<ThemedText type="small">#30</ThemedText>} />
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
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  heading: { textTransform: 'uppercase' },
  card: { gap: Spacing.three, padding: Spacing.four, borderRadius: Spacing.four },
});
