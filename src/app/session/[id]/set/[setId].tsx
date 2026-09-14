import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { exerciseById, getSession, listMuscleGroups, removeSet, updateSet } from '@/db/repository';
import { fieldsForTracking, toSetInput, type MeasureValues } from '@/domain/measures';
import { useTheme } from '@/hooks/use-theme';

/**
 * Correcting one set, long after it was logged (#42).
 *
 * The app is a notebook, not a form. A number typed wrong in August has to be
 * fixable in September, or the history is only as good as his worst moment of
 * attention.
 *
 * **Typed, not stepped.** The logging screen uses big plus/minus controls
 * because N4 governs it — logging happens between sets, breathing hard. This
 * does not: it is an occasional correction, made sitting down, and a keyboard
 * is the faster way to replace 408 with 40.8.
 *
 * **The session's verdict is not recomputed here**, because it is never
 * stored. `evaluateSession` derives it from the requirements snapshotted at
 * start (#19), so the next read of the summary is already right — and a
 * correction can no more rewrite the requirements than a visiting set can
 * (D24).
 */
export default function EditSetScreen() {
  const { id, setId } = useLocalSearchParams<{ id: string; setId: string }>();
  const colors = useTheme();

  const data = useMemo(() => {
    const session = getSession(id);
    const set = session?.sets.find((s) => s.id === setId);
    if (!session || !set) return null;
    const exercise = exerciseById(set.exerciseId);
    if (!exercise) return null;

    return {
      session,
      set,
      exercise,
      groupName:
        listMuscleGroups().find((g) => g.id === set.muscleGroupId)?.name ?? set.muscleGroupId,
      fields: fieldsForTracking(exercise.tracking, exercise.weightIncrementKg),
    };
  }, [id, setId]);

  const [values, setValues] = useState<MeasureValues | null>(() =>
    data
      ? {
          reps: data.set.reps ?? 0,
          weightKg: data.set.weightKg ?? 0,
          minutes: data.set.durationSeconds ? Math.round(data.set.durationSeconds / 60) : 0,
          km: data.set.distanceM ? data.set.distanceM / 1000 : 0,
        }
      : null,
  );

  if (!data || !values) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Set not found</ThemedText>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <ThemedText type="link">Go back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { set, exercise, groupName, session, fields } = data;

  const save = () => {
    updateSet(set.id, { ...toSetInput(exercise.tracking, values), warmup: set.warmup });
    router.back();
  };

  const remove = () => {
    Alert.alert(
      `Delete set ${set.setNumber}?`,
      `${exercise.name} on ${session.date}. The sets after it keep their numbers — a gap is honest about what happened.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeSet(set.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Set {set.setNumber}</ThemedText>
          <Pressable
            onPress={save}
            style={[styles.headerButton, styles.headerAction]}
            accessibilityRole="button">
            <ThemedText type="link">Save</ThemedText>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            {exercise.name} · {groupName.toLowerCase()} · {session.date}
          </ThemedText>

          {fields.map((field) => (
            <View key={field.key} style={styles.field}>
              <ThemedText type="code">{field.label}</ThemedText>
              <TextInput
                value={String(values[field.key])}
                onChangeText={(text) => {
                  const next = Number(text.replace(',', '.'));
                  setValues({
                    ...values,
                    [field.key]: Number.isFinite(next) && next >= 0 ? next : 0,
                  });
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel={field.label}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
            </View>
          ))}

          {set.warmup && (
            <ThemedText type="small" themeColor="textSecondary">
              Logged as a warm-up, and still is. Warm-ups are kept and count for nothing
              (D15).
            </ThemedText>
          )}

          <Pressable onPress={remove} accessibilityRole="button" style={styles.delete}>
            <ThemedText type="small" style={{ color: colors.warning }}>
              Delete this set
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  field: { gap: Spacing.two },
  input: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  delete: { minHeight: MinTouchTarget, justifyContent: 'center', paddingTop: Spacing.four },
});
