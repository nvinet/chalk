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
import { useCatalogueState, useMigrationState } from '@/db';
import { abandonSession, activeSession, startSession } from '@/db/repository';
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

function useDatabaseHints() {
  const migrations = useMigrationState();
  const catalogue = useCatalogueState(migrations);

  const migrationHint =
    migrations.status === 'running' ? (
      <ThemedText type="small">migrating…</ThemedText>
    ) : migrations.status === 'failed' ? (
      <ThemedText type="small">failed — {migrations.error}</ThemedText>
    ) : (
      <ThemedText type="small">up to date</ThemedText>
    );

  const catalogueHint =
    catalogue.status === 'waiting' ? (
      <ThemedText type="small">waiting…</ThemedText>
    ) : catalogue.status === 'failed' ? (
      <ThemedText type="small">failed — {catalogue.error}</ThemedText>
    ) : (
      <ThemedText type="small">
        {catalogue.counts.exercises} exercises, {catalogue.counts.muscleGroups} groups,{' '}
        {catalogue.counts.families} families
      </ThemedText>
    );

  return { migrationHint, catalogueHint };
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
