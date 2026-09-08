import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { KeepAwakeWhileTraining } from '@/components/keep-awake-while-training';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { expoDb, useCatalogueState, useMigrationState } from '@/db';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Inspect the database from the dev tools. No-op in production builds.
  useDrizzleStudio(expoDb);

  /**
   * The database is made ready here, above every screen, and nothing renders
   * until it is.
   *
   * It used to happen in the More tab, which worked only because the tabs all
   * mount eagerly — an accident, not a guarantee. Any screen that queried
   * before that tab had finished would hit a table that did not exist yet,
   * which is exactly how the session card failed on a fresh install.
   */
  const migrations = useMigrationState();
  const catalogue = useCatalogueState(migrations);

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  if (migrations.status === 'failed' || catalogue.status === 'failed') {
    const message =
      migrations.status === 'failed' ? migrations.error : 'catalogue failed to load';
    return (
      <ThemeProvider value={theme}>
        <ThemedView style={styles.centre}>
          <ThemedText type="subtitle">The database could not be opened</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        </ThemedView>
      </ThemeProvider>
    );
  }

  if (catalogue.status !== 'ready') {
    // Briefly, on first launch only. The splash overlay is still up.
    return (
      <ThemeProvider value={theme}>
        <ThemedView style={styles.centre}>
          <AnimatedSplashOverlay />
        </ThemedView>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <AnimatedSplashOverlay />
      {/* The session keeps the screen awake, not any particular screen. */}
      <KeepAwakeWhileTraining />
      <View style={styles.fill}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          {/* A session covers the tabs: it is a mode, not a destination. */}
          <Stack.Screen name="session/[id]" />
        </Stack>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
});
