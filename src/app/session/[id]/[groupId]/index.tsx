import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { promptForSkipReason } from '@/components/skip-reason-prompt';
import {
  exercisesForMuscleGroup,
  listExercises,
  listMuscleGroups,
  recentSessionsForMuscleGroup,
  skipExercise,
  useSession,
} from '@/db/repository';
import {
  evaluateSession,
  indexById,
  setsLoggedForGroup,
  setsRequiredFor,
} from '@/domain/completion';
import { lastTimeForPairing } from '@/domain/scoring';
import { skipReasonLabel, type Exercise, type Session, type SetEntry } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W3 — the exercises that satisfy one muscle group (#21).
 *
 * The screen that makes a busy gym a non-event: if the bench is taken, another
 * chest exercise satisfies chest. So it lists every exercise mapped to the
 * group, not just the one he usually does, and shows what he last did on each
 * *for this group* — the same exercise used for another group is a different
 * history with different weights.
 */
export default function MuscleGroupScreen() {
  const { id, groupId } = useLocalSearchParams<{ id: string; groupId: string }>();
  const colors = useTheme();
  const session = useSession(id);

  const data = useMemo(() => {
    return {
      exercises: exercisesForMuscleGroup(groupId).map((e) => e.exercise),
      // Scoring needs the whole catalogue, not just this group's exercises:
      // a set's tracking type is read from the exercise it names.
      allExercises: listExercises(),
      name: listMuscleGroups().find((g) => g.id === groupId)?.name ?? groupId,
      // "Last time" means before this session, not five minutes ago.
      history: recentSessionsForMuscleGroup(groupId, id),
    };
  }, [groupId, id]);

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Session not found</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const outcome = evaluateSession(session, { exercises: data.allExercises });
  const group = outcome.groups.find((g) => g.muscleGroupId === groupId);
  const loggedHere = new Set(group?.exerciseIds ?? []);

  // Sets, not exercises: an exercise part-way to its requirement is neither
  // done nor untouched, and that state has to be visible from here or the
  // only way to find out how far in he is would be to open the exercise (D23).
  const setsHere = setsLoggedForGroup(session, groupId, indexById(data.allExercises));

  // Skipped sets for this group, so a card can say it was passed on rather
  // than looking simply untouched.
  const skippedHere = new Map(
    session?.sets
      .filter((s) => s.muscleGroupId === groupId && s.skipped)
      .map((s) => [s.exerciseId, s]) ?? [],
  );

  // Reachable only by a stale link or a hand-typed URL: W2 lists this
  // session's own groups. Saying so beats a screen with a blank subtitle and
  // a back button naming the wrong family.
  if (!group) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.headerButton}
              accessibilityRole="button">
              <ThemedText type="link">‹ {familyLabel(session.familyId)}</ThemedText>
            </Pressable>
            <View style={styles.headerTitle}>
              <ThemedText type="smallBold">{data.name}</ThemedText>
            </View>
            <View style={styles.headerButton} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.notInSession}>
            {data.name} is not part of this {familyLabel(session.familyId).toLowerCase()}{' '}
            session, so nothing logged here would count towards it.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ {familyLabel(session.familyId)}</ThemedText>
          </Pressable>
          <View style={styles.headerTitle}>
            <ThemedText type="smallBold">{data.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {group.optional
                ? 'optional — never blocks the session'
                : `${group.loggedCount} of ${group.required} exercises logged`}
            </ThemedText>
          </View>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="code" style={styles.heading}>
            exercises for {data.name.toLowerCase()}
          </ThemedText>

          {data.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              groupId={groupId}
              groupName={data.name}
              history={data.history}
              logged={loggedHere.has(exercise.id)}
              loggedSets={setsHere.get(exercise.id) ?? 0}
              requiredSets={setsRequiredFor(exercise)}
              skippedSet={skippedHere.get(exercise.id) ?? null}
              onSkip={() =>
                promptForSkipReason(`Skip ${exercise.name}?`, (reason) =>
                  skipExercise(id, exercise.id, groupId, reason),
                )
              }
              onLog={() =>
                router.push({
                  pathname: '/session/[id]/[groupId]/[exerciseId]',
                  params: { id, groupId, exerciseId: exercise.id },
                })
              }
            />
          ))}

          {data.exercises.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              No exercises are mapped to this group yet.
            </ThemedText>
          )}

          {/* The rule, stated where it is easiest to get wrong. */}
          <ThemedView type="backgroundElement" style={styles.why}>
            <ThemedText type="code">why this list</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              These are the exercises mapped to {data.name.toLowerCase()}. Logging one here
              counts for {data.name.toLowerCase()} only — not for any other group, even the
              same exercise.
            </ThemedText>
          </ThemedView>
        </ScrollView>

        <Pressable
          onPress={() => router.back()}
          style={[styles.back, { borderColor: colors.border }]}
          accessibilityRole="button">
          <ThemedText type="link">‹ Back to {familyLabel(session.familyId)}</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function ExerciseCard({
  exercise,
  groupId,
  groupName,
  history,
  logged,
  loggedSets,
  requiredSets,
  skippedSet,
  onSkip,
  onLog,
}: {
  exercise: Exercise;
  groupId: string;
  groupName: string;
  history: Session[];
  logged: boolean;
  loggedSets: number;
  requiredSets: number;
  skippedSet: SetEntry | null;
  onSkip: () => void;
  onLog: () => void;
}) {
  const colors = useTheme();

  // Keyed on the pairing, never the exercise alone.
  const last = lastTimeForPairing(history, { exerciseId: exercise.id, muscleGroupId: groupId }, exercise);

  return (
    <Pressable
      onPress={onLog}
      onLongPress={onSkip}
      accessibilityRole="button"
      accessibilityLabel={`Log ${exercise.name}`}
      accessibilityHint="Long press to skip this exercise"
      style={[styles.card, { borderColor: logged ? colors.met : colors.border }]}>
      <View style={styles.cardBody}>
        <ThemedText type="smallBold">
          {logged ? '✓ ' : ''}
          {exercise.name}
        </ThemedText>
        {skippedSet ? (
          <ThemedText type="small" style={{ color: colors.warning }}>
            Skipped — {skipReasonLabel(skippedSet.skipReason).toLowerCase()}
          </ThemedText>
        ) : loggedSets > 0 && !logged ? (
          // Part-way through. How far in outranks what he did last time,
          // which is only useful before the first set.
          <ThemedText type="small" style={{ color: colors.accent }}>
            {loggedSets} of {requiredSets} sets
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {last
              ? `${last.date} · ${last.summary}`
              : `not used for ${groupName.toLowerCase()} yet`}
          </ThemedText>
        )}
      </View>
      <View style={[styles.logButton, { borderColor: colors.accent }]}>
        <ThemedText type="smallBold">Log</ThemedText>
      </View>
    </Pressable>
  );
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
  headerButton: { minHeight: MinTouchTarget, minWidth: 80, justifyContent: 'center' },
  headerTitle: { alignItems: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  heading: { textTransform: 'uppercase' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardBody: { flex: 1, gap: Spacing.half },
  logButton: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  why: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three },
  notInSession: { paddingHorizontal: Spacing.four },
  back: {
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
