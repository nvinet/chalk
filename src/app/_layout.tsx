import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { expoDb } from '@/db';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Inspect the database from the dev tools. No-op in production builds.
  useDrizzleStudio(expoDb);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* A session covers the tabs: it is a mode, not a destination. */}
        <Stack.Screen name="session/[id]" />
      </Stack>
    </ThemeProvider>
  );
}
