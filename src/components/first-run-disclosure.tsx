import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { currentDisclosureVersion } from '@/constants/disclosure';
import { Spacing } from '@/constants/theme';
import { maintenanceStore } from '../../modules/maintenance-store';

export function FirstRunDisclosure({ onAccepted }: Readonly<{ onAccepted: () => void }>) {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await maintenanceStore.product.acceptDisclosure(currentDisclosureVersion);
      onAccepted();
    } catch {
      setError('Your choice could not be saved. Check storage access and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle" accessibilityRole="header">
            {detailsVisible ? 'What is collected, kept, and deleted' : 'Everything lives on this iPhone'}
          </ThemedText>
          {detailsVisible ? <DisclosureDetails /> : <DisclosureSummary />}
          {error && <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailsVisible ? 'Start using Maintenance Tracker' : 'I understand, continue'}
            disabled={saving}
            onPress={detailsVisible ? accept : () => setDetailsVisible(true)}
            style={({ pressed }) => [styles.primaryButton, (pressed || saving) && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>
              {saving ? 'Saving...' : detailsVisible ? 'Start using Maintenance Tracker' : 'I understand - continue'}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDetailsVisible(!detailsVisible)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="linkPrimary">
              {detailsVisible ? 'Back to summary' : 'Read the full data summary'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DisclosureSummary() {
  return (
    <ThemedView style={styles.card}>
      <ThemedText>Your vehicles and history stay on this device. There is no account, automatic sync, sharing, or app-level recovery.</ThemedText>
      <ThemedText>Deleting the app, losing this iPhone, or replacing it can permanently lose your data. Device backups are outside the app&apos;s control and are not a recovery promise.</ThemedText>
      <ThemedText>Before tracking starts, the app may temporarily use precise location to estimate distance. You can review this information later in Settings.</ThemedText>
    </ThemedView>
  );
}

function DisclosureDetails() {
  return (
    <ThemedView style={styles.card}>
      <ThemedText>Vehicle profiles, maintenance, odometer readings, reviewed trips, and configured triggers remain on this iPhone until you delete them.</ThemedText>
      <ThemedText>Precise location is temporary: it is used only for active distance calculation, the reconnect grace period, and safe recovery. Terminal trips do not retain precise points.</ThemedText>
      <ThemedText>Diagnostics are kept locally for up to 30 days with a storage cap. Any data you deliberately move outside the app remains under your control.</ThemedText>
      <ThemedText>App deletion removes this installation&apos;s local data. It cannot remove device backups or copies you have placed elsewhere.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, justifyContent: 'center', gap: Spacing.three },
  card: { gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three, backgroundColor: '#F2EFE9' },
  primaryButton: { minHeight: 48, borderRadius: 24, backgroundColor: '#29352E', justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.three },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  error: { color: '#A52A2A' },
  pressed: { opacity: 0.65 },
});
