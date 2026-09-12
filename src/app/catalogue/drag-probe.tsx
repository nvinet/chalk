import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import {
  Sortable,
  SortableItem,
  type SortableRenderItemProps,
} from 'react-native-reanimated-dnd';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * TEMPORARY SCAFFOLDING (#69). Delete once dragging is confirmed working.
 *
 * The square is the control, and it already passed: a bare `Gesture.Pan`
 * writing a shared value into a bare `useAnimatedStyle` moves, which proves
 * gesture-handler and the Reanimated runtime both work here.
 *
 * The cards below are now `react-native-reanimated-dnd`, whose peer range
 * requires Reanimated >= 4.2. The library they replace asked for >= 3.12 with
 * no upper bound and is the newest version its author published — it simply
 * predates Reanimated 4, and its own README example did not drag in this app
 * either.
 *
 * Everything else was ruled out first: the worklet babel transform runs on our
 * code *and* on the library's compiled output, the Reanimated/RN/worklets
 * versions are a supported combination, and `GestureHandlerRootView` is
 * mounted.
 */
const seed = Array(12)
  .fill(null)
  .map((_, i) => ({ id: String(i), label: `Card ${i}` }));

type Item = (typeof seed)[number];

export default function DragProbeScreen() {
  const [log, setLog] = useState('no reorder yet');

  const renderItem = useCallback((props: SortableRenderItemProps<Item>) => {
    const { item, id, ...rest } = props;
    return (
      <SortableItem
        key={id}
        id={id}
        data={item}
        {...rest}
        onDrop={(droppedId, position) => setLog(`dropped ${droppedId} at ${position}`)}>
        <View style={styles.card}>
          <Text style={styles.text}>{item.label}</Text>
        </View>
      </SortableItem>
    );
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <ThemedText type="link">‹ More</ThemedText>
        </Pressable>

        <RawGestureProbe />

        <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
          list: {log} — hold a card, then drag
        </ThemedText>

        <Sortable data={seed} renderItem={renderItem} itemHeight={60} />
      </SafeAreaView>
    </ThemedView>
  );
}

/** The control. Bare gesture-handler, bare Reanimated, no library. */
function RawGestureProbe() {
  const x = useSharedValue(0);
  const [moved, setMoved] = useState('square: not moved');

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      x.value = e.translationX;
    })
    .onEnd(() => {
      'worklet';
      runOnJS(setMoved)('square: MOVED — gesture handler and reanimated work');
      x.value = 0;
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.square, style]} />
      </GestureDetector>
      <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
        {moved}
      </ThemedText>
    </>
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
  square: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#208AEF', marginLeft: 16 },
});
