import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  MaxContentWidth,
  MinTouchTarget,
  Spacing,
} from '@/constants/theme';
import { appliedMigrationCount, catalogueCounts } from '@/db';
import {
  abandonSession,
  activeSession,
  startSession,
  useHasSessionInProgress,
} from '@/db/repository';
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

/**
 * Reads, never runs. The root layout applies migrations and seeds the
 * catalogue before any screen mounts, so by the time this renders both are
 * done — and calling the hooks again here would migrate twice.
 */
function useDatabaseHints() {
  const [counts] = useState(() => ({
    migrations: appliedMigrationCount(),
    catalogue: catalogueCounts(),
  }));

  return {
    migrationHint: (
      <ThemedText type="small">
        {counts.migrations} applied
      </ThemedText>
    ),
    catalogueHint: (
      <ThemedText type="small">
        {counts.catalogue.exercises} exercises, {counts.catalogue.muscleGroups} groups,{' '}
        {counts.catalogue.families} families
      </ThemedText>
    ),
  };
}

/**
 * Temporary: proves #19 before the session screens exist (#20-#22). Starting a
 * session is a deliberate action, so this is state and a press handler rather
 * than anything derived. Delete once W2 can start one properly.
 */
function useSessionScaffold() {
  // `/more?start=push` starts one on open, so the flow can be driven from a
  // deep link as well as a tap. A lazy initialiser rather than an effect: it
  // runs once, and only when there is nothing already in progress.
  const { start: startParam } = useLocalSearchParams<{ start?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(() => {
    try {
      const existing = activeSession();
      if (existing || !startParam) return existing;
      return startSession(startParam);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  });

  const start = (familyId: string) => {
    try {
      const started = startSession(familyId);
      setSession(started);
      setError(null);
      router.push({ pathname: '/session/[id]', params: { id: started.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const abandon = () => {
    if (!session) return;
    abandonSession(session.id);
    setSession(null);
    setError(null);
  };

  return { session, error, start, abandon };
}

export default function MoreScreen() {
  const databaseHint = useDatabaseHint();
  const { migrationHint, catalogueHint } = useDatabaseHints();
  const { session, error, start, abandon } = useSessionScaffold();
  // Live, so it flips the moment a session is finished or abandoned (#29).
  const awake = useHasSessionInProgress();

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
          <HintRow title="Catalogue" hint={catalogueHint} />
          <HintRow
            title="Screen"
            hint={
              <ThemedText type="small">
                {awake ? 'kept awake — session open' : 'normal'}
              </ThemedText>
            }
          />
        </ThemedView>

        <ThemedText type="code" style={styles.heading}>
          session (temporary, #19)
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow
            title="Active"
            hint={
              <ThemedText type="small">
                {error
                  ? `failed — ${error}`
                  : session
                    ? `${session.familyId} · ${session.requirements.length} groups · ${session.sets.length} sets`
                    : 'none'}
              </ThemedText>
            }
          />
          {session ? (
            // One session at a time (#58): resume it, or let it go.
            <ThemedView style={styles.buttonRow}>
              <Pressable
                onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
                style={styles.button}
                accessibilityRole="button">
                <ThemedText type="small">resume</ThemedText>
              </Pressable>
              <Pressable onPress={abandon} style={styles.button} accessibilityRole="button">
                <ThemedText type="small">abandon</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <ThemedView style={styles.buttonRow}>
              {['push', 'pull', 'legs'].map((familyId) => (
                <Pressable
                  key={familyId}
                  onPress={() => start(familyId)}
                  style={styles.button}
                  accessibilityRole="button">
                  <ThemedText type="small">start {familyId}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          )}
        </ThemedView>

        <ThemedText type="code" style={styles.heading}>
          not built yet
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow title="Families" hint={<ThemedText type="small">#15</ThemedText>} />
          <HintRow title="Exercises" hint={<ThemedText type="small">#16</ThemedText>} />
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
  buttonRow: { flexDirection: 'row', gap: Spacing.two, backgroundColor: 'transparent' },
  button: {
    flex: 1,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8888',
  },
});
