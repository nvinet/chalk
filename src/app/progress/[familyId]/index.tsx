import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  listExercises,
  listFamilies,
  muscleGroupsForFamily,
  useRecentSessions,
} from '@/db/repository';
import { indexById, isSetLogged } from '@/domain/completion';
import { counts } from '@/domain/planning';
import { useTheme } from '@/hooks/use-theme';

/**
 * W8, second level: the muscle groups of one family (#37).
 *
 * "Last trained" is per group, not per session: he can finish a push session
 * having skipped triceps, and the point of this screen is to show exactly that.
 * So it reads the sets rather than the session dates.
 */
export default function ProgressFamilyScreen() {
  const { familyId } = useLocalSearchParams<{ familyId: string }>();
  const colors = useTheme();
  const sessions = useRecentSessions(200);

  const data = useMemo(() => {
    const family = listFamilies().find((f) => f.id === familyId);
    return {
      family,
      groups: muscleGroupsForFamily(familyId)
        .map((r) => r.group)
        .filter((g) => !g.implicit),
      exercisesById: indexById(listExercises()),
    };
  }, [familyId]);

  // A group counts as trained on a date only if a set there actually counted —
  // a skipped group, or one with nothing properly recorded, did not happen.
  const lastTrained = useMemo(() => {
    const byGroup = new Map<string, string>();
    for (const session of sessions) {
      if (!counts(session)) continue;
      for (const set of session.sets) {
        const exercise = data.exercisesById.get(set.exerciseId);
        if (!exercise || !isSetLogged(set, exercise.tracking)) continue;
        const held = byGroup.get(set.muscleGroupId);
        if (!held || session.date > held) byGroup.set(set.muscleGroupId, session.date);
      }
    }
    return byGroup;
  }, [sessions, data.exercisesById]);

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
          <ThemedText type="smallBold">{data.family?.name ?? familyId}</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {data.groups.map((group) => {
            const last = lastTrained.get(group.id);
            return (
              <Pressable
                key={group.id}
                onPress={() =>
                  router.push({
                    pathname: '/progress/[familyId]/[groupId]',
                    params: { familyId, groupId: group.id },
                  })
                }
                accessibilityRole="button"
                style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowBody}>
                  <ThemedText>{group.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {last ? `last trained ${last}` : 'never trained'}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  ›
                </ThemedText>
              </Pressable>
            );
          })}

          {data.groups.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              {data.family?.name ?? 'This family'} has no muscle groups — it is scored as a
              whole.
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
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: Spacing.half },
});
