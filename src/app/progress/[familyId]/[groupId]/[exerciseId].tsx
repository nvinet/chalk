import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { exerciseById, listMuscleGroups, sessionsForPairing } from '@/db/repository';
import {
  bestsForPairing,
  formatKg,
  formatWeightReps,
  pairingSeries,
  seriesValues,
  type SeriesMetric,
} from '@/domain/scoring';
import { isWeightBased } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W8, the leaf: one exercise for one muscle group, over time (#38).
 *
 * Charted per *pairing*, never per exercise alone. The same exercise used for
 * two muscle groups is two histories with different weights (D4), and drawing
 * them as one line would be the inference this app exists to avoid.
 *
 * **No target line.** D16 dropped targets from v1 and named this issue's
 * target line among its consequences.
 *
 * The history is unwindowed, unlike the "last time" queries elsewhere: a chart
 * of the last twenty sessions would quietly redraw itself as older ones aged
 * out.
 */
const METRICS: { id: SeriesMetric; label: string }[] = [
  { id: 'topSet', label: 'Top set' },
  { id: 'estimatedOneRepMax', label: 'Est. 1RM' },
  { id: 'volume', label: 'Volume' },
];

export default function ProgressPairingScreen() {
  const { groupId, exerciseId } = useLocalSearchParams<{ groupId: string; exerciseId: string }>();
  const colors = useTheme();

  const [metric, setMetric] = useState<SeriesMetric>('topSet');
  const [width, setWidth] = useState(0);

  const data = useMemo(() => {
    const exercise = exerciseById(exerciseId);
    if (!exercise) return null;

    const pairing = { exerciseId, muscleGroupId: groupId };
    const sessions = sessionsForPairing(exerciseId, groupId);

    return {
      exercise,
      groupName: listMuscleGroups().find((g) => g.id === groupId)?.name ?? groupId,
      series: pairingSeries(sessions, pairing, exercise),
      best: bestsForPairing(sessions, pairing, exercise),
    };
  }, [exerciseId, groupId]);

  if (!data) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Exercise not found</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { exercise, groupName, series, best } = data;
  const points = seriesValues(series, metric);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button">
            <ThemedText type="link">‹ {groupName}</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">{exercise.name}</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {!isWeightBased(exercise.tracking) ? (
            <ThemedText type="small" themeColor="textSecondary">
              {exercise.name} is measured by {exercise.tracking === 'duration' ? 'time' : 'distance'},
              not weight — there is no top set to chart (D12).
            </ThemedText>
          ) : (
            <>
              <View style={styles.chips}>
                {METRICS.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => setMetric(option.id)}
                    accessibilityRole="button"
                    style={[
                      styles.chip,
                      {
                        borderColor: option.id === metric ? colors.accent : colors.border,
                        backgroundColor:
                          option.id === metric ? colors.backgroundElement : 'transparent',
                      },
                    ]}>
                    <ThemedText type="small">{option.label}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 && <LineChart points={points} width={width} format={formatKg} />}
              </View>

              {metric === 'estimatedOneRepMax' && (
                <ThemedText type="small" themeColor="textSecondary">
                  Estimated from reps and weight, and only where a set was twelve reps or
                  fewer — beyond that the estimate stops meaning anything, so those
                  sessions are absent rather than guessed at.
                </ThemedText>
              )}

              <ThemedText type="code" style={styles.heading}>
                best
              </ThemedText>
              <ThemedText type="small">
                {best.heaviestKg != null
                  ? `${formatWeightReps(best.heaviestKg, best.heaviestReps)}${best.heaviestOn ? ` · ${best.heaviestOn}` : ''}`
                  : 'nothing logged for this pairing yet'}
              </ThemedText>
              {best.bestEstimatedOneRepMaxKg != null && (
                <ThemedText type="small" themeColor="textSecondary">
                  est. 1RM {formatKg(best.bestEstimatedOneRepMaxKg)} · best set{' '}
                  {formatKg(best.bestSetVolumeKg ?? 0)}
                </ThemedText>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                {series.length} {series.length === 1 ? 'session' : 'sessions'} logged for{' '}
                {exercise.name.toLowerCase()} as {groupName.toLowerCase()}.
              </ThemedText>
            </>
          )}
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
  headerButton: { minHeight: MinTouchTarget, minWidth: 90, justifyContent: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.two },
  chips: { flexDirection: 'row', gap: Spacing.two, paddingBottom: Spacing.two },
  chip: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: { textTransform: 'uppercase', paddingTop: Spacing.three },
  note: { paddingTop: Spacing.three },
});
