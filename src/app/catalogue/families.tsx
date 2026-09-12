import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import ReorderableList, {
  useIsActive,
  useReorderableDrag,
  reorderItems,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { listFamilies, muscleGroupsForFamily, reorderFamilies } from '@/db/repository';
import type { Family } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W10 — the families, and the order they appear in (#15, reshaped by #69).
 *
 * **Only families.** It used to list each family's muscle groups with their
 * required counts, which made it near-indistinguishable from the muscle groups
 * screen: two screens, the same names, the same shape, and nothing saying
 * which owned what. Those rows now live on the muscle groups screen, which was
 * already segmented by family and is the better home for them.
 *
 * What is left is the one thing only this screen can say: which families
 * there are, and in what order everything else lists them.
 */
type Row = { family: Family; groups: number };

/** How long a press must be held before it becomes a drag rather than a tap. */
const DRAG_AFTER_MS = 200;

export default function FamiliesScreen() {
  // Read on mount. Nothing off this screen changes a family while it is open,
  // and navigating back to it mounts it again.
  const [rows, setRows] = useState<Row[]>(() =>
    listFamilies().map((family) => ({
      family,
      groups: muscleGroupsForFamily(family.id).filter((r) => !r.group.implicit).length,
    })),
  );

  // The drag must win against two other gestures: the page scroll, and the
  // stack's swipe-back at the left edge. Requiring a long press first is the
  // library's own answer, and the threshold has to sit just above the
  // Pressable's `delayLongPress` or the press fires without the pan arming.
  const panGesture = useMemo(() => Gesture.Pan().activateAfterLongPress(DRAG_AFTER_MS + 20), []);

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

        <ReorderableList
          data={rows}
          keyExtractor={(row) => row.family.id}
          contentContainerStyle={styles.scroll}
          panGesture={panGesture}
          // Required for `useIsActive` in the row to ever report true.
          shouldUpdateActiveItem
          onReorder={({ from, to }) => {
            const next = reorderItems(rows, from, to);
            setRows(next);
            reorderFamilies(next.map((row) => row.family.id));
          }}
          ListHeaderComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
              Hold a family to drag it. This order is the order they appear in everywhere
              else. What each family requires is set on the muscle groups screen.
            </ThemedText>
          }
          renderItem={({ item }) => <FamilyRow row={item} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function FamilyRow({ row }: { row: Row }) {
  const colors = useTheme();
  const drag = useReorderableDrag();
  const active = useIsActive();

  return (
    <Pressable
      onLongPress={drag}
      delayLongPress={DRAG_AFTER_MS}
      accessibilityRole="button"
      accessibilityLabel={`${row.family.name}. Hold to reorder.`}
      style={[
        styles.row,
        {
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.backgroundElement : 'transparent',
        },
      ]}>
      {/* A grip, not a pair of arrows. It says "draggable" without being a
          control that has to be aimed at twice per position (#69). */}
      <ThemedText type="small" themeColor="textSecondary" style={styles.grip}>
        ≡
      </ThemedText>
      <View style={styles.rowName}>
        <ThemedText>{row.family.name}</ThemedText>
        {/* A count, not a list. Saying how many groups a family has is a fact
            about the family; listing them is the other screen's job. */}
        <ThemedText type="small" themeColor="textSecondary">
          {row.family.usesMuscleGroups
            ? `${row.groups} muscle ${row.groups === 1 ? 'group' : 'groups'}`
            : 'no muscle groups — exercises directly'}
        </ThemedText>
      </View>
    </Pressable>
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
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  intro: { paddingBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.three,
    // The list's horizontal inset, pulled inside the row. It used to sit on
    // the content container, which made the strip either side of every row
    // look like part of it and behave like background — a touch there hit the
    // list, not the item, so only the text and the glyph started a drag (#69).
    marginHorizontal: -Spacing.four,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grip: { minWidth: 16 },
  rowName: { flex: 1, gap: Spacing.half },
});
