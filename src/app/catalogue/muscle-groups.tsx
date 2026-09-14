import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import {
  Sortable,
  SortableItem,
  type SortableRenderItemProps,
} from 'react-native-reanimated-dnd';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueAddField, CatalogueHeader } from '@/components/catalogue-header';
import { SwipeToDelete } from '@/components/swipe-to-delete';
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
import { HandleWidth, orderedIds, RowHeight } from '@/components/catalogue-list';

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
 * measurement that dragging reads to decide where a row lands. One list
 * filling the screen is the shape these libraries are built around.
 *
 * **Only the grip drags**, as in a native table. `SortableItem.Handle` also
 * disables the whole-row pan, so every other tap on the row stays a tap.
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
    () =>
      (familyId ? muscleGroupsForFamily(familyId).filter((r) => !r.group.implicit) : []).map(
        (r) => ({ id: r.group.id, ...r }),
      ),
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

  const renderItem = useCallback(
    (props: SortableRenderItemProps<(typeof rows)[number]>) => {
      const { item, id, ...rest } = props;
      return (
        <SortableItem
          key={id}
          id={id}
          data={item}
          {...rest}
          onDrop={(_dropped, _position, all2) =>
            reorderFamilyMuscleGroups(familyId, orderedIds(all2))
          }>
          <SwipeToDelete
            accessibilityLabel={`Delete ${item.group.name}`}
            onDelete={() => remove(item.group)}>
            <GroupRow
              row={item}
              onRename={() => rename(item.group)}
              onRequired={(next) => {
                setRequiredExerciseCount(familyId, item.group.id, next);
                setTick((n) => n + 1);
              }}
            />
          </SwipeToDelete>
        </SortableItem>
      );
    },
    [familyId],
  );

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
        <CatalogueHeader
          title="Muscle groups"
          adding={adding}
          addLabel="Add a muscle group"
          onToggleAdd={() => {
            setNewName('');
            setAdding((open) => !open);
          }}
        />

        {adding && (
          <CatalogueAddField
            value={newName}
            onChangeText={setNewName}
            onSubmit={add}
            placeholder={`New ${family?.name.toLowerCase() ?? ''} group`}
          />
        )}

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

        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          Drag by the grip to set the order they are trained in. The number is how many
          distinct exercises the group needs before{' '}
          {family?.name.toLowerCase() ?? 'the family'} counts it as done — {required} of{' '}
          {rows.length} must be met. Changing either never alters a session already logged.
        </ThemedText>

        <Sortable
          data={rows}
          renderItem={renderItem}
          itemHeight={RowHeight}
          // The library styles its own scroll view white, ignoring the theme.
          style={styles.list}
        />

      </SafeAreaView>
    </ThemedView>
  );
}

function GroupRow({
  row,
  onRename,
  onRequired,
}: {
  row: FamilyMuscleGroupView;
  onRename: () => void;
  onRequired: (next: number) => void;
}) {
  const colors = useTheme();
  const { group, requiredExerciseCount } = row;

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {/* Only the grip drags, as on iOS. */}
      <SortableItem.Handle style={styles.grip}>
        <SymbolView
          name="line.3.horizontal"
          tintColor={colors.textSecondary}
          size={24}
          accessibilityLabel={`Reorder ${group.name}`}
        />
      </SortableItem.Handle>

      <Pressable
        onPress={onRename}
        accessibilityRole="button"
        accessibilityLabel={`Rename ${group.name}`}
        style={styles.rowName}>
        <ThemedText numberOfLines={1}>{group.name}</ThemedText>
        {/* Inline rather than on a second line: the rows have to be a uniform
            height for the list to know where a dragged one lands. */}
        {group.archived ? (
          <ThemedText type="small" style={{ color: colors.warning }}>
            archived
          </ThemedText>
        ) : requiredExerciseCount === 0 ? (
          // The release valve: shown, trainable, never blocking.
          <ThemedText type="small" themeColor="textSecondary">
            optional
          </ThemedText>
        ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
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
  list: { backgroundColor: 'transparent' },
  intro: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  row: {
    height: RowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.two,
    paddingRight: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Sized here, on the Handle itself: this is the view the gesture is attached
  // to, so anything smaller than this is not draggable.
  grip: {
    width: HandleWidth,
    height: RowHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, height: RowHeight, justifyContent: 'center' },
  count: { minWidth: 24, textAlign: 'center' },
  dim: { opacity: 0.3 },
  iconButton: {
    minHeight: MinTouchTarget,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
