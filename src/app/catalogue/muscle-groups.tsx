import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  createMuscleGroup,
  deleteMuscleGroup,
  isUsed,
  listFamilies,
  muscleGroupUsage,
  muscleGroupsForFamily,
  renameMuscleGroup,
  reorderFamilyMuscleGroups,
  setMuscleGroupArchived,
  setRequiredExerciseCount,
  useMuscleGroups,
} from '@/db/repository';
import type { FamilyMuscleGroupView } from '@/db/repository';
import type { MuscleGroup } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * The muscle groups, and what each family asks of them (#60, reshaped by #69).
 *
 * A managed list, not a fixed one: the whole reason this app exists over the
 * alternatives is that he decides what counts as a muscle group, rather than
 * being told lats and mid-back are the same thing.
 *
 * **This screen owns muscle groups entirely.** The required exercise count per
 * family (D23) and the order groups are trained in used to live on the
 * families screen, which made the two near-identical — same names, same shape,
 * nothing saying which owned what.
 *
 * **One family at a time, chosen by a chip.** The first attempt showed every
 * family at once, which meant a draggable list per family nested inside a
 * scrolling page — the arrangement React Native warns about, because a
 * virtualised list inside a plain scroll view loses the windowing and
 * measurement that dragging reads to decide where a row lands. It did not
 * work, and no amount of gesture tuning was going to make it. One list filling
 * the screen is the shape the library is built around.
 *
 * The order dragged here is `family_muscle_groups.position`, which is what the
 * session screen reads. The ↑/↓ buttons this replaced wrote a global order
 * that no screen ever displayed.
 *
 * The implicit cardio group is never shown. It exists so a single completion
 * rule covers every family, and it is not his to edit.
 */
export default function MuscleGroupsScreen() {
  const colors = useTheme();

  // Live: creating, renaming or archiving a group re-reads this.
  const all = useMuscleGroups();
  const families = useMemo(() => listFamilies().filter((f) => f.usesMuscleGroups), []);

  const [familyId, setFamilyId] = useState(() => families[0]?.id ?? '');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // A drag or a required count writes `family_muscle_groups`, which the live
  // query on `muscle_groups` does not watch — so it bumps this instead.
  // Derived rather than copied into state, so the screen never holds a stale
  // version of an order it has just written.
  const [tick, setTick] = useState(0);
  const rows = useMemo(
    () => (familyId ? muscleGroupsForFamily(familyId).filter((r) => !r.group.implicit) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [familyId, all, tick],
  );

  const family = families.find((f) => f.id === familyId);
  const required = rows.filter((r) => r.requiredExerciseCount > 0).length;

  const rename = (group: MuscleGroup) => {
    Alert.prompt?.(
      'Rename muscle group',
      group.name,
      (text?: string) => {
        if (text && text.trim() !== '') renameMuscleGroup(group.id, text);
      },
      'plain-text',
      group.name,
    );
  };

  /**
   * Delete when nothing refers to it, archive when something does.
   *
   * The foreign keys restrict rather than cascade, so deleting a group with
   * history would fail at the database. Better to say why than to show a
   * constraint error.
   */
  const remove = (group: MuscleGroup) => {
    const usage = muscleGroupUsage(group.id);
    if (isUsed(usage)) {
      Alert.alert(
        `Archive ${group.name}?`,
        `It appears in ${usage.sessions} logged ${usage.sessions === 1 ? 'session' : 'sessions'}, so it cannot be deleted without losing that history. Archiving hides it from new sessions and leaves the past untouched.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Archive', onPress: () => setMuscleGroupArchived(group.id, true) },
        ],
      );
      return;
    }

    Alert.alert(`Delete ${group.name}?`, 'Nothing has been logged against it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMuscleGroup(group.id) },
    ]);
  };

  const add = () => {
    const name = newName.trim();
    if (name === '' || !familyId) return;
    createMuscleGroup(name, familyId);
    setNewName('');
    setAdding(false);
  };

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
          <ThemedText type="smallBold">Muscle groups</ThemedText>
          <View style={styles.headerButton} />
        </View>

        {/* One family at a time, so there is exactly one list on the screen
            and nothing scrolling around it. */}
        <View style={styles.chips}>
          {families.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => {
                setFamilyId(f.id);
                setAdding(false);
              }}
              accessibilityRole="button"
              style={[
                styles.chip,
                {
                  borderColor: f.id === familyId ? colors.accent : colors.border,
                  backgroundColor:
                    f.id === familyId ? colors.backgroundElement : 'transparent',
                },
              ]}>
              <ThemedText type="small">{f.name}</ThemedText>
            </Pressable>
          ))}
        </View>

        <ReorderableList
          data={rows}
          keyExtractor={(row) => row.group.id}
          contentContainerStyle={styles.scroll}
          shouldUpdateActiveItem
          onReorder={({ from, to }) => {
            const next = reorderItems(rows, from, to);
            reorderFamilyMuscleGroups(familyId, next.map((r) => r.group.id));
            setTick((n) => n + 1);
          }}
          ListHeaderComponent={
            <View style={styles.intro}>
              <ThemedText type="small" themeColor="textSecondary">
                Hold a group to drag it into the order it is trained in. The number is how
                many distinct exercises it needs before {family?.name.toLowerCase() ?? 'the family'}{' '}
                counts it as done. Changing either never alters a session already logged.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {required} of {rows.length} must be met
              </ThemedText>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {adding ? (
                <View style={styles.addRow}>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={`New ${family?.name.toLowerCase() ?? ''} group`}
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                    onSubmitEditing={add}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                  <Pressable onPress={add} accessibilityRole="button" style={styles.iconButton}>
                    <ThemedText type="link">Add</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setAdding(false)}
                    accessibilityRole="button"
                    style={styles.iconButton}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Cancel
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setAdding(true)}
                  accessibilityRole="button"
                  style={styles.addButton}>
                  <ThemedText type="link">+ Add a group</ThemedText>
                </Pressable>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                Cardio has no muscle groups — it is scored as a whole, so it is not listed
                here.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <GroupRow
              row={item}
              onRename={() => rename(item.group)}
              onRemove={() => remove(item.group)}
              onRequired={(next) => {
                setRequiredExerciseCount(familyId, item.group.id, next);
                setTick((n) => n + 1);
              }}
            />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function GroupRow({
  row,
  onRename,
  onRemove,
  onRequired,
}: {
  row: FamilyMuscleGroupView;
  onRename: () => void;
  onRemove: () => void;
  onRequired: (next: number) => void;
}) {
  const colors = useTheme();
  const drag = useReorderableDrag();
  const active = useIsActive();
  const { group, requiredExerciseCount } = row;

  return (
    // The whole row is the handle: aiming at a 16pt grip to move a row was
    // harder than the ↑/↓ buttons it replaced.
    <Pressable
      onLongPress={drag}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}. Hold to reorder.`}
      style={[
        styles.row,
        {
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.backgroundElement : 'transparent',
        },
      ]}>
      <View style={styles.grip}>
        <ThemedText type="small" themeColor="textSecondary">
          ≡
        </ThemedText>
      </View>

      {/* Carries the drag as well as the tap: a nested Pressable swallows the
          touch, so without its own `onLongPress` the name would be a dead
          strip through the middle of an otherwise draggable row. */}
      <Pressable
        onPress={onRename}
        onLongPress={drag}
        accessibilityRole="button"
        accessibilityLabel={`Rename ${group.name}`}
        style={styles.rowName}>
        <ThemedText>{group.name}</ThemedText>
        {group.archived && (
          <ThemedText type="small" style={{ color: colors.warning }}>
            archived
          </ThemedText>
        )}
        {requiredExerciseCount === 0 && !group.archived && (
          // The release valve: shown, trainable, never blocking.
          <ThemedText type="small" themeColor="textSecondary">
            optional — never blocks the session
          </ThemedText>
        )}
      </Pressable>

      <Pressable
        onPress={() => onRequired(requiredExerciseCount - 1)}
        disabled={requiredExerciseCount === 0}
        accessibilityRole="button"
        accessibilityLabel={`Fewer exercises for ${group.name}`}
        style={styles.iconButton}>
        <ThemedText type="link" style={requiredExerciseCount === 0 && styles.dim}>
          −
        </ThemedText>
      </Pressable>
      <ThemedText style={styles.count}>{requiredExerciseCount}</ThemedText>
      <Pressable
        onPress={() => onRequired(requiredExerciseCount + 1)}
        accessibilityRole="button"
        accessibilityLabel={`More exercises for ${group.name}`}
        style={styles.iconButton}>
        <ThemedText type="link">+</ThemedText>
      </Pressable>

      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${group.name}`}
        style={styles.iconButton}>
        <ThemedText type="small" style={{ color: colors.warning }}>
          ×
        </ThemedText>
      </Pressable>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  chip: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // No horizontal padding: it belongs on each row, so a row reaches the screen
  // edge and stays touchable the whole way across.
  scroll: { paddingBottom: Spacing.five },
  intro: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.one },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grip: { minWidth: 24 },
  rowName: { flex: 1, minHeight: MinTouchTarget, justifyContent: 'center', gap: Spacing.half },
  count: { minWidth: 24, textAlign: 'center' },
  dim: { opacity: 0.3 },
  iconButton: {
    minHeight: MinTouchTarget,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addButton: { minHeight: MinTouchTarget, justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: { paddingTop: Spacing.three },
});
