import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { createExercise, useExercises } from '@/db/repository';
import { useTheme } from '@/hooks/use-theme';

/**
 * The exercise library (#16, #17).
 *
 * Search matches aliases as well as names, so the spreadsheet's spellings
 * still find the corrected ones — typing "hax squat" finds Hack squat.
 */
export default function ExercisesScreen() {
  const colors = useTheme();
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        e.aliases.some((a) => a.toLowerCase().includes(needle)),
    );
  }, [exercises, query]);

  const add = () => {
    const name = newName.trim();
    if (name === '') return;
    // Attached to nothing yet — the editor that opens next is where it is
    // decided what the exercise counts towards.
    const id = createExercise(name);
    setNewName('');
    setAdding(false);
    router.push({ pathname: '/catalogue/exercise/[id]', params: { id } });
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
          <ThemedText type="smallBold">Exercises</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search, including old spellings"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          {adding ? (
            <View style={styles.addRow}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="New exercise"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                onSubmitEditing={add}
                style={[styles.input, styles.grow, { color: colors.text, borderColor: colors.border }]}
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
              <ThemedText type="link">+ Add an exercise</ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary">
            {matches.length} of {exercises.length}
          </ThemedText>

          {matches.map((exercise) => (
            <Pressable
              key={exercise.id}
              onPress={() =>
                router.push({ pathname: '/catalogue/exercise/[id]', params: { id: exercise.id } })
              }
              accessibilityRole="button"
              style={[styles.row, { borderColor: colors.border }]}>
              <View style={styles.rowBody}>
                <ThemedText>
                  {exercise.name}
                  {exercise.archived ? ' · archived' : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {trackingLabel(exercise.tracking)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                ›
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

export function trackingLabel(tracking: string): string {
  if (tracking === 'duration') return 'time';
  if (tracking === 'distance') return 'distance';
  return 'reps and weight';
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
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.two },
  input: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addButton: { minHeight: MinTouchTarget, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: Spacing.half },
  iconButton: { minHeight: MinTouchTarget, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
});
