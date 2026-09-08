import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  listFamilies,
  muscleGroupsForFamily,
  reorderFamilyMuscleGroups,
  setRequiredExerciseCount,
} from '@/db/repository';
import type { Family } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W10 — what each family asks of a session (#15).
 *
 * The muscle groups in a family, in the order they are trained, each with the
 * number of distinct exercises it needs. Naming and creating groups is the
 * other screen (#60); this one decides what a session has to contain.
 *
 * Nothing here can change a session already logged. Requirements are
 * snapshotted when a session starts (#19), so raising chest from one to two
 * today leaves August exactly as it was.
 */
export default function FamiliesScreen() {
  // Read on mount. Nothing off this screen changes a family while it is open,
  // and navigating back to it mounts it again.
  const [families] = useState(() => listFamilies().filter((f) => f.usesMuscleGroups));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ More</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Families</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="small" themeColor="textSecondary">
            How many distinct exercises each group needs for the session to succeed.
            Changing these never alters a session already logged.
          </ThemedText>

          {families.map((family) => (
            <FamilySection key={family.id} family={family} />
          ))}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Cardio is scored as a whole rather than by muscle group, so it has nothing
            to arrange here.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FamilySection({ family }: { family: Family }) {
  const colors = useTheme();

  // This screen is the only writer of these rows, so it re-reads its own
  // writes rather than watching the table.
  const read = () => muscleGroupsForFamily(family.id).filter((r) => !r.group.implicit);
  const [rows, setRows] = useState(read);

  const setRequired = (muscleGroupId: string, required: number) => {
    setRequiredExerciseCount(family.id, muscleGroupId, required);
    setRows(read);
  };

  const move = (index: number, by: number) => {
    const next = [...rows];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorderFamilyMuscleGroups(family.id, next.map((r) => r.group.id));
    setRows(read);
  };

  const required = rows.filter((r) => r.requiredExerciseCount > 0).length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="code" style={styles.heading}>
          {family.name.toLowerCase()}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {required} of {rows.length} must be met
        </ThemedText>
      </View>

      {rows.map((row, index) => (
        <View key={row.group.id} style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.rowName}>
            <ThemedText>{row.group.name}</ThemedText>
            {row.requiredExerciseCount === 0 && (
              // The release valve: shown, trainable, never blocking.
              <ThemedText type="small" themeColor="textSecondary">
                optional — never blocks the session
              </ThemedText>
            )}
          </View>

          <Pressable
            onPress={() => setRequired(row.group.id, row.requiredExerciseCount - 1)}
            disabled={row.requiredExerciseCount === 0}
            accessibilityRole="button"
            accessibilityLabel={`Fewer exercises for ${row.group.name}`}
            style={styles.iconButton}>
            <ThemedText type="link" style={row.requiredExerciseCount === 0 && styles.dim}>
              −
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.count}>{row.requiredExerciseCount}</ThemedText>
          <Pressable
            onPress={() => setRequired(row.group.id, row.requiredExerciseCount + 1)}
            accessibilityRole="button"
            accessibilityLabel={`More exercises for ${row.group.name}`}
            style={styles.iconButton}>
            <ThemedText type="link">+</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => move(index, -1)}
            accessibilityRole="button"
            accessibilityLabel={`Move ${row.group.name} up`}
            style={styles.iconButton}>
            <ThemedText type="link">↑</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => move(index, 1)}
            accessibilityRole="button"
            accessibilityLabel={`Move ${row.group.name} down`}
            style={styles.iconButton}>
            <ThemedText type="link">↓</ThemedText>
          </Pressable>
        </View>
      ))}
    </View>
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
  section: { gap: Spacing.one },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heading: { textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1, gap: Spacing.half },
  count: { minWidth: 24, textAlign: 'center' },
  dim: { opacity: 0.3 },
  iconButton: {
    minHeight: MinTouchTarget,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { paddingTop: Spacing.two },
});
