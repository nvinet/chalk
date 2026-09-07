import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The five tabs (#14).
 *
 * SF Symbols rather than bundled images: five more PNGs at three densities is
 * fifteen assets to keep in step with the system's own weight and colour, and
 * these are all stock symbols.
 */
const TABS = [
  { name: 'index', label: 'Today', sf: 'figure.strengthtraining.traditional' },
  { name: 'plan', label: 'Plan', sf: 'calendar' },
  { name: 'history', label: 'History', sf: 'clock.arrow.circlepath' },
  { name: 'progress', label: 'Progress', sf: 'chart.line.uptrend.xyaxis' },
  { name: 'more', label: 'More', sf: 'ellipsis' },
] as const;

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.accent } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
