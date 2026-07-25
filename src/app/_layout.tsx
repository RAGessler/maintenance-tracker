import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { FirstRunDisclosure } from '@/components/first-run-disclosure';
import { ThemedText } from '@/components/themed-text';
import { currentDisclosureVersion } from '@/constants/disclosure';
import { maintenanceStore } from '../../modules/maintenance-store';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [disclosureAccepted, setDisclosureAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    maintenanceStore.product
      .getBootstrap()
      .then((bootstrap) => setDisclosureAccepted(bootstrap.disclosureVersion === currentDisclosureVersion))
      .catch(() => setDisclosureAccepted(false));
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {Platform.OS === 'web' ? (
        <View style={styles.loading}><ThemedText>Maintenance Tracker is available in the iOS development build.</ThemedText></View>
      ) : disclosureAccepted === null ? (
        <View style={styles.loading} accessibilityLabel="Loading Maintenance Tracker">
          <ActivityIndicator />
        </View>
      ) : disclosureAccepted ? (
        <AppTabs />
      ) : (
        <FirstRunDisclosure onAccepted={() => setDisclosureAccepted(true)} />
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
