import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { today as todayIso } from '@/db/ids';
import {
  listExercises,
  listFamilies,
  muscleGroupsForFamily,
  startSession,
  useRecentSessions,
} from '@/db/repository';
import { evaluateSession } from '@/domain/completion';
import {
  countsByFamily,
  lastSessionByFamily,
  sessionsThisWeek,
  suggestFamily,
} from '@/domain/planning';
import type { Family, Session } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W1 — what to train today, and one tap to start it (#32).
 *
 * The suggestion is the family left longest, not the one furthest behind the
 * weekly plan the issue describes: the schedule is defined by hand and ships
 * empty (D19), and Q9's frequency values were never set, so there is no plan
 * to be behind. Everything here is derived from sessions already logged.
 */
export default function TodayScreen() {
  const colors = useTheme();

  // Live, so starting or finishing a session updates this screen with no
  // refetch — which is what makes the resume card appear and disappear.
  const sessions = useRecentSessions();

  // The catalogue does not change while this screen is open.
  const catalogue = useMemo(
    () => ({ families: listFamilies(), exercises: listExercises() }),
    [],
  );

  const date = todayIso();
  const open = sessions.find((s) => s.status === 'inProgress') ?? null;
  const suggested = suggestFamily(catalogue.families, sessions);
  const week = sessionsThisWeek(sessions, date);
  const counts = countsByFamily(catalogue.families, week);
  const lastByFamily = lastSessionByFamily(sessions);
  const lastFinished = sessions.find((s) => s.status === 'finished');
  const data = { date, ...catalogue, sessions, open, suggested, week, lastByFamily };

  const begin = (familyId: string) => {
    const started = startSession(familyId);
    router.push({ pathname: '/session/[id]', params: { id: started.id } });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heading}>
            <ThemedText type="title">{formatLongDate(data.date)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {data.open
                ? `${familyLabel(data.open.familyId)} session in progress`
                : data.suggested
                  ? `${familyLabel(data.suggested.id)} day`
                  : 'no families yet'}
            </ThemedText>
          </View>

          {data.open ? (
            <ResumeCard session={data.open} />
          ) : (
            data.suggested && (
              <SuggestionCard
                family={data.suggested}
                last={data.lastByFamily.get(data.suggested.id) ?? null}
                exercises={data.exercises}
                onStart={() => begin(data.suggested!.id)}
              />
            )
          )}

          {!data.open && data.families.length > 1 && (
            <View style={styles.others}>
              <ThemedText type="code">or log a different family</ThemedText>
              <View style={styles.otherRow}>
                {data.families
                  .filter((f) => f.id !== data.suggested?.id)
                  .map((family) => (
                    <Pressable
                      key={family.id}
                      onPress={() => begin(family.id)}
                      accessibilityRole="button"
                      style={[styles.chip, { borderColor: colors.border }]}>
                      <ThemedText type="small">{family.name}</ThemedText>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}

          <View style={styles.week}>
            <ThemedText type="code">this week</ThemedText>
            {data.families.map((family) => (
              <View key={family.id} style={styles.weekRow}>
                <ThemedText style={styles.weekName}>{family.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {counts.get(family.id) ?? 0}
                </ThemedText>
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              {data.week.length} {data.week.length === 1 ? 'session' : 'sessions'} since Monday.
              Targets arrive with the weekly plan (#33).
            </ThemedText>
          </View>

          {lastFinished && (
            <ThemedView type="backgroundElement" style={styles.last}>
              <ThemedText type="code">last session</ThemedText>
              <ThemedText type="smallBold">
                {familyLabel(lastFinished.familyId)} · {lastFinished.date}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {summarise(lastFinished, data.exercises)}
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SuggestionCard({
  family,
  last,
  exercises,
  onStart,
}: {
  family: Family;
  last: Session | null;
  exercises: ReturnType<typeof listExercises>;
  onStart: () => void;
}) {
  const colors = useTheme();
  const groups = muscleGroupsForFamily(family.id).filter((g) => !g.group.implicit);

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <ThemedText type="code">{family.name.toLowerCase()}</ThemedText>
      <ThemedText type="smallBold">
        {groups.length > 0
          ? groups.map((g) => g.group.name).join(' · ')
          : 'no muscle groups yet'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {last ? `Last done ${last.date} — ${summarise(last, exercises)}` : 'Never done'}
      </ThemedText>
      <Pressable onPress={onStart} accessibilityRole="button">
        <ThemedView style={[styles.primary, { backgroundColor: colors.accent }]}>
          <ThemedText type="smallBold" style={styles.primaryLabel}>
            Start {family.name.toLowerCase()} session
          </ThemedText>
        </ThemedView>
      </Pressable>
    </View>
  );
}

function ResumeCard({ session }: { session: Session }) {
  const colors = useTheme();
  return (
    <View style={[styles.card, { borderColor: colors.accent }]}>
      <ThemedText type="code">in progress</ThemedText>
      <ThemedText type="smallBold">
        {familyLabel(session.familyId)} · started {session.date}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {session.sets.length} {session.sets.length === 1 ? 'set' : 'sets'} logged
      </ThemedText>
      <Pressable
        onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
        accessibilityRole="button">
        <ThemedView style={[styles.primary, { backgroundColor: colors.accent }]}>
          <ThemedText type="smallBold" style={styles.primaryLabel}>
            Continue session
          </ThemedText>
        </ThemedView>
      </Pressable>
    </View>
  );
}

function summarise(session: Session, exercises: ReturnType<typeof listExercises>): string {
  const outcome = evaluateSession(session, { exercises });
  const sets = session.sets.length;
  return `${outcome.requiredGroupsMet} of ${outcome.requiredGroupsTotal} muscle groups met · ${sets} ${sets === 1 ? 'set' : 'sets'}`;
}

function formatLongDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function familyLabel(familyId: string): string {
  return familyId.charAt(0).toUpperCase() + familyId.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  heading: { gap: Spacing.half },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    minHeight: 52,
    marginTop: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
  },
  primaryLabel: { color: '#ffffff' },
  others: { gap: Spacing.two },
  otherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  week: { gap: Spacing.two },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekName: { flex: 1 },
  last: { gap: Spacing.half, padding: Spacing.four, borderRadius: Spacing.four },
});
