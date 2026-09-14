import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import * as SQLite from 'expo-sqlite';

import { ExportCsvRow } from '@/components/export-csv';
import { appliedMigrationCount, catalogueCounts, DATABASE_NAME } from '@/db';
import { checkDatabaseHealth } from '@/db/health';
import { listMuscleGroups } from '@/db/repository';

/**
 * Settings, taxonomy editors and export live here (W12, #15-#17, #48).
 *
 * The session card that used to sit here is gone: starting and resuming a
 * session belongs on Today (#32), which is where it now is.
 *
 * The diagnostics stay for the moment. They are cheap, they answer the first
 * question worth asking when something looks wrong, and unlike the session card
 * nothing else in the app reports them. What the catalogue holds is no longer
 * among them: the counts belong beside the editor that changes them, not in a
 * second list saying the same thing in a different order.
 */
function useDatabaseHints() {
  // Reads, never runs. The root layout applies migrations and seeds the
  // catalogue before any screen mounts.
  const [snapshot] = useState(() => {
    const counts = catalogueCounts();
    return {
      health: checkDatabaseHealth(),
      migrations: appliedMigrationCount(),
      catalogue: {
        ...counts,
        // The implicit group behind abs and cardio is a modelling device, not
        // something he named. The editor hides it; so does this count.
        muscleGroups: listMuscleGroups().filter((g) => !g.implicit).length,
      },
    };
  });

  return snapshot;
}

export default function MoreScreen() {
  const { health, migrations, catalogue } = useDatabaseHints();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">More</ThemedText>

        <ThemedText type="code" style={styles.heading}>
          diagnostics
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow
            title="Database"
            hint={
              <ThemedText type="small">
                {health.ok ? `SQLite ${health.sqliteVersion}` : `failed — ${health.error}`}
              </ThemedText>
            }
          />
          <HintRow
            title="Migrations"
            hint={<ThemedText type="small">{migrations} applied</ThemedText>}
          />
        </ThemedView>

        <ThemedText type="code" style={styles.heading}>
          catalogue
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <Pressable onPress={() => router.push('/catalogue/families')} accessibilityRole="button">
            <HintRow
              title="Families"
              hint={<ThemedText type="link">{catalogue.families} ›</ThemedText>}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/catalogue/muscle-groups')}
            accessibilityRole="button">
            <HintRow
              title="Muscle groups"
              hint={<ThemedText type="link">{catalogue.muscleGroups} ›</ThemedText>}
            />
          </Pressable>
          <Pressable onPress={() => router.push('/catalogue/exercises')} accessibilityRole="button">
            <HintRow
              title="Exercises"
              hint={<ThemedText type="link">{catalogue.exercises} ›</ThemedText>}
            />
          </Pressable>
        </ThemedView>

        {/* Where the data is, and what is looking after it (#43). */}
        <ThemedText type="code" style={styles.heading}>
          your data
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow
            title="Included in your iPhone backup"
            hint={<ThemedText type="small">iCloud</ThemedText>}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Everything lives in one SQLite file inside the app&apos;s Documents folder,
            which iOS includes in the device backup. Restoring this iPhone — or a new one
            — from that backup brings the file back exactly as it was. There is no
            account and no server; it is your iCloud, not ours.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Two things to know. It needs iCloud Backup switched on in Settings, with room
            for it. And a restore is all or nothing — it brings the whole device back, so
            it cannot undo a single mis-typed set. Fixing one of those is what editing a
            past set is for.
          </ThemedText>
          <ThemedText type="code" style={styles.path}>
            {String(SQLite.defaultDatabaseDirectory ?? 'unknown')}/{DATABASE_NAME}
          </ThemedText>

          {/* The only way data leaves the app, now that the JSON backup is
              dropped (D27). For reading elsewhere, not for restoring. */}
          <ExportCsvRow />
          <ThemedText type="small" themeColor="textSecondary">
            One row per set, with the exercise and the muscle group it counted towards.
            For reading in a spreadsheet — restoring is what the backup above is for.
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.heading}>
          not built yet
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          <HintRow title="Settings" hint={<ThemedText type="small">#48</ThemedText>} />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  heading: { textTransform: 'uppercase' },
  card: { gap: Spacing.three, padding: Spacing.four, borderRadius: Spacing.four },
  path: { opacity: 0.6 },
});
