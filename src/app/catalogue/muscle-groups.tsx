import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  NestedReorderableList,
  ScrollViewContainer,
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
import type { Family, MuscleGroup } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * The muscle groups, and what each family asks of them (#60, reshaped by #69).
 *
 * A managed list, not a fixed one: the whole reason this app exists over the
 * alternatives is that he decides what counts as a muscle group, rather than
 * being told lats and mid-back are the same thing.
 *
 * **This screen now owns muscle groups entirely.** The required exercise count
 * per family (D23) and the order groups are trained in used to live on the
 * families screen, which made the two screens near-identical — same names,
 * same shape, nothing saying which owned what. Both moved here, to the screen
 * that was already segmented by family.
 *
 * The order dragged here is `family_muscle_groups.position`, which is what the
 * session screen reads. The old ↑/↓ wrote `muscle_groups.position`, a global
 * order that no screen displayed — the buttons appeared under a family heading
 * and reordered something else entirely.
 *
 * The implicit cardio group is never shown. It exists so a single completion
 * rule covers every family, and it is not his to edit.
 */
export default function MuscleGroupsScreen() {
  // Live: creating, renaming or archiving a group re-reads this, which is what
  // refreshes the sections below.
  const all = useMuscleGroups();
  const families = useMemo(() => listFamilies().filter((f) => f.usesMuscleGroups), []);

  const [adding, setAdding] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

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

        {/* One scrolling page holding several draggable lists. The library's
            own container, because a plain ScrollView and a drag fight over the
            same gesture. */}
        <ScrollViewContainer
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            Hold a group to drag it into the order it is trained in. The number is how
            many distinct exercises that group needs before the family counts it as done.
            Changing either never alters a session already logged.
          </ThemedText>

          {families.map((family) => (
            <FamilySection
              key={family.id}
              family={family}
              version={all}
              adding={adding === family.id}
              newName={newName}
              onNewName={setNewName}
              onStartAdd={() => {
                setAdding(family.id);
                setNewName('');
              }}
              onCancelAdd={() => setAdding(null)}
              onAdd={() => {
                const name = newName.trim();
                if (name === '') return;
                createMuscleGroup(name, family.id);
                setNewName('');
                setAdding(null);
              }}
            />
          ))}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Cardio has no muscle groups — it is scored as a whole, so there is nothing
            here to arrange.
          </ThemedText>
        </ScrollViewContainer>
      </SafeAreaView>
    </ThemedView>
  );
}

function FamilySection({
  family,
  version,
  adding,
  newName,
  onNewName,
  onStartAdd,
  onCancelAdd,
  onAdd,
}: {
  family: Family;
  /** The live muscle group list. Changing identity means re-read from disk. */
  version: MuscleGroup[];
  adding: boolean;
  newName: string;
  onNewName: (text: string) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: () => void;
}) {
  const colors = useTheme();

  // Writes to `family_muscle_groups` — a drag, or a required count — do not
  // touch the `muscle_groups` table the live query watches, so they bump this
  // instead. Derived rather than held in an effect: the database stays the
  // source of truth and the screen never has its own stale copy.
  const [tick, setTick] = useState(0);
  const rows = useMemo(
    () => muscleGroupsForFamily(family.id).filter((r) => !r.group.implicit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [family.id, version, tick],
  );

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

      <NestedReorderableList
        data={rows}
        keyExtractor={(row) => row.group.id}
        scrollable={false}
        onReorder={({ from, to }) => {
          const next = reorderItems(rows, from, to);
          reorderFamilyMuscleGroups(family.id, next.map((r) => r.group.id));
          setTick((n) => n + 1);
        }}
        renderItem={({ item }) => (
          <GroupRow
            row={item}
            onRename={() => rename(item.group)}
            onRemove={() => remove(item.group)}
            onRequired={(next) => {
              setRequiredExerciseCount(family.id, item.group.id, next);
              setTick((n) => n + 1);
            }}
          />
        )}
      />

      {adding ? (
        <View style={styles.addRow}>
          <TextInput
            value={newName}
            onChangeText={onNewName}
            placeholder={`New ${family.name.toLowerCase()} group`}
            placeholderTextColor={colors.textSecondary}
            autoFocus
            onSubmitEditing={onAdd}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <Pressable onPress={onAdd} accessibilityRole="button" style={styles.iconButton}>
            <ThemedText type="link">Add</ThemedText>
          </Pressable>
          <Pressable onPress={onCancelAdd} accessibilityRole="button" style={styles.iconButton}>
            <ThemedText type="small" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onStartAdd} accessibilityRole="button" style={styles.addButton}>
          <ThemedText type="link">+ Add a group</ThemedText>
        </Pressable>
      )}
    </View>
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
    <View
      style={[
        styles.row,
        {
          borderColor: active ? colors.accent : colors.border,
          backgroundColor: active ? colors.backgroundElement : 'transparent',
        },
      ]}>
      <Pressable
        onLongPress={drag}
        delayLongPress={200}
        accessibilityRole="button"
        accessibilityLabel={`Hold to reorder ${group.name}`}
        style={styles.gripButton}>
        <ThemedText type="small" themeColor="textSecondary">
          ≡
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={onRename}
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
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gripButton: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
