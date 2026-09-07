/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Both themes are defined from the start. Retrofitting colour is worse than
 * doing it now, and every token below has a job in the app rather than being
 * a palette for its own sake.
 */
export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    /** Hairlines between rows, and the edge of a card. */
    border: '#D8D9DE',
    /** Interactive things and the selected tab. */
    accent: '#208AEF',
    /** A muscle group that has met its required machine count. */
    met: '#2E7D32',
    /** A group still outstanding — informational, never alarming. */
    outstanding: '#8A6D00',
    /** An implausible value. Warns, never rejects. */
    warning: '#B3261E',
    /** An optional group: shown, trainable, never blocking. */
    optional: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    border: '#3A3D42',
    accent: '#4DA3FF',
    met: '#6FCF77',
    outstanding: '#E0B341',
    warning: '#FF6B60',
    optional: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Minimum size for anything tappable, in points.
 *
 * Everything that can be pressed must be at least this in both directions —
 * sets are logged with sweaty hands, standing up, mid-session.
 */
export const MinTouchTarget = 44;
