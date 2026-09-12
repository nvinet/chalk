import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RestBar } from '@/components/rest-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import { promptForSkipReason } from '@/components/skip-reason-prompt';
import {
  abandonSession,
  finishSession,
  listExercises,
  listMuscleGroups,
  skipMuscleGroup,
  unskipMuscleGroup,
  useSession,
} from '@/db/repository';
import {
  evaluateSession,
  indexById,
  outstandingGroups,
  type MuscleGroupOutcome,
} from '@/domain/completion';
import { isFinished, remainingSeconds, restProgress } from '@/domain/rest';
import { lastTimeForPairing } from '@/domain/scoring';
import { skipReasonLabel, type Exercise, type Id, type Session } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { clearRest, useCurrentRest } from '@/hooks/use-rest-timer';

/**
 * W2 — the spine of a session (#20).
 *
 * Every number on this screen comes from `evaluateSession`. The completion rule
 * is not restated here in any form: the UI asks the domain what is met and
 * renders the answer, so the screen cannot drift from the rule.
 */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();

  // Live: adding a set re-reads the session, so progress updates as he logs.
  const session = useSession(id);

  // Before the early return: the rest is global, so this hook cannot be
  // conditional on having found a session.
  const rest = useCurrentRest();

  // The catalogue does not change during a session, so it is read once.
  const catalogue = useMemo(() => {
    const exercises = listExercises();
    return {
      exercises,
      exercisesById: indexById(exercises),
      groupNames: new Map(listMuscleGroups().map((g) => [g.id, g.name])),
    };
  }, []);

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Session not found</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.linkButton}>
            <ThemedText type="link">Go back</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { exercisesById, groupNames } = catalogue;
  const outcome = evaluateSession(session, catalogue);

  /**
   * Both endings land on the summary, replacing this screen rather than
   * stacking on it — going back into a session that is over would be a lie
   * about what can still be logged (#28).
   */
  const showSummary = () =>
    router.replace({ pathname: '/session/[id]/summary', params: { id: session.id } });

  /**
   * Finishing is always allowed (W2), so an incomplete session warns rather
   * than blocks. A session with everything met finishes straight away — there
   * is nothing to warn about, and a prompt would just be a tap in the way.
   */
  /**
   * Ending a session ends any rest with it, scheduled notification included
   * (#63). Routed through one function because there are three ways out —
   * finish, finish-anyway and abandon — and a rest left behind at any of them
   * is a "Rest is up" that arrives once he is home.
   */
  const endSession = (how: 'finish' | 'abandon') => {
    clearRest();
    if (how === 'finish') finishSession(session.id);
    else abandonSession(session.id);
    showSummary();
  };

  const finish = () => {
    const outstanding = outcome.requiredGroupsTotal - outcome.requiredGroupsMet;
    if (outstanding === 0) {
      endSession('finish');
      return;
    }

    Alert.alert(
      `${outcome.requiredGroupsMet} of ${outcome.requiredGroupsTotal} muscle groups met`,
      `${outstanding} still outstanding. Finish anyway?`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Finish',
          onPress: () => endSession('finish'),
        },
      ],
    );
  };

  /** Deliberately harder to reach than Finish, and destructive. */
  const abandon = () => {
    const sets = session.sets.length;
    Alert.alert(
      'Abandon this session?',
      sets === 0
        ? 'It will not count as training.'
        : `It will not count as training. The ${sets} ${sets === 1 ? 'set' : 'sets'} already logged are kept.`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: () => endSession('abandon'),
        },
      ],
    );
  };
  const required = outcome.groups.filter((g) => !g.optional);
  const optional = outcome.groups.filter((g) => g.optional);
  const next = outstandingGroups(outcome).find((g) => !g.optional);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Close session">
            <ThemedText type="link">✕</ThemedText>
          </Pressable>

          <View style={styles.headerTitle}>
            <ThemedText type="smallBold">{familyLabel(session.familyId)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {session.date} · <Elapsed startedAt={session.startedAt} />
            </ThemedText>
          </View>

          {/* Balances the ✕ so the title stays centred. Finishing lives at
              the foot of the screen, with abandoning, where the session ends. */}
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Whatever is resting, wherever it was started. This is the screen
              he is on between exercises, so it is where a rest he no longer
              wants has to be reachable (#63). */}
          {rest.timer && (
            <RestBar
              remaining={remainingSeconds(rest.timer, rest.now)}
              progress={restProgress(rest.timer, rest.now)}
              done={isFinished(rest.timer, rest.now)}
              label={exercisesById.get(rest.timer.exerciseId)?.name}
              onSkip={rest.skip}
            />
          )}

          <ThemedText>
            {outcome.requiredGroupsMet} of {outcome.requiredGroupsTotal} muscle groups met
          </ThemedText>
          <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: outcome.successful ? colors.met : colors.accent,
                  width: `${progressPercent(outcome.requiredGroupsMet, outcome.requiredGroupsTotal)}%`,
                },
              ]}
            />
          </View>

          {required.map((group) => (
            <GroupRow
              key={group.muscleGroupId}
              group={group}
              name={groupNames.get(group.muscleGroupId) ?? group.muscleGroupId}
              session={session}
              exercisesById={exercisesById}
              highlighted={group.muscleGroupId === next?.muscleGroupId}
              onPress={() => openGroup(session.id, group.muscleGroupId)}
              onToggleSkip={() => toggleSkip(session.id, group)}
            />
          ))}

          {optional.length > 0 && (
            <>
              <ThemedText type="code" style={styles.optionalHeading}>
                optional
              </ThemedText>
              {optional.map((group) => (
                <GroupRow
                  key={group.muscleGroupId}
                  group={group}
                  name={groupNames.get(group.muscleGroupId) ?? group.muscleGroupId}
                  session={session}
                  exercisesById={exercisesById}
                  highlighted={false}
                  onPress={() => openGroup(session.id, group.muscleGroupId)}
                  onToggleSkip={() => toggleSkip(session.id, group)}
                />
              ))}
            </>
          )}

          {/* The end of the list is where the session ends. Finishing is a
              button because it is the ordinary way out; abandoning stays a
              quiet link because it is not. */}
          <View style={styles.endActions}>
            {/* Outlined, not filled: Continue is the primary action and this
                ends the session. Two identical pills would say they weigh the
                same, which they do not. */}
            <Pressable
              onPress={finish}
              accessibilityRole="button"
              style={[styles.finish, { borderColor: colors.border }]}>
              <ThemedText type="smallBold">
                {outcome.successful ? 'Finish session' : 'Finish session early'}
              </ThemedText>
            </Pressable>

            <Pressable onPress={abandon} accessibilityRole="button" style={styles.abandon}>
              <ThemedText type="small" style={{ color: colors.warning }}>
                Abandon session
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>

        {next && (
          <Pressable
            onPress={() => openGroup(session.id, next.muscleGroupId)}
            accessibilityRole="button">
            <ThemedView type="backgroundElement" style={styles.cta}>
              <ThemedText type="smallBold">
                Continue › {groupNames.get(next.muscleGroupId) ?? next.muscleGroupId}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/** Long-press a group to pass on it, or to change your mind. */
function toggleSkip(sessionId: string, group: MuscleGroupOutcome) {
  if (group.skipped) {
    unskipMuscleGroup(sessionId, group.muscleGroupId);
    return;
  }
  promptForSkipReason('Skip this muscle group?', (reason) =>
    skipMuscleGroup(sessionId, group.muscleGroupId, reason),
  );
}

function openGroup(sessionId: string, groupId: string) {
  router.push({
    pathname: '/session/[id]/[groupId]',
    params: { id: sessionId, groupId },
  });
}

function GroupRow({
  group,
  name,
  session,
  exercisesById,
  highlighted,
  onPress,
  onToggleSkip,
}: {
  group: MuscleGroupOutcome;
  name: string;
  session: Session;
  exercisesById: ReadonlyMap<Id, Exercise>;
  highlighted: boolean;
  onPress: () => void;
  onToggleSkip: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onToggleSkip}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      accessibilityHint="Long press to skip this muscle group"
      style={[
        styles.group,
        { borderColor: colors.border },
        highlighted && { borderColor: colors.accent, borderWidth: 2 },
      ]}>
      <View style={styles.groupHead}>
        <ThemedText type="smallBold">
          {group.met && !group.optional ? '✓ ' : ''}
          {name}
          <ThemedText type="small" themeColor="textSecondary">
            {'  ›'}
          </ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {group.optional
            ? '0 required — never blocks the session'
            : `${group.loggedCount} of ${group.required} exercises logged`}
        </ThemedText>
        {group.skipped && (
          // Says why it went untrained. It does not excuse it: the group is
          // still unmet and the session still fails (#24).
          <ThemedText type="small" style={{ color: colors.warning }}>
            Skipped — {skipReasonLabel(group.skipReason).toLowerCase()}
            {group.met ? ', but logged anyway' : ''}
          </ThemedText>
        )}
      </View>

      {group.exerciseIds.map((exerciseId) => {
        const exercise = exercisesById.get(exerciseId);
        if (!exercise) return null;
        // Reuses the same summary the logging screen shows for "last time",
        // pointed at this session rather than the history.
        const summary = lastTimeForPairing(
          [session],
          { exerciseId, muscleGroupId: group.muscleGroupId },
          exercise,
        );
        return (
          <View key={exerciseId} style={styles.exerciseRow}>
            <ThemedText type="small">· {exercise.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {summary?.summary ?? ''}
            </ThemedText>
          </View>
        );
      })}

      {/* Sets, not exercises: since D23 a group can hold two sets and still
          show a loggedCount of 0, and "nothing logged yet" would be a lie he
          could disprove by scrolling. */}
      {!group.met && !group.optional && !group.skipped && group.loggedSetCount === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          nothing logged yet
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Ticking elapsed time. A real interval, so it is a genuine effect. */
function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const started = Date.parse(startedAt);
  const seconds = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <>{`${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`}</>
  );
}

function progressPercent(met: number, total: number): number {
  return total === 0 ? 100 : Math.round((met / total) * 100);
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
  headerButton: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { alignItems: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  group: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupHead: { gap: Spacing.half },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between' },
  optionalHeading: { textTransform: 'uppercase', marginTop: Spacing.three },
  cta: {
    margin: Spacing.four,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.half,
  },
  linkButton: { minHeight: MinTouchTarget, justifyContent: 'center' },
  endActions: { marginTop: Spacing.five, gap: Spacing.two },
  finish: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  abandon: {
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
