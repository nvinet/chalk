import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * TEMPORARY SCAFFOLDING (#69). Delete once dragging is confirmed working.
 *
 * The library's own README example, copied as literally as possible: plain
 * `View`s and `Text`, no theme, no database, no nesting, no custom gesture, no
 * styling of ours anywhere. Nothing in it is Chalk's.
 *
 * It exists to answer one question that three rounds of guessing could not:
 * **does dragging work at all in this app?**
 *
 *  - If these cards drag, the library and the environment are fine and the
 *    fault is somewhere in the catalogue screens — which narrows it to code I
 *    can read.
 *  - If they do not, nothing in the catalogue screens was ever the cause, and
 *    the problem is the library against Reanimated 4 or something about this
 *    app's setup.
 *
 * Delete this file, its `Stack.Screen`, and the row in More that reaches it.
 */
const seed = Array(12)
  .fill(null)
  .map((_, i) => ({ id: String(i), label: `Card ${i}` }));

export default function DragProbeScreen() {
  const [data, setData] = useState(seed);
  const [log, setLog] = useState('no reorder yet');

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    setData((value) => reorderItems(value, from, to));
    setLog(`reordered ${from} → ${to}`);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <ThemedText type="link">‹ More</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
          {log} — hold a card, then drag
        </ThemedText>

        <ReorderableList
          data={data}
          onReorder={handleReorder}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Card label={item.label} />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Card({ label }: { label: string }) {
  const drag = useReorderableDrag();
  return (
    <Pressable style={styles.card} onLongPress={drag}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  back: { padding: 16 },
  status: { paddingHorizontal: 16, paddingBottom: 8 },
  card: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  text: { fontSize: 20, color: '#111111' },
});
