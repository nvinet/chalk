import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  exerciseById,
  listExercises,
  listMuscleGroups,
  logSet,
  recentSessionsForMuscleGroup,
  removeSet,
  useSession,
} from '@/db/repository';
import { evaluateSession } from '@/domain/completion';
import {
  describeSet,
  fieldsForTracking,
  prefillValues,
  stepBy,
  toSetInput,
  trimDecimal,
  type MeasureValues,
} from '@/domain/measures';
import { checkMeasures, referenceValues } from '@/domain/plausibility';
import { lastTimeForPairing } from '@/domain/scoring';
import { useTheme } from '@/hooks/use-theme';

/**
 * W4 — logging one exercise for one muscle group (#22).
 *
 * The header names both, because that pairing is what the set counts for. The
 * same exercise logged for another group is a different history.
 *
 * Every set is written the moment it is logged, never batched (N7) — there is
 * no draft state here to lose.
 */
export default function LogExerciseScreen() {
  const { id, groupId, exerciseId } = useLocalSearchParams<{
    id: string;
    groupId: string;
    exerciseId: string;
  }>();
  const colors = useTheme();
  const session = useSession(id);

  const context = useMemo(
    () => ({
      exercise: exerciseById(exerciseId),
      allExercises: listExercises(),
      groupName: listMuscleGroups().find((g) => g.id === groupId)?.name ?? groupId,
      history: recentSessionsForMuscleGroup(groupId, id),
    }),
    [exerciseId, groupId, id],
  );

  const { exercise } = context;

  // Sets come off the live session, so logging one updates this list, the
  // group's progress and W2 without anything being refetched by hand.
  const sets = (session?.sets ?? []).filter(
    (s) => s.exerciseId === exerciseId && s.muscleGroupId === groupId,
  );

  const last = exercise
    ? lastTimeForPairing(context.history, { exerciseId, muscleGroupId: groupId }, exercise)
    : null;

  const [draft, setDraft] = useState<MeasureValues | null>(null);
  // Dismissals are keyed by the value they were shown for, so correcting the
  // number brings the warning back and correcting it again does not.
  const [dismissed, setDismissed] = useState<string[]>([]);

  if (!session || !exercise) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Not found</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Pre-filled from the last set of this session, else from last time, else a
  // sensible starting point. Repeating a set is then a single tap (N4).
  const values = draft ?? prefillValues(sets, last?.sets ?? []);
  const nextSetNumber = sets.reduce((max, s) => Math.max(max, s.setNumber), 0) + 1;

  const fields = fieldsForTracking(exercise.tracking, exercise.weightIncrementKg);

  // Compared against his own recent best for this pairing — the last session
  // that used it, plus whatever this one has logged already (#26).
  const warnings = checkMeasures(
    exercise.tracking,
    values,
    referenceValues([...(last?.sets ?? []), ...sets]),
  );
  const outcome = evaluateSession(session, { exercises: context.allExercises });
  const group = outcome.groups.find((g) => g.muscleGroupId === groupId);

  // Reachable only by a hand-typed URL — W3 lists this session's own groups.
  // Worth refusing rather than rendering: a set logged against a group the
  // session does not have is written, counts for nothing, and never explains
  // itself.
  if (!group) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.headerButton}
              accessibilityRole="button">
              <ThemedText type="link">‹ back</ThemedText>
            </Pressable>
            <View style={styles.headerTitle}>
              <ThemedText type="smallBold">{exercise.name}</ThemedText>
            </View>
            <View style={styles.headerButton} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.notInSession}>
            {context.groupName} is not part of this{' '}
            {familyLabel(session.familyId).toLowerCase()} session, so anything logged here
            would count for nothing.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const commit = () => {
    logSet(session.id, exerciseId, groupId, toSetInput(exercise.tracking, values));
    // Keep the values: the next set usually repeats the last.
    setDraft(values);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ {context.groupName}</ThemedText>
          </Pressable>
          <View style={styles.headerTitle}>
            <ThemedText type="smallBold">{exercise.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              logging for {context.groupName.toLowerCase()}
            </ThemedText>
          </View>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedView type="backgroundElement" style={styles.lastTime}>
            <ThemedText type="code">last time · {context.groupName.toLowerCase()}</ThemedText>
            <ThemedText type="small">
              {last ? `${last.date} · ${last.summary}` : 'not used for this group yet'}
            </ThemedText>
          </ThemedView>

          {sets.length > 0 && (
            <View style={styles.table}>
              <View style={styles.row}>
                <ThemedText type="code" style={styles.colSet}>
                  set
                </ThemedText>
                <ThemedText type="code" style={styles.colValue}>
                  {fields.map((f) => f.label).join('   ')}
                </ThemedText>
                <View style={styles.colAction} />
              </View>
              {sets.map((set) => (
                <View key={set.id} style={[styles.row, { borderColor: colors.border }]}>
                  <ThemedText style={styles.colSet}>{set.setNumber}</ThemedText>
                  <ThemedText style={styles.colValue}>
                    {describeSet(set, exercise.tracking)}
                  </ThemedText>
                  <Pressable
                    onPress={() => removeSet(set.id)}
                    style={styles.colAction}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove set ${set.setNumber}`}>
                    <ThemedText type="small" themeColor="textSecondary">
                      remove
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {fields.map((field) => {
            const warning = warnings.find((w) => w.key === field.key);
            const token = `${field.key}:${values[field.key]}`;
            return (
              <View key={field.key} style={styles.field}>
                <Stepper
                  label={field.label}
                  value={values[field.key]}
                  step={field.step}
                  decimals={field.decimals}
                  onChange={(next) => setDraft({ ...values, [field.key]: Math.max(0, next) })}
                />
                {warning && !dismissed.includes(token) && (
                  <Pressable
                    onPress={() => setDismissed([...dismissed, token])}
                    accessibilityRole="button"
                    accessibilityLabel={`Dismiss: ${warning.message}`}
                    style={[styles.warning, { borderColor: colors.warning }]}>
                    <ThemedText type="small" style={[styles.warningText, { color: colors.warning }]}>
                      {warning.message}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: colors.warning }}>
                      ×
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            );
          })}

          <Pressable onPress={commit} accessibilityRole="button">
            <ThemedView style={[styles.logButton, { backgroundColor: colors.accent }]}>
              <ThemedText type="smallBold" style={styles.logLabel}>
                Log set {nextSetNumber}
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { borderColor: colors.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {group.optional
              ? `${context.groupName} is optional — this never blocks the session`
              : `${context.groupName} needs ${group.required} — ${group.loggedCount} logged`}
          </ThemedText>
          <Pressable
            onPress={() => router.dismissTo({ pathname: '/session/[id]', params: { id: session.id } })}
            accessibilityRole="button"
            style={styles.footerButton}>
            <ThemedText type="link">Next › back to {familyLabel(session.familyId)}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Big steppers, with the number itself editable — tapping it raises a keypad. */
function Stepper({
  label,
  value,
  step,
  decimals,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  decimals: number;
  onChange: (next: number) => void;
}) {
  const colors = useTheme();
  const show = (n: number) => (decimals === 0 ? String(Math.round(n)) : trimDecimal(n));

  return (
    <View style={styles.stepper}>
      <ThemedText type="code">{label}</ThemedText>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onChange(stepBy(value, -step, decimals))}
          style={[styles.stepButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}>
          <ThemedText type="title">−</ThemedText>
        </Pressable>

        <TextInput
          value={show(value)}
          onChangeText={(text) => {
            const parsed = Number.parseFloat(text.replace(',', '.'));
            if (Number.isFinite(parsed)) onChange(Math.max(0, parsed));
          }}
          keyboardType={decimals === 0 ? 'number-pad' : 'decimal-pad'}
          selectTextOnFocus
          style={[styles.stepValue, { color: colors.text, borderColor: colors.border }]}
          accessibilityLabel={label}
        />

        <Pressable
          onPress={() => onChange(stepBy(value, step, decimals))}
          style={[styles.stepButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}>
          <ThemedText type="title">+</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function familyLabel(familyId: string): string {
  return familyId.charAt(0).toUpperCase() + familyId.slice(1);
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
  headerButton: { minHeight: MinTouchTarget, minWidth: 90, justifyContent: 'center' },
  headerTitle: { alignItems: 'center', flexShrink: 1 },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  lastTime: { gap: Spacing.half, padding: Spacing.three, borderRadius: Spacing.three },
  table: { gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colSet: { width: 48 },
  colValue: { flex: 1 },
  colAction: { minHeight: MinTouchTarget, minWidth: 72, justifyContent: 'center' },
  field: { gap: Spacing.two },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  warningText: { flex: 1 },
  stepper: { gap: Spacing.two },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepButton: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepValue: {
    flex: 1,
    height: 64,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '700',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  logButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
  },
  logLabel: { color: '#ffffff' },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { minHeight: MinTouchTarget, justifyContent: 'center' },
  notInSession: { paddingHorizontal: Spacing.four },
});
