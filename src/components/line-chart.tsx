import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One line over time (#38).
 *
 * Drawn by hand rather than with a charting library. The chart is a single
 * series with a floor, a ceiling and a few dots — a library would be a large
 * dependency, a second styling system and someone else's opinion about axes,
 * for something that is forty lines of SVG.
 *
 * **The y-axis does not start at zero**, and that is deliberate. Working
 * weights sit in a narrow band well above it — a chest press moving from 80 to
 * 85 kg is the whole story, and a zero-based axis would flatten it into a line
 * that never moves. The floor and ceiling are labelled so the scale is never
 * implied.
 *
 * A single point is drawn as a dot with no line, because one session is not a
 * trend and a horizontal line would suggest it was.
 */
export function LineChart({
  points,
  height = 180,
  width,
  format,
}: {
  points: { date: string; value: number }[];
  height?: number;
  /** Measured by the caller; SVG needs a number, not a percentage. */
  width: number;
  format: (value: number) => string;
}) {
  const colors = useTheme();

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Nothing logged for this yet.
        </ThemedText>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A flat series would divide by zero; give it a band so the line sits mid-height.
  const span = high - low || Math.max(1, high * 0.1);

  const padX = 8;
  const padY = 14;
  const plotWidth = Math.max(1, width - padX * 2);
  const plotHeight = Math.max(1, height - padY * 2);

  const x = (index: number) =>
    points.length === 1
      ? padX + plotWidth / 2
      : padX + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => padY + (1 - (value - low) / span) * plotHeight;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Floor and ceiling, so the band the line moves in is visible. */}
        <Line x1={padX} y1={y(high)} x2={width - padX} y2={y(high)} stroke={colors.border} strokeWidth={1} />
        <Line x1={padX} y1={y(low)} x2={width - padX} y2={y(low)} stroke={colors.border} strokeWidth={1} />

        {points.length > 1 && (
          <Path d={path} stroke={colors.accent} strokeWidth={2} fill="none" />
        )}

        {points.map((point, i) => (
          <Circle
            key={`${point.date}-${i}`}
            cx={x(i)}
            cy={y(point.value)}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? colors.accent : colors.border}
          />
        ))}
      </Svg>

      <View style={styles.scale}>
        <ThemedText type="small" themeColor="textSecondary">
          {format(low)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {format(high)}
        </ThemedText>
      </View>

      <View style={styles.scale}>
        <ThemedText type="small" themeColor="textSecondary">
          {points[0]?.date}
        </ThemedText>
        {points.length > 1 && (
          <ThemedText type="small" themeColor="textSecondary">
            {points[points.length - 1]?.date}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  scale: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.one },
});
