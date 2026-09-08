import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  finishSession,
  listExercises,
  listMuscleGroups,
  useSession,
} from '@/db/repository';
import {
  evaluateSession,
  indexById,
  outstandingGroups,
  type MuscleGroupOutcome,
} from '@/domain/completion';
import { lastTimeForPairing } from '@/domain/scoring';
import type { Exercise, Id, Session } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W2 — the spine of a session (#20).
 *
 * Every number on this screen comes from `evaluateSession`. The completion rule
 * is not restated here in any form: the UI asks the domain what is met and
 * renders the answer, so the screen cannot drift from the rule.
 */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();

  // Live: adding a set re-reads the session, so progress updates as he logs.
  const session = useSession(id);

  // The catalogue does not change during a session, so it is read once.
  const catalogue = useMemo(() => {
    const exercises = listExercises();
    return {
      exercises,
      exercisesById: indexById(exercises),
      groupNames: new Map(listMuscleGroups().map((g) => [g.id, g.name])),
    };
  }, []);

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Session not found</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.linkButton}>
            <ThemedText type="link">Go back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { exercisesById, groupNames } = catalogue;
  const outcome = evaluateSession(session, catalogue);
  const required = outcome.groups.filter((g) => !g.optional);
  const optional = outcome.groups.filter((g) => g.optional);
  const next = outstandingGroups(outcome).find((g) => !g.optional);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Close session">
            <ThemedText type="link">✕</ThemedText>
          </Pressable>

          <View style={styles.headerTitle}>
            <ThemedText type="smallBold">{familyLabel(session.familyId)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {session.date} · <Elapsed startedAt={session.startedAt} />
            </ThemedText>
          </View>

          {/* Always reachable, however little was logged. */}
          <Pressable
            onPress={() => {
              finishSession(session.id);
              router.back();
            }}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">Finish</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText>
            {outcome.requiredGroupsMet} of {outcome.requiredGroupsTotal} muscle groups met
          </ThemedText>
          <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: outcome.successful ? colors.met : colors.accent,
                  width: `${progressPercent(outcome.requiredGroupsMet, outcome.requiredGroupsTotal)}%`,
                },
              ]}
            />
          </View>

          {required.map((group) => (
            <GroupRow
              key={group.muscleGroupId}
              group={group}
              name={groupNames.get(group.muscleGroupId) ?? group.muscleGroupId}
              session={session}
              exercisesById={exercisesById}
              highlighted={group.muscleGroupId === next?.muscleGroupId}
            />
          ))}

          {optional.length > 0 && (
            <>
              <ThemedText type="code" style={styles.optionalHeading}>
                optional
              </ThemedText>
              {optional.map((group) => (
                <GroupRow
                  key={group.muscleGroupId}
                  group={group}
                  name={groupNames.get(group.muscleGroupId) ?? group.muscleGroupId}
                  session={session}
                  exercisesById={exercisesById}
                  highlighted={false}
                />
              ))}
            </>
          )}
        </ScrollView>

        {next && (
          <ThemedView type="backgroundElement" style={styles.cta}>
            <ThemedText type="smallBold">
              Continue › {groupNames.get(next.muscleGroupId) ?? next.muscleGroupId}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              choosing an exercise arrives with #21
            </ThemedText>
          </ThemedView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function GroupRow({
  group,
  name,
  session,
  exercisesById,
  highlighted,
}: {
  group: MuscleGroupOutcome;
  name: string;
  session: Session;
  exercisesById: ReadonlyMap<Id, Exercise>;
  highlighted: boolean;
}) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.group,
        { borderColor: colors.border },
        highlighted && { borderColor: colors.accent, borderWidth: 2 },
      ]}>
      <View style={styles.groupHead}>
        <ThemedText type="smallBold">{group.met && !group.optional ? '✓ ' : ''}{name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {group.optional
            ? '0 required — never blocks the session'
            : `${group.loggedCount} of ${group.required} exercises logged`}
        </ThemedText>
      </View>

      {group.exerciseIds.map((exerciseId) => {
        const exercise = exercisesById.get(exerciseId);
        if (!exercise) return null;
        // Reuses the same summary the logging screen shows for "last time",
        // pointed at this session rather than the history.
        const summary = lastTimeForPairing(
          [session],
          { exerciseId, muscleGroupId: group.muscleGroupId },
          exercise,
        );
        return (
          <View key={exerciseId} style={styles.exerciseRow}>
            <ThemedText type="small">· {exercise.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {summary?.summary ?? ''}
            </ThemedText>
          </View>
        );
      })}

      {!group.met && !group.optional && group.loggedCount === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          nothing logged yet
        </ThemedText>
      )}
    </View>
  );
}

/** Ticking elapsed time. A real interval, so it is a genuine effect. */
function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const started = Date.parse(startedAt);
  const seconds = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <>{`${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`}</>
  );
}

function progressPercent(met: number, total: number): number {
  return total === 0 ? 100 : Math.round((met / total) * 100);
}

function familyLabel(familyId: string): string {
  return familyId.charAt(0).toUpperCase() + familyId.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerButton: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { alignItems: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  group: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupHead: { gap: Spacing.half },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  optionalHeading: { textTransform: 'uppercase', marginTop: Spacing.three },
  cta: {
    margin: Spacing.four,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.half,
  },
  linkButton: { minHeight: MinTouchTarget, justifyContent: 'center' },
});
