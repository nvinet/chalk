import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CatalogueAddField, CatalogueHeader } from '@/components/catalogue-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { createExercise, useExercises } from '@/db/repository';
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
