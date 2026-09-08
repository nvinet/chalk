import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { appliedMigrationCount, catalogueCounts } from '@/db';
import { checkDatabaseHealth } from '@/db/health';

/**
 * Settings, taxonomy editors and export live here (W12, #15-#17, #48).
 *
 * The session card that used to sit here is gone: starting and resuming a
 * session belongs on Today (#32), which is where it now is.
 *
 * The diagnostics stay for the moment. They are cheap, they answer the first
 * question worth asking when something looks wrong, and unlike the session card
 * nothing else in the app reports them.
 */
function useDatabaseHints() {
  // Reads, never runs. The root layout applies migrations and seeds the
  // catalogue before any screen mounts.
  const [snapshot] = useState(() => ({
    health: checkDatabaseHealth(),
    migrations: appliedMigrationCount(),
    catalogue: catalogueCounts(),
  }));

  return snapshot;
}

export default function MoreScreen() {
  const { health, migrations, catalogue } = useDatabaseHints();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">More</ThemedText>

        <ThemedText type="code" style={styles.heading}>
          diagnostics
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow
            title="Database"
            hint={
              <ThemedText type="small">
                {health.ok ? `SQLite ${health.sqliteVersion}` : `failed — ${health.error}`}
              </ThemedText>
            }
          />
          <HintRow
            title="Migrations"
            hint={<ThemedText type="small">{migrations} applied</ThemedText>}
          />
          <HintRow
            title="Catalogue"
            hint={
              <ThemedText type="small">
                {catalogue.exercises} exercises, {catalogue.muscleGroups} groups,{' '}
                {catalogue.families} families
              </ThemedText>
            }
          />
        </ThemedView>

        <ThemedText type="code" style={styles.heading}>
          catalogue
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <Pressable
            onPress={() => router.push('/catalogue/muscle-groups')}
            accessibilityRole="button">
            <HintRow
              title="Muscle groups"
              hint={<ThemedText type="link">edit ›</ThemedText>}
            />
          </Pressable>
          <Pressable onPress={() => router.push('/catalogue/families')} accessibilityRole="button">
            <HintRow title="Families" hint={<ThemedText type="link">edit ›</ThemedText>} />
          </Pressable>
          <Pressable onPress={() => router.push('/catalogue/exercises')} accessibilityRole="button">
            <HintRow title="Exercises" hint={<ThemedText type="link">edit ›</ThemedText>} />
          </Pressable>
        </ThemedView>

        <ThemedText type="code" style={styles.heading}>
          not built yet
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
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
