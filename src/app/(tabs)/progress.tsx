import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { listFamilies, muscleGroupsForFamily, useRecentSessions } from '@/db/repository';
import { counts } from '@/domain/planning';
import { useTheme } from '@/hooks/use-theme';

/**
 * W8 — progress, first level: the families (#37).
 *
 * The same three levels as everywhere else — family, muscle group, exercise —
 * so there is nothing new to learn. The session flow already walks them; this
 * walks them over history instead of over what is left to do today.
 *
 * Abandoned sessions do not count as training here either (`counts`, D24 era
 * rule from #59), so "last trained" means the last session that happened.
 */
export default function ProgressScreen() {
  const colors = useTheme();
  const sessions = useRecentSessions(200);

  const families = useMemo(
    () =>
      listFamilies().map((family) => ({
        family,
        groups: muscleGroupsForFamily(family.id).filter((r) => !r.group.implicit).length,
      })),
    [],
  );

  const lastTrained = useMemo(() => {
    const byFamily = new Map<string, string>();
    for (const session of sessions) {
      if (!counts(session)) continue;
      const held = byFamily.get(session.familyId);
      if (!held || session.date > held) byFamily.set(session.familyId, session.date);
    }
    return byFamily;
  }, [sessions]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title">Progress</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Family, then muscle group, then exercise — the same three levels a session
            walks.
          </ThemedText>

          <Pressable
            onPress={() => router.push('/progress/bests')}
            accessibilityRole="button"
            style={[styles.row, { borderColor: colors.border }]}>
            <View style={styles.rowBody}>
              <ThemedText type="smallBold">Personal bests</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                every exercise, every muscle group it counted towards
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              ›
            </ThemedText>
          </Pressable>

          {families.map(({ family, groups }) => {
            const last = lastTrained.get(family.id);
            return (
              <Pressable
                key={family.id}
                onPress={() =>
                  router.push({
                    pathname: '/progress/[familyId]',
                    params: { familyId: family.id },
                  })
                }
                accessibilityRole="button"
                style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowBody}>
                  <ThemedText type="smallBold">{family.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {last ? `last trained ${last}` : 'never trained'}
                    {family.usesMuscleGroups
                      ? ` · ${groups} ${groups === 1 ? 'group' : 'groups'}`
                      : ''}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  ›
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: Spacing.half },
});
