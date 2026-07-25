import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle" accessibilityRole="header">Settings</ThemedText>
        <ThemedText type="smallBold">Local data & privacy</ThemedText>
        <ThemedText>Your data stays on this iPhone. There is no account, automatic sync, sharing, or app-level recovery.</ThemedText>
        <ThemedText>Precise location is temporary while tracking. Sensitive exports and device backups you choose to keep are outside the app&apos;s deletion control.</ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, padding: Spacing.four, gap: Spacing.three },
});
