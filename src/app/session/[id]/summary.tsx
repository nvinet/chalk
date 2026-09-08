import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, MinTouchTarget, Spacing } from '@/constants/theme';
import {
  getSession,
  listExercises,
  listMuscleGroups,
  sessionsBefore,
  setSessionNotes,
} from '@/db/repository';
import { evaluateSession, isSetLogged, indexById } from '@/domain/completion';
import {
  formatKg,
  personalBestsInSession,
  sessionVolumeKg,
  type NewPersonalBest,
} from '@/domain/scoring';
import { skipReasonLabel } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * W5 — what the session came to (#28).
 *
 * Verdict first, then the evidence for it. The verdict is his own rule, not an
 * opinion: it comes from evaluateSession, the same function the session screen
 * used while he was training.
 *
 * The wireframe ends with "Save session" and "Discard". Neither applies here.
 * Every set was written as it was entered (N7), so there is nothing left to
 * save, and discarding would mean deleting work that actually happened. The
 * session is already finished by the time this screen opens; this is a report,
 * not a commit step.
 */
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();

  // Read once. A finished session does not change underneath the screen that
  // is reporting on it.
  const data = useMemo(() => {
    const session = getSession(id);
    if (!session) return null;

    const exercises = listExercises();
    const outcome = evaluateSession(session, { exercises });
    const exercisesById = indexById(exercises);

    return {
      session,
      outcome,
      exercisesById,
      groupNames: new Map(listMuscleGroups().map((g) => [g.id, g.name])),
      loggedSets: session.sets.filter((s) => {
        const exercise = exercisesById.get(s.exerciseId);
        return exercise ? isSetLogged(s, exercise.tracking) : false;
      }).length,
      volumeKg: sessionVolumeKg(session, { exercises }),
      bests: groupBests(
        personalBestsInSession(session, sessionsBefore(id), { exercises }),
        exercisesById,
      ),
    };
  }, [id]);

  const [notes, setNotes] = useState(() => data?.session.notes ?? '');

  if (!data) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Session not found</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { session, outcome, groupNames } = data;
  const met = outcome.requiredGroupsMet;
  const total = outcome.requiredGroupsTotal;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerButton} />
          <View style={styles.headerTitle}>
            <ThemedText type="smallBold">
              {session.status === 'abandoned' ? 'Session abandoned' : 'Session complete'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {familyLabel(session.familyId)} · {session.date}
            </ThemedText>
          </View>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Verdict first. His rule, not an opinion. */}
          <ThemedView
            type="backgroundElement"
            style={[
              styles.verdict,
              { borderColor: outcome.successful ? colors.met : colors.border },
            ]}>
            <ThemedText type="subtitle">
              {outcome.successful ? 'Session successful' : 'Session incomplete'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {total === 0
                ? 'Nothing was required of this session'
                : outcome.successful
                  ? `All ${total} muscle ${total === 1 ? 'group' : 'groups'} met their minimum`
                  : `${met} of ${total} muscle groups met their minimum`}
            </ThemedText>
          </ThemedView>

          <ThemedText type="code" style={styles.heading}>
            muscle groups
          </ThemedText>
          <View style={styles.groups}>
            {outcome.groups.map((group) => (
              <View
                key={group.muscleGroupId}
                style={[styles.groupRow, { borderColor: colors.border }]}>
                <ThemedText style={styles.groupName}>
                  {group.met ? '✓ ' : '· '}
                  {groupNames.get(group.muscleGroupId) ?? group.muscleGroupId}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {group.optional
                    ? `${group.loggedCount} · optional`
                    : `${group.loggedCount} of ${group.required}`}
                </ThemedText>
              </View>
            ))}
            {outcome.groups
              .filter((g) => g.skipped)
              .map((group) => (
                <ThemedText
                  key={`${group.muscleGroupId}-skip`}
                  type="small"
                  style={{ color: colors.warning }}>
                  {groupNames.get(group.muscleGroupId) ?? group.muscleGroupId} skipped —{' '}
                  {skipReasonLabel(group.skipReason).toLowerCase()}
                </ThemedText>
              ))}
          </View>

          <View style={styles.tiles}>
            <Tile label="duration" value={formatDuration(session)} />
            <Tile label="volume" value={formatKg(data.volumeKg)} />
            <Tile label="sets" value={String(data.loggedSets)} />
            <Tile label="personal bests" value={String(data.bests.length)} />
          </View>

          {data.bests.length > 0 && (
            <View style={styles.bests}>
              {data.bests.map((best) => (
                <ThemedText key={best.key} type="small" style={{ color: colors.met }}>
                  {best.text}
                </ThemedText>
              ))}
            </View>
          )}

          <ThemedText type="code" style={styles.heading}>
            session notes
          </ThemedText>
          <TextInput
            value={notes}
            onChangeText={(text) => {
              setNotes(text);
              // Saved as typed, like everything else here.
              setSessionNotes(session.id, text);
            }}
            placeholder="Anything worth remembering"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[styles.notes, { color: colors.text, borderColor: colors.border }]}
          />
        </ScrollView>

        <Pressable
          onPress={() => router.dismissTo('/')}
          accessibilityRole="button"
          style={styles.doneWrap}>
          <ThemedView style={[styles.done, { backgroundColor: colors.accent }]}>
            <ThemedText type="smallBold" style={styles.doneLabel}>
              Done
            </ThemedText>
          </ThemedView>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const colors = useTheme();
  return (
    <View style={[styles.tile, { borderColor: colors.border }]}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * One line per exercise, not one per kind.
 *
 * personalBestsInSession reports each kind separately, so a single good
 * session against any history produces three lines per exercise — nine here
 * for three exercises. That is noise, and it buries the one number he
 * actually looks for. The headline is the heaviest weight when there is one,
 * with the other kinds named rather than spelled out.
 */
function groupBests(
  bests: NewPersonalBest[],
  exercisesById: ReadonlyMap<string, { name: string }>,
): { key: string; text: string }[] {
  const byPairing = new Map<string, NewPersonalBest[]>();
  for (const best of bests) {
    const key = `${best.pairing.exerciseId}::${best.pairing.muscleGroupId}`;
    byPairing.set(key, [...(byPairing.get(key) ?? []), best]);
  }

  return [...byPairing.entries()].map(([key, group]) => {
    const name = exercisesById.get(group[0]!.pairing.exerciseId)?.name ?? 'Exercise';
    const heaviest = group.find((b) => b.kind === 'heaviest');
    const headline = heaviest ?? group[0]!;

    const was =
      headline.previous === null ? 'first time' : `was ${formatKg(headline.previous)}`;
    // Short forms in the tail: the headline already carries the long label,
    // and repeating it wraps every line onto two.
    const others = group.filter((b) => b !== headline).map((b) => shortBest(b.kind));
    const alsoText = others.length > 0 ? ` · also ${others.join(', ')}` : '';

    return {
      key,
      text: `${name} — ${describeBest(headline.kind)} ${formatKg(headline.value)} (${was})${alsoText}`,
    };
  });
}

function shortBest(kind: string): string {
  if (kind === 'heaviest') return 'heaviest';
  if (kind === 'estimatedOneRepMax') return '1RM';
  return 'volume';
}

function describeBest(kind: string): string {
  if (kind === 'heaviest') return 'heaviest';
  if (kind === 'estimatedOneRepMax') return 'estimated 1RM';
  return 'best set volume';
}

/**
 * Wall clock from start to finish.
 *
 * Whether this is worth showing at all is still open — if session duration goes,
 * this tile and this function go with it and nothing else changes.
 */
function formatDuration(session: { startedAt: string; finishedAt?: string | null }): string {
  const started = Date.parse(session.startedAt);
  const ended = session.finishedAt ? Date.parse(session.finishedAt) : Date.now();
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return '—';

  const seconds = Math.max(0, Math.floor((ended - started) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
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
  headerButton: { minHeight: MinTouchTarget, minWidth: 60 },
  headerTitle: { alignItems: 'center' },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  verdict: {
    gap: Spacing.half,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 2,
  },
  heading: { textTransform: 'uppercase', marginTop: Spacing.two },
  groups: { gap: Spacing.one },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupName: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bests: { gap: Spacing.half },
  notes: {
    minHeight: 96,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    textAlignVertical: 'top',
  },
  doneWrap: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  done: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
  },
  doneLabel: { color: '#ffffff' },
});
