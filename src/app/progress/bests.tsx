import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { listExercises, listMuscleGroups, useRecentSessions } from '@/db/repository';
import { counts } from '@/domain/planning';
import { bestsAcrossPairings, formatKg, formatWeightReps } from '@/domain/scoring';
import { useTheme } from '@/hooks/use-theme';

/**
 * Every personal best, across every pairing (#40).
 *
 * A view over `bestsForPairing`, as #67 said it should be: the calculation
 * landed in the domain when the logging screen needed it, and this screen
 * reads it rather than inventing a second definition of "best".
 *
 * Grouped by muscle group, because a best is per pairing and a flat list would
 * invite comparing a bench press with a curl. Ordered by heaviest within a
 * group, which is the only ordering that means anything once the group is
 * fixed.
 *
 * Weight/reps only. "Heaviest" means nothing for a run (D12), so cardio is
 * absent rather than listed empty.
 */
export default function PersonalBestsScreen() {
  const colors = useTheme();
  const sessions = useRecentSessions(200);

  const data = useMemo(() => {
    const exercises = listExercises();
    const exerciseNames = new Map(exercises.map((e) => [e.id, e.name]));
    const groupNames = new Map(listMuscleGroups().map((g) => [g.id, g.name]));

    const rows = bestsAcrossPairings(sessions.filter(counts), { exercises });

    const byGroup = new Map<string, typeof rows>();
    for (const row of rows) {
      const held = byGroup.get(row.pairing.muscleGroupId) ?? [];
      byGroup.set(row.pairing.muscleGroupId, [...held, row]);
    }

    return {
      exerciseNames,
      groups: [...byGroup.entries()]
        .map(([groupId, groupRows]) => ({
          groupId,
          name: groupNames.get(groupId) ?? groupId,
          rows: [...groupRows].sort((a, b) => (b.best.heaviestKg ?? 0) - (a.best.heaviestKg ?? 0)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      total: rows.length,
    };
  }, [sessions]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ Progress</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Personal bests</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary">
            Heaviest set, best estimated 1RM and best single set, per exercise and the
            muscle group it counted towards. Detected, never entered by hand.
          </ThemedText>

          {data.groups.map((group) => (
            <View key={group.groupId} style={styles.group}>
              <ThemedText type="code" style={styles.heading}>
                {group.name.toLowerCase()}
              </ThemedText>

              {group.rows.map(({ pairing, best }) => (
                <View
                  key={`${pairing.exerciseId}-${pairing.muscleGroupId}`}
                  style={[styles.row, { borderColor: colors.border }]}>
                  <ThemedText type="smallBold">
                    {data.exerciseNames.get(pairing.exerciseId) ?? pairing.exerciseId}
                  </ThemedText>
                  <ThemedText type="small">
                    {best.heaviestKg != null
                      ? `${formatWeightReps(best.heaviestKg, best.heaviestReps)}${best.heaviestOn ? ` · ${best.heaviestOn}` : ''}`
                      : '—'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {best.bestEstimatedOneRepMaxKg != null
                      ? `est. 1RM ${formatKg(best.bestEstimatedOneRepMaxKg)}`
                      : 'est. 1RM —'}
                    {best.bestSetVolumeKg != null
                      ? ` · best set ${formatKg(best.bestSetVolumeKg)}`
                      : ''}
                  </ThemedText>
                </View>
              ))}
            </View>
          ))}

          {data.total === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing with weight and reps has been logged yet.
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
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  group: { gap: Spacing.one },
  heading: { textTransform: 'uppercase' },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
