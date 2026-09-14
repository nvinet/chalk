import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  Sortable,
  SortableItem,
  type SortableRenderItemProps,
} from 'react-native-reanimated-dnd';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  createFamily,
  listFamilies,
  muscleGroupsForFamily,
  reorderFamilies,
} from '@/db/repository';
import type { Family } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { HandleWidth, orderedIds, RowHeight } from './drag';

/**
 * W10 — the families, and the order they appear in (#15, reshaped by #69).
 *
 * **Only families.** It used to list each family's muscle groups with their
 * required counts, which made it near-indistinguishable from the muscle groups
 * screen: two screens, the same names, the same shape, nothing saying which
 * owned what. Those rows live on the muscle groups screen now, which was
 * already segmented by family.
 *
 * What is left is the one thing only this screen can say: which families there
 * are, and in what order everything else lists them.
 */
type Row = { id: string; family: Family; groups: number };

export default function FamiliesScreen() {
  const colors = useTheme();

  // Read on mount, and again after adding — nothing off this screen changes a
  // family while it is open, and navigating back to it mounts it again.
  const read = () =>
    listFamilies().map((family) => ({
      id: family.id,
      family,
      groups: muscleGroupsForFamily(family.id).filter((r) => !r.group.implicit).length,
    }));

  const [rows, setRows] = useState<Row[]>(read);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const add = () => {
    const name = newName.trim();
    if (name === '') return;
    createFamily(name);
    setNewName('');
    setAdding(false);
    setRows(read());
  };

  const renderItem = useCallback((props: SortableRenderItemProps<Row>) => {
    const { item, id, ...rest } = props;
    return (
      <SortableItem
        key={id}
        id={id}
        data={item}
        {...rest}
        onDrop={(_dropped, _position, all) => reorderFamilies(orderedIds(all))}>
        <FamilyRow row={item} />
      </SortableItem>
    );
  }, []);

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
          <Pressable
            onPress={() => {
              setNewName('');
              setAdding((open) => !open);
            }}
            accessibilityRole="button"
            accessibilityLabel={adding ? 'Cancel adding a family' : 'Add a family'}
            style={[styles.headerButton, styles.headerAction]}>
            <SymbolView
              name={adding ? 'xmark' : 'plus'}
              tintColor={colors.accent}
              size={20}
            />
          </Pressable>
        </View>

        {adding && (
          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="New family"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              onSubmitEditing={add}
              returnKeyType="done"
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Pressable onPress={add} accessibilityRole="button" style={styles.addButton}>
              <ThemedText type="link">Add</ThemedText>
            </Pressable>
          </View>
        )}

        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          Drag by the grip to reorder. This is the order families appear in everywhere
          else. What each one requires is set on the muscle groups screen.
        </ThemedText>

        <Sortable
          data={rows}
          renderItem={renderItem}
          itemHeight={RowHeight}
          // The library styles its own scroll view with a white background,
          // which would ignore the theme.
          style={styles.list}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function FamilyRow({ row }: { row: Row }) {
  const colors = useTheme();

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {/* Only the grip drags, as on iOS. `SortableItem.Handle` also disables
          the whole-row pan, so a tap anywhere else stays a tap (#69). */}
      <SortableItem.Handle style={styles.grip}>
        <SymbolView
          name="line.3.horizontal"
          tintColor={colors.textSecondary}
          size={24}
          accessibilityLabel={`Reorder ${row.family.name}`}
        />
      </SortableItem.Handle>

      <ThemedText style={styles.rowName} numberOfLines={1}>
        {row.family.name}
      </ThemedText>

      {/* A count, not a list. How many groups a family has is a fact about the
          family; listing them is the other screen's job. */}
      <ThemedText type="small" themeColor="textSecondary">
        {row.family.usesMuscleGroups
          ? `${row.groups} ${row.groups === 1 ? 'group' : 'groups'}`
          : 'no groups'}
      </ThemedText>
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
  headerAction: { alignItems: 'flex-end' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  addButton: { minHeight: MinTouchTarget, justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  intro: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  list: { backgroundColor: 'transparent' },
  row: {
    height: RowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.two,
    paddingRight: Spacing.four,
    gap: Spacing.three,
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
  rowName: { flex: 1 },
});
