import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  exercisesForMuscleGroup,
  listMuscleGroups,
  recentSessionsForMuscleGroup,
  sessionsForPairing,
} from '@/db/repository';
import { bestsForPairing, formatWeightReps, lastTimeForPairing } from '@/domain/scoring';
import { useTheme } from '@/hooks/use-theme';

/**
 * W8, third level: the exercises of one muscle group (#37).
 *
 * The leaf of the browse. Each row answers the two questions worth asking
 * before a set: what he did last time, and what he is chasing — written in the
 * one shape a weight/reps set is written in everywhere (#67).
 *
 * **The two numbers come from different histories on purpose.** "Last" reads
 * the windowed query, which is what it wants; the best reads the unwindowed
 * one, because a personal best over the last twenty sessions forgets older
 * lifts and lets a beaten record reappear as sessions age out.
 *
 * That costs one query per exercise. A muscle group holds a handful, so it is
 * paid once per screen and is not worth optimising until a group has enough
 * exercises to notice — at which point the fix is a single query returning the
 * best per pairing, not a cache.
 */
export default function ProgressGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const colors = useTheme();

  const data = useMemo(() => {
    const exercises = exercisesForMuscleGroup(groupId).map((e) => e.exercise);
    // One read, shared by every row: "last time" only looks back so far.
    const history = recentSessionsForMuscleGroup(groupId);

    return {
      name: listMuscleGroups().find((g) => g.id === groupId)?.name ?? groupId,
      rows: exercises.map((exercise) => {
        const pairing = { exerciseId: exercise.id, muscleGroupId: groupId };
        return {
          exercise,
          last: lastTimeForPairing(history, pairing, exercise),
          best: bestsForPairing(sessionsForPairing(exercise.id, groupId), pairing, exercise),
        };
      }),
    };
  }, [groupId]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ Back</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{data.name}</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {data.rows.map(({ exercise, last, best }) => (
            <View
              key={exercise.id}
              style={[styles.row, { borderColor: colors.border }]}>
              <ThemedText type="smallBold">{exercise.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {last ? `last · ${last.measure} · ${last.date}` : 'last · not used for this group yet'}
              </ThemedText>
              {best.heaviestKg != null && (
                <ThemedText type="small" themeColor="textSecondary">
                  {`best · ${formatWeightReps(best.heaviestKg, best.heaviestReps)}${
                    best.heaviestOn ? ` · ${best.heaviestOn}` : ''
                  }`}
                </ThemedText>
              )}
            </View>
          ))}

          {data.rows.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              No exercises are mapped to {data.name.toLowerCase()} yet.
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
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
  headerButton: { minHeight: MinTouchTarget, minWidth: 90, justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.two },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
