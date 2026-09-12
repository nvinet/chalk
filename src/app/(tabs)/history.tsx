import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { today as todayIso } from '@/db/ids';
import { listExercises, listFamilies, useRecentSessions } from '@/db/repository';
import {
  familyInitials,
  monthGrid,
  monthName,
  monthOf,
  shiftMonth,
  type Month,
} from '@/domain/calendar';
import { evaluateSession } from '@/domain/completion';
import type { Session } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W7 — every session by date, and a month at a glance (#36).
 *
 * The calendar answers a different question from the list: not "what did I do
 * on the 8th" but "how has this month gone" — which days were trained, with
 * what, and whether it counted.
 */
export default function HistoryScreen() {
  const colors = useTheme();
  const sessions = useRecentSessions(200);
  const catalogue = useMemo(() => {
    const families = listFamilies();
    return { families, exercises: listExercises(), initials: familyInitials(families) };
  }, []);

  const [month, setMonth] = useState<Month>(() => monthOf(todayIso()));
  const [familyId, setFamilyId] = useState<string | null>(null);
  // Collapsed by default: the list answers the everyday question, and a month
  // grid is a lot of screen for something glanced at occasionally.
  const [showCalendar, setShowCalendar] = useState(false);
  // Off by default (#64). An abandoned session is one he walked away from, and
  // listing it beside real ones makes the history a record of intentions.
  const [showAbandoned, setShowAbandoned] = useState(false);

  const visible = familyId ? sessions.filter((s) => s.familyId === familyId) : sessions;

  // Hidden, never dropped. The sets logged before a session was abandoned are
  // real, and `counts()` in planning.ts already keeps such a session out of
  // adherence — so this is a display filter and nothing more.
  const abandoned = visible.filter((s) => s.status === 'abandoned');
  const listed = showAbandoned ? visible : visible.filter((s) => s.status !== 'abandoned');

  // Judged once, here: the list and the calendar must not disagree about
  // whether a session counted.
  const verdicts = useMemo(() => {
    const map = new Map<string, { session: Session; successful: boolean; sets: number }>();
    for (const session of visible) {
      const outcome = evaluateSession(session, { exercises: catalogue.exercises });
      map.set(session.id, {
        session,
        successful: outcome.successful,
        sets: session.sets.length,
      });
    }
    return map;
  }, [visible, catalogue.exercises]);

  const byDate = new Map<string, { session: Session; successful: boolean }[]>();
  for (const entry of verdicts.values()) {
    if (entry.session.status === 'abandoned') continue;
    const held = byDate.get(entry.session.date) ?? [];
    byDate.set(entry.session.date, [...held, entry]);
  }

  const open = (session: Session) =>
    router.push({ pathname: '/session/[id]/summary', params: { id: session.id } });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title">History</ThemedText>

          {/* Chips rather than the wireframe's "Filter" button: one tap to
              apply and the current filter is always visible. */}
          <View style={styles.filters}>
            <Chip label="All" active={familyId === null} onPress={() => setFamilyId(null)} />
            {catalogue.families.map((family) => (
              <Chip
                key={family.id}
                label={family.name}
                active={familyId === family.id}
                onPress={() => setFamilyId(familyId === family.id ? null : family.id)}
              />
            ))}
          </View>

          {showCalendar && (
            <>
          <View style={styles.monthHead}>
            <ThemedText type="smallBold">{monthName(month)}</ThemedText>
            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setMonth(shiftMonth(month, -1))}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={styles.navButton}>
                <ThemedText type="link">‹</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setMonth(shiftMonth(month, 1))}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={styles.navButton}>
                <ThemedText type="link">›</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.weekdays}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <ThemedText key={i} type="code" themeColor="textSecondary" style={styles.cell}>
                {day}
              </ThemedText>
            ))}
          </View>

          {monthGrid(month).map((week, i) => (
            <View key={i} style={styles.week}>
              {week.map((date, j) => (
                <Day
                  key={j}
                  date={date}
                  entries={date ? (byDate.get(date) ?? []) : []}
                  isToday={date === todayIso()}
                  initials={catalogue.initials}
                  onPress={open}
                />
              ))}
            </View>
          ))}

          <View style={styles.legend}>
            <ThemedText type="small" themeColor="textSecondary">
              ● all groups met    ○ some groups missed
            </ThemedText>
          </View>
            </>
          )}

          <View style={styles.headingRow}>
            <ThemedText type="code" style={styles.heading}>
              {familyId ? `${familyLabel(familyId)} sessions` : 'recent sessions'}
            </ThemedText>
            {/* Beside the label rather than in the top-right corner, which
                Expo Go's dev button covers. */}
            <Pressable
              onPress={() => setShowCalendar((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={showCalendar ? 'Hide calendar' : 'Show calendar'}
              style={[
                styles.calendarToggle,
                {
                  borderColor: showCalendar ? colors.accent : colors.border,
                  backgroundColor: showCalendar ? colors.backgroundElement : 'transparent',
                },
              ]}>
              <SymbolView
                name="calendar"
                tintColor={showCalendar ? colors.accent : colors.text}
                size={18}
              />
            </Pressable>
          </View>

          {/* Said out loud rather than silently omitted: rows are missing from
              this list, and the sets inside them were really logged (#64). */}
          {abandoned.length > 0 && (
            <Pressable
              onPress={() => setShowAbandoned((shown) => !shown)}
              accessibilityRole="button"
              style={styles.abandonedToggle}>
              <ThemedText type="small" themeColor="textSecondary">
                {abandoned.length} abandoned {abandoned.length === 1 ? 'session' : 'sessions'}{' '}
                {showAbandoned ? 'shown · hide' : 'hidden · show'}
              </ThemedText>
            </Pressable>
          )}

          {listed.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing logged yet.
            </ThemedText>
          )}

          {listed.map((session) => {
            const verdict = verdicts.get(session.id);
            return (
              <Pressable
                key={session.id}
                onPress={() => open(session)}
                accessibilityRole="button"
                style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowDate}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {session.date}
                  </ThemedText>
                </View>
                {/* One line, not two: a family and a set count are a single
                    fact about the session, and stacking them halved how many
                    sessions fit on screen. */}
                <View style={styles.rowBody}>
                  <ThemedText type="smallBold">{familyLabel(session.familyId)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {describe(session, verdict?.sets ?? 0)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  ›
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Day({
  date,
  entries,
  isToday,
  initials,
  onPress,
}: {
  date: string | null;
  entries: { session: Session; successful: boolean }[];
  isToday: boolean;
  initials: Map<string, string>;
  onPress: (session: Session) => void;
}) {
  const colors = useTheme();

  if (!date) return <View style={styles.cell} />;

  const day = Number(date.slice(8, 10));
  const first = entries[0];

  return (
    <Pressable
      style={styles.cell}
      disabled={!first}
      onPress={() => first && onPress(first.session)}
      accessibilityRole={first ? 'button' : undefined}>
      <ThemedText
        type="small"
        themeColor={isToday ? 'text' : 'textSecondary'}
        style={isToday ? styles.today : undefined}>
        {day}
      </ThemedText>
      {first && (
        // Filled when every required group was met, hollow when not — the
        // shape carries the verdict so the letter can carry the family.
        <View
          style={[
            styles.badge,
            {
              borderColor: colors.text,
              backgroundColor: first.successful ? colors.text : 'transparent',
            },
          ]}>
          <ThemedText
            type="code"
            style={{ color: first.successful ? colors.background : colors.text }}>
            {initials.get(first.session.familyId) ?? '?'}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.chip,
        { borderColor: active ? colors.accent : colors.border },
        active && { backgroundColor: colors.backgroundElement },
      ]}>
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

function describe(session: Session, sets: number): string {
  if (session.status === 'abandoned') return 'abandoned';
  if (session.status === 'inProgress') return 'in progress';
  return `${sets} ${sets === 1 ? 'set' : 'sets'}`;
}

function familyLabel(familyId: string): string {
  return familyId.charAt(0).toUpperCase() + familyId.slice(1);
}

const styles = StyleSheet.create({
  abandonedToggle: { minHeight: MinTouchTarget, justifyContent: 'center' },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarToggle: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', gap: Spacing.three },
  navButton: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: { flexDirection: 'row' },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 44, gap: 2 },
  today: { textDecorationLine: 'underline' },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { paddingTop: Spacing.two },
  heading: { textTransform: 'uppercase', marginTop: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowDate: { width: 96 },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
});
