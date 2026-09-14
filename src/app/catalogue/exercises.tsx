import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueAddField, CatalogueHeader } from '@/components/catalogue-header';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  createExercise,
  deleteExercise,
  exerciseUsage,
  isUsed,
  setExerciseArchived,
  useExercises,
} from '@/db/repository';
import { searchExercises } from '@/domain/search';
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

  const matches = useMemo(() => searchExercises(exercises, query), [exercises, query]);

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

  /**
   * Archive when something refers to it, delete when nothing does — the same
   * rule as the other two lists, and the same one the editor applies. Deleting
   * from here saves opening the editor to throw a row away.
   */
  const remove = (exercise: { id: string; name: string }) => {
    const usage = exerciseUsage(exercise.id);

    if (isUsed(usage)) {
      Alert.alert(
        `Archive ${exercise.name}?`,
        `It appears in ${usage.sessions} logged ${usage.sessions === 1 ? 'session' : 'sessions'}, so it cannot be deleted without losing that history. Archiving hides it from new sessions and leaves the past untouched.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Archive', onPress: () => setExerciseArchived(exercise.id, true) },
        ],
      );
      return;
    }

    Alert.alert(`Delete ${exercise.name}?`, 'Nothing has been logged against it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExercise(exercise.id) },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <CatalogueHeader
          title="Exercises"
          adding={adding}
          addLabel="Add an exercise"
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
            placeholder="New exercise"
          />
        )}

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search, including old spellings"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          <ThemedText type="small" themeColor="textSecondary">
            {matches.length} of {exercises.length}
          </ThemedText>

          {matches.map((exercise) => (
            <SwipeToDelete
              key={exercise.id}
              accessibilityLabel={`Delete ${exercise.name}`}
              onDelete={() => remove(exercise)}>
              <Pressable
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
            </SwipeToDelete>
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
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.two },
  input: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: Spacing.half },
});
