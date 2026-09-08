import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  createMuscleGroup,
  deleteMuscleGroup,
  familyOfMuscleGroup,
  isUsed,
  listFamilies,
  muscleGroupUsage,
  renameMuscleGroup,
  reorderMuscleGroups,
  setMuscleGroupArchived,
  useMuscleGroups,
} from '@/db/repository';
import type { Family, MuscleGroup } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * The muscle groups themselves (#60).
 *
 * A managed list, not a fixed one: the whole reason this app exists over the
 * alternatives is that he decides what counts as a muscle group, rather than
 * being told lats and mid-back are the same thing.
 *
 * The implicit cardio group is never shown. It exists so a single completion
 * rule covers every family, and it is not his to edit.
 */
export default function MuscleGroupsScreen() {
  // Live: an edit re-reads the list, so nothing needs refreshing by hand.
  const all = useMuscleGroups();

  const data = useMemo(() => {
    // The implicit cardio group is never shown — it exists so one completion
    // rule covers every family, and it is not his to edit.
    const groups = all.filter((g) => !g.implicit);
    return {
      groups,
      families: listFamilies(),
      familyOf: new Map(groups.map((g) => [g.id, familyOfMuscleGroup(g.id)])),
      usage: new Map(groups.map((g) => [g.id, muscleGroupUsage(g.id)])),
    };
  }, [all]);

  const [adding, setAdding] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const add = (familyId: string) => {
    const name = newName.trim();
    if (name === '') return;
    createMuscleGroup(name, familyId);
    setNewName('');
    setAdding(null);
  };

  const rename = (group: MuscleGroup) => {
    Alert.prompt?.(
      'Rename muscle group',
      group.name,
      (text?: string) => {
        if (text && text.trim() !== '') {
          renameMuscleGroup(group.id, text);
              }
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
    const usage = data.usage.get(group.id);
    if (usage && isUsed(usage)) {
      Alert.alert(
        `Archive ${group.name}?`,
        `It appears in ${usage.sessions} logged ${usage.sessions === 1 ? 'session' : 'sessions'}, so it cannot be deleted without losing that history. Archiving hides it from new sessions and leaves the past untouched.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            onPress: () => {
              setMuscleGroupArchived(group.id, true);
                      },
          },
        ],
      );
      return;
    }

    Alert.alert(`Delete ${group.name}?`, 'Nothing has been logged against it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMuscleGroup(group.id);
              },
      },
    ]);
  };

  const move = (index: number, by: number) => {
    const next = [...data.groups];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorderMuscleGroups(next.map((g) => g.id));
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

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {data.families
            .filter((family) => family.usesMuscleGroups)
            .map((family) => (
              <FamilySection
                key={family.id}
                family={family}
                groups={data.groups.filter(
                  (g) => data.familyOf.get(g.id)?.id === family.id,
                )}
                allGroups={data.groups}
                adding={adding === family.id}
                newName={newName}
                onNewName={setNewName}
                onStartAdd={() => {
                  setAdding(family.id);
                  setNewName('');
                }}
                onCancelAdd={() => setAdding(null)}
                onAdd={() => add(family.id)}
                onRename={rename}
                onRemove={remove}
                onMove={move}
              />
            ))}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Cardio has no muscle groups — it is scored as a whole, so there is nothing
            here to arrange.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FamilySection({
  family,
  groups,
  allGroups,
  adding,
  newName,
  onNewName,
  onStartAdd,
  onCancelAdd,
  onAdd,
  onRename,
  onRemove,
  onMove,
}: {
  family: Family;
  groups: MuscleGroup[];
  allGroups: MuscleGroup[];
  adding: boolean;
  newName: string;
  onNewName: (text: string) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: () => void;
  onRename: (group: MuscleGroup) => void;
  onRemove: (group: MuscleGroup) => void;
  onMove: (index: number, by: number) => void;
}) {
  const colors = useTheme();

  return (
    <View style={styles.section}>
      <ThemedText type="code" style={styles.heading}>
        {family.name.toLowerCase()}
      </ThemedText>

      {groups.map((group) => (
        <View key={group.id} style={[styles.row, { borderColor: colors.border }]}>
          <Pressable
            onPress={() => onRename(group)}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${group.name}`}
            style={styles.rowName}>
            <ThemedText>{group.name}</ThemedText>
            {group.archived && (
              <ThemedText type="small" style={{ color: colors.warning }}>
                archived
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={() => onMove(allGroups.indexOf(group), -1)}
            accessibilityRole="button"
            accessibilityLabel={`Move ${group.name} up`}
            style={styles.iconButton}>
            <ThemedText type="link">↑</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => onMove(allGroups.indexOf(group), 1)}
            accessibilityRole="button"
            accessibilityLabel={`Move ${group.name} down`}
            style={styles.iconButton}>
            <ThemedText type="link">↓</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => onRemove(group)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${group.name}`}
            style={styles.iconButton}>
            <ThemedText type="small" style={{ color: colors.warning }}>
              ×
            </ThemedText>
          </Pressable>
        </View>
      ))}

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
  heading: { textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1, minHeight: MinTouchTarget, justifyContent: 'center' },
  iconButton: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
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
