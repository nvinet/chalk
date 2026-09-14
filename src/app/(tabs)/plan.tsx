import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { today as todayIso } from '@/db/ids';
import {
  DAY_NAMES,
  listExercises,
  listFamilies,
  setScheduledFamily,
  setSetting,
  useRecentSessions,
  useSetting,
  useWeeklySchedule,
  type DayOfWeek,
} from '@/db/repository';
import { evaluateSession } from '@/domain/completion';
import {
  planStreak,
  sessionsInWeek,
  shiftWeek,
  startOfWeek,
  weekAdherence,
  weekDates,
  weekMetPlan,
} from '@/domain/planning';
import { useTheme } from '@/hooks/use-theme';

/**
 * W6 — the weekly plan, and how closely it was followed (#33).
 *
 * The plan is a **shape of week**: each day is either given to a family or is a
 * rest day. A family's weekly target is therefore derived — how many days it is
 * given — rather than stored as a number that could disagree with the days.
 *
 * It ships empty (D19). Nothing is seeded and nothing is proposed; the first
 * run has no plan until he makes one, and an assistant that suggests schedules
 * is explicitly out of scope until there is history worth basing one on.
 *
 * **Attendance and success are different measures, and both are shown** (C3).
 * A session counts towards the week the moment anything is logged, whether or
 * not every group succeeded. Turning up is the habit the plan is about;
 * collapsing the two would let one bad session read as an absence.
 */
