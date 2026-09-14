import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { listFamilies, muscleGroupsForFamily, useSession } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';

/**
 * Training something this session does not require (D24, #70).
 *
 * A screen rather than a section that expands in place. The session screen is
 * the one he is on between exercises and it is already long; unfolding another
 * list into the middle of it pushes the session's own groups around and buries
 * the thing he came back to look at.
 *
 * It is deliberately a step off the main path. N4 allows two taps from the
 * session to a machine, and the session's own groups still take two — this
 * costs more, which is the right price for the rare case.
 *
 * Nothing chosen here counts. The screen it leads to says so, and says so
 * again on the logging screen beneath it.
 */
export default function ElsewhereScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const session = useSession(id);

  const families = useMemo(
    () =>
      listFamilies().map((family) => ({
        family,
        groups: muscleGroupsForFamily(family.id)
          .map((r) => r.group)
          .filter((g) => !g.implicit && !g.archived),
      })),
    [],
  );

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Session not found</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const requiredIds = new Set(session.requirements.map((r) => r.muscleGroupId));
  const elsewhere = families
    .map(({ family, groups }) => ({
      family,
      groups: groups.filter((g) => !requiredIds.has(g.id)),
    }))
    .filter(({ groups }) => groups.length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ Session</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Something else</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary">
            Anything here is kept and appears in the history, but it counts for nothing
            towards this session.
          </ThemedText>

          {elsewhere.map(({ family, groups }) => (
            <View key={family.id} style={styles.family}>
              <ThemedText type="code" style={styles.heading}>
                {family.name.toLowerCase()}
              </ThemedText>
              {groups.map((group) => (
                <Pressable
                  key={group.id}
                  onPress={() =>
                    router.replace({
                      pathname: '/session/[id]/[groupId]',
                      params: { id: session.id, groupId: group.id },
                    })
                  }
                  accessibilityRole="button"
                  style={[styles.row, { borderColor: colors.border }]}>
                  <ThemedText style={styles.rowName}>{group.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ›
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ))}

          {elsewhere.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              This session already covers every muscle group.
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
  headerButton: { minHeight: MinTouchTarget, minWidth: 80, justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  family: { gap: Spacing.one },
  heading: { textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1 },
});
