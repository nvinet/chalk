import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  deleteExercise,
  exerciseById,
  exerciseUsage,
  isUsed,
  listFamilies,
  muscleGroupsForExercise,
  muscleGroupsForFamily,
  setExerciseArchived,
  setExerciseMuscleGroups,
  updateExercise,
} from '@/db/repository';
import type { ExerciseFields } from '@/db/repository';
import type { Id, TrackingType } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const TRACKING: { value: TrackingType; label: string; hint: string }[] = [
  { value: 'weightReps', label: 'Reps + weight', hint: 'Volume, estimated 1RM and personal bests.' },
  { value: 'duration', label: 'Time', hint: 'Minutes and seconds. HIIT, rowing.' },
  { value: 'distance', label: 'Distance', hint: 'Kilometres. Jogging, swimming.' },
];

/**
 * W11 — one exercise (#16).
 *
 * Edits apply as they are made; there is no Save button, because there is
 * nothing here that is only valid as a set. Sets already logged are untouched
 * by any of it: they carry their own weight, reps and muscle group.
 */
export default function ExerciseScreen() {
  const colors = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  /**
   * Everything here is read on mount and re-read after this screen's own
   * writes. Nothing else in the app edits an exercise, and sets are only
   * logged inside a session, so there is no second writer to watch for.
   */
  const [exercise, setExercise] = useState(() => exerciseById(id));
  const [selected, setSelected] = useState(() => new Set<Id>(muscleGroupsForExercise(id)));
  const [usage] = useState(() => exerciseUsage(id));
  const [families] = useState(() =>
    listFamilies().map((family) => ({
      family,
      rows: muscleGroupsForFamily(family.id).filter((r) => !r.group.implicit),
    })),
  );

  const edit = (fields: ExerciseFields) => {
    updateExercise(id, fields);
    setExercise(exerciseById(id));
  };

  const archive = (archived: boolean) => {
    setExerciseArchived(id, archived);
    setExercise(exerciseById(id));
  };

  if (!exercise) {
    return (
      <ThemedView style={styles.centre}>
        <ThemedText>That exercise no longer exists.</ThemedText>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <ThemedText type="link">Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const toggleGroup = (groupId: Id) => {
    const next = new Set(selected);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setExerciseMuscleGroups(id, [...next]);
    setSelected(next);
  };

  /**
   * Delete when nothing refers to it, archive when something does — the same
   * rule as muscle groups, and for the same reason: the foreign keys restrict
   * rather than cascade, so deleting one with history would fail at the
   * database rather than lose it quietly.
   */
  const remove = () => {
    if (isUsed(usage)) {
      Alert.alert(
        `Archive ${exercise.name}?`,
        `It has ${usage.sets} logged ${usage.sets === 1 ? 'set' : 'sets'} across ${usage.sessions} ${usage.sessions === 1 ? 'session' : 'sessions'}, so it cannot be deleted without losing that history. Archiving hides it from new sessions and leaves the past untouched.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            onPress: () => archive(true),
          },
        ],
      );
      return;
    }

    Alert.alert(`Delete ${exercise.name}?`, 'Nothing has been logged against it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteExercise(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ Exercises</ThemedText>
          </Pressable>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <NameField
            initial={exercise.name}
            onCommit={(name) => {
              if (name !== '' && name !== exercise.name) edit({ name });
            }}
          />

          {exercise.archived && (
            <Pressable
              onPress={() => archive(false)}
              accessibilityRole="button">
              <ThemedText type="small" style={{ color: colors.warning }}>
                Archived — hidden from new sessions. Tap to restore.
              </ThemedText>
            </Pressable>
          )}

          <Section title="records">
            {TRACKING.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => edit({ tracking: option.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected: exercise.tracking === option.value }}
                style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowBody}>
                  <ThemedText>{option.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {option.hint}
                  </ThemedText>
                </View>
                {exercise.tracking === option.value && (
                  <ThemedText type="link" accessibilityElementsHidden>
                    ✓
                  </ThemedText>
                )}
              </Pressable>
            ))}
            {usage.sets > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {usage.sets} {usage.sets === 1 ? 'set is' : 'sets are'} already recorded the
                old way. Changing the measure does not convert them.
              </ThemedText>
            )}
          </Section>

          <Section title="defaults">
            {exercise.tracking === 'weightReps' && (
              <>
                <Stepper
                  label="Weight step"
                  value={`${exercise.weightIncrementKg} kg`}
                  hint="What one tap of + or − adds during a set."
                  onChange={(by) => {
                    const next = round(exercise.weightIncrementKg + by * 0.5);
                    if (next >= 0.5) edit({ weightIncrementKg: next });
                  }}
                />
                {/* Only for weight/reps: a run is not three runs (D23). */}
                <Stepper
                  label="Sets to complete"
                  value={`${exercise.minimumSets} ${exercise.minimumSets === 1 ? 'set' : 'sets'}`}
                  hint="Working sets before this counts towards a muscle group. Warm-ups are not among them."
                  onChange={(by) => {
                    const next = exercise.minimumSets + by;
                    if (next >= 1) edit({ minimumSets: next });
                  }}
                />
              </>
            )}
            <Stepper
              label="Rest"
              value={restLabel(exercise.defaultRestSeconds)}
              hint="Where the rest timer starts after a set."
              onChange={(by) => {
                const next = exercise.defaultRestSeconds + by * 15;
                if (next >= 0) edit({ defaultRestSeconds: next });
              }}
            />
          </Section>

          <Section title="used for">
            <ThemedText type="small" themeColor="textSecondary">
              What this exercise is allowed to count towards, across families if need
              be. It grants nothing on its own: a set counts for the one group it is
              logged under, never for the others.
            </ThemedText>
            {families
              .filter(({ rows }) => rows.length > 0)
              .map(({ family, rows }) => (
                <View key={family.id} style={styles.group}>
                  <ThemedText type="code" style={styles.heading}>
                    {family.name.toLowerCase()}
                  </ThemedText>
                  {rows.map((row) => (
                    <Pressable
                      key={row.group.id}
                      onPress={() => toggleGroup(row.group.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected.has(row.group.id) }}
                      style={[styles.row, { borderColor: colors.border }]}>
                      <ThemedText style={styles.rowBody}>{row.group.name}</ThemedText>
                      <ThemedText type="link" style={!selected.has(row.group.id) && styles.dim}>
                        {selected.has(row.group.id) ? '✓' : '+'}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              ))}
            {selected.size === 0 && (
              <ThemedText type="small" style={{ color: colors.warning }}>
                Not attached to any muscle group — it will not appear in a session.
              </ThemedText>
            )}
          </Section>

          {exercise.aliases.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Also found by searching for {exercise.aliases.join(', ')}.
            </ThemedText>
          )}

          {!exercise.archived && (
            <Pressable onPress={remove} accessibilityRole="button" style={styles.removeButton}>
              <ThemedText type="small" style={{ color: colors.warning }}>
                {isUsed(usage) ? 'Archive this exercise' : 'Delete this exercise'}
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Edits are held locally and committed on blur, so each keystroke is not a write. */
function NameField({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (name: string) => void;
}) {
  const colors = useTheme();
  const [text, setText] = useState(initial);

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => onCommit(text.trim())}
      onSubmitEditing={() => onCommit(text.trim())}
      accessibilityLabel="Exercise name"
      style={[styles.name, { color: colors.text, borderColor: colors.border }]}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="code" style={styles.heading}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Stepper({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint: string;
  onChange: (by: number) => void;
}) {
  const colors = useTheme();

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.rowBody}>
        <ThemedText>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      <Pressable
        onPress={() => onChange(-1)}
        accessibilityRole="button"
        accessibilityLabel={`Less ${label.toLowerCase()}`}
        style={styles.iconButton}>
        <ThemedText type="link">−</ThemedText>
      </Pressable>
      <ThemedText style={styles.value}>{value}</ThemedText>
      <Pressable
        onPress={() => onChange(1)}
        accessibilityRole="button"
        accessibilityLabel={`More ${label.toLowerCase()}`}
        style={styles.iconButton}>
        <ThemedText type="link">+</ThemedText>
      </Pressable>
    </View>
  );
}

/** Halves add up exactly in binary, but 1.25 kg plates do not — round anyway. */
function round(kg: number): number {
  return Math.round(kg * 100) / 100;
}

export function restLabel(seconds: number): string {
  if (seconds === 0) return 'none';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerButton: { minHeight: MinTouchTarget, minWidth: 90, justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  name: {
    fontSize: 24,
    fontWeight: '600',
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: Spacing.one },
  group: { gap: Spacing.one, paddingTop: Spacing.two },
  heading: { textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: Spacing.half },
  value: { minWidth: 56, textAlign: 'center' },
  dim: { opacity: 0.4 },
  iconButton: {
    minHeight: MinTouchTarget,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: { minHeight: MinTouchTarget, justifyContent: 'center', paddingTop: Spacing.three },
});