export default function PlanScreen() {
  const colors = useTheme();
  const sessions = useRecentSessions(200);
  const schedule = useWeeklySchedule();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayIso()));

  const families = useMemo(() => listFamilies(), []);
  const exercises = useMemo(() => listExercises(), []);

  const week = useMemo(() => {
    const dates = weekDates(weekStart);
    const inWeek = sessionsInWeek(sessions, weekStart);

    // Scoring needs the catalogue, so it happens here and the verdict is
    // handed to the pure adherence function as a set of ids.
    const successfulIds = new Set(
      inWeek.filter((s) => evaluateSession(s, { exercises }).successful).map((s) => s.id),
    );

    return {
      dates,
      sessionsByDate: new Map(dates.map((d) => [d, inWeek.filter((s) => s.date === d)])),
      adherence: weekAdherence(families, schedule, inWeek, successfulIds),
      successfulIds,
    };
  }, [weekStart, sessions, schedule, families, exercises]);

  /**
   * The last twelve weeks, met or not (#35).
   *
   * Twelve because a quarter is long enough to show a habit and short enough
   * that a bad month still reads as recoverable.
   */
  const history = useMemo(() => {
    const thisWeekStart = startOfWeek(todayIso());
    const weeks = Array.from({ length: 12 }, (_, i) => shiftWeek(thisWeekStart, i - 11));
    const met = weeks.map((start) => {
      const inWeek = sessionsInWeek(sessions, start);
      const successfulIds = new Set(
        inWeek.filter((s) => evaluateSession(s, { exercises }).successful).map((s) => s.id),
      );
      return weekMetPlan(weekAdherence(families, schedule, inWeek, successfulIds));
    });
    return { weeks, met, streak: planStreak(met), total: met.filter(Boolean).length };
  }, [sessions, schedule, families, exercises]);

  // Q19 is unanswered: a streak motivates some people and pressures others.
  // So the plain count is always shown and the streak is opt-in, which is what
  // "keep it removable" has to mean if it is to mean anything.
  const streakOn = useSetting('plan.showStreak') === 'true';

  const familyName = (id: string | null) =>
    id === null ? 'Rest' : (families.find((f) => f.id === id)?.name ?? id);

  /** Cycles a day through the families and back to rest. */
  const planDay = (day: DayOfWeek) => {
    Alert.alert(
      `${DAY_NAMES[day]}`,
      'What is this day for?',
      [
        ...families.map((family) => ({
          text: family.name,
          onPress: () => setScheduledFamily(day, family.id),
        })),
        { text: 'Rest day', onPress: () => setScheduledFamily(day, null) },
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const thisWeek = startOfWeek(todayIso());

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title">Plan</ThemedText>

          <View style={styles.weekNav}>
            <Pressable
              onPress={() => setWeekStart(shiftWeek(weekStart, -1))}
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              style={styles.navButton}>
              <ThemedText type="link">‹</ThemedText>
            </Pressable>
            <View style={styles.weekLabel}>
              <ThemedText type="smallBold">
                {weekStart === thisWeek ? 'This week' : `Week of ${weekStart}`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {week.dates[0]} — {week.dates[6]}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setWeekStart(shiftWeek(weekStart, 1))}
              accessibilityRole="button"
              accessibilityLabel="Next week"
              style={styles.navButton}>
              <ThemedText type="link">›</ThemedText>
            </Pressable>
          </View>

          <ThemedText type="code" style={styles.heading}>
            the week
          </ThemedText>

          {week.dates.map((date, index) => {
            const day = index as DayOfWeek;
            const planned = schedule.get(day) ?? null;
            const logged = week.sessionsByDate.get(date) ?? [];
            const isToday = date === todayIso();

            return (
              <Pressable
                key={date}
                onPress={() => planDay(day)}
                accessibilityRole="button"
                accessibilityLabel={`Plan ${DAY_NAMES[day]}`}
                style={[
                  styles.day,
                  { borderColor: isToday ? colors.accent : colors.border },
                ]}>
                <ThemedText type="code" style={styles.dayName}>
                  {DAY_NAMES[day]}
                </ThemedText>
                <View style={styles.dayBody}>
                  <ThemedText type={planned ? 'default' : 'small'}>
                    {familyName(planned)}
                  </ThemedText>
                  {logged.length > 0 && (
                    <ThemedText
                      type="small"
                      style={{
                        color: logged.some((s) => week.successfulIds.has(s.id))
                          ? colors.met
                          : colors.textSecondary,
                      }}>
                      {logged
                        .map(
                          (s) =>
                            `${familyName(s.familyId)}${week.successfulIds.has(s.id) ? ' ✓' : ''}`,
                        )
                        .join(', ')}
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            );
          })}

          <ThemedText type="code" style={styles.heading}>
            against the plan
          </ThemedText>

          {week.adherence.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No plan yet, and nothing logged this week. Tap a day to give it to a family.
            </ThemedText>
          ) : (
            week.adherence.map((row) => (
              <View key={row.familyId} style={[styles.row, { borderColor: colors.border }]}>
                <ThemedText style={styles.rowName}>{familyName(row.familyId)}</ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: row.target > 0 && row.attended >= row.target ? colors.met : colors.text,
                  }}>
                  {row.target > 0 ? `${row.attended} of ${row.target}` : `${row.attended} · unplanned`}
                </ThemedText>
                {/* Said separately, never folded into the number above (C3). */}
                <ThemedText type="small" themeColor="textSecondary" style={styles.rowMet}>
                  {row.successful} met
                </ThemedText>
              </View>
            ))
          )}

          <ThemedText type="code" style={styles.heading}>
            over twelve weeks
          </ThemedText>

          <ThemedText type="small">
            {history.total} of the last 12 weeks followed the plan.
          </ThemedText>

          {streakOn ? (
            <>
              <ThemedText type="small">
                {history.streak === 0
                  ? 'No run going right now.'
                  : `${history.streak} ${history.streak === 1 ? 'week' : 'weeks'} in a row.`}
              </ThemedText>
              <Pressable
                onPress={() => setSetting('plan.showStreak', 'false')}
                accessibilityRole="button"
                style={styles.streakToggle}>
                <ThemedText type="link">Hide the streak</ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setSetting('plan.showStreak', 'true')}
              accessibilityRole="button"
              style={styles.streakToggle}>
              <ThemedText type="link">Show a streak</ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            A session counts towards the week as soon as anything is logged, whether or
            not every muscle group was met. Turning up and succeeding are different
            things, so both are shown. A week with no plan does not count as followed —
            there was nothing to follow.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLabel: { alignItems: 'center' },
  navButton: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { textTransform: 'uppercase', paddingTop: Spacing.three },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayName: { minWidth: 40 },
  dayBody: { flex: 1, gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: { flex: 1 },
  rowMet: { minWidth: 56, textAlign: 'right' },
  streakToggle: { minHeight: MinTouchTarget, justifyContent: 'center' },
  note: { paddingTop: Spacing.three },
});
