import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { today as todayIso } from '@/db/ids';
import { listExercises, listFamilies, listMuscleGroups, recentSessions } from '@/db/repository';
import { csvFilename, toCsv } from '@/domain/csv';

/**
 * Writes every set to a CSV and hands it to the iOS share sheet (#30).
 *
 * The file is written to the cache directory on purpose. It is a copy made to
 * be given away — once it has gone to Files, Mail or anywhere else, this one is
 * rubbish, and the cache is the directory iOS is allowed to empty. Writing it
 * beside the database would grow `Documents` forever and put stale copies of
 * the data into every device backup.
 */
export function ExportCsvRow() {
  const [busy, setBusy] = useState(false);

  const exportCsv = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const csv = toCsv(
        // Everything, not a window: an export that quietly stopped at some
        // horizon would be worse than no export.
        recentSessions(100000),
        { exercises: listExercises() },
        {
          families: new Map(listFamilies().map((f) => [f.id, f.name])),
          muscleGroups: new Map(listMuscleGroups().map((g) => [g.id, g.name])),
        },
      );

      const directory = new Directory(Paths.cache, 'export');
      if (!directory.exists) directory.create({ intermediates: true });

      const file = new File(directory, csvFilename(todayIso()));
      if (file.exists) file.delete();
      file.create();
      file.write(csv);

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', `The file is at ${file.uri}`);
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Chalk export',
      });
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={exportCsv} accessibilityRole="button" disabled={busy}>
      <ThemedText type="link">{busy ? 'Preparing…' : 'Export every set as CSV'}</ThemedText>
    </Pressable>
  );
}
