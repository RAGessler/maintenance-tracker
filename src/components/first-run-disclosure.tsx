import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { currentDisclosureVersion } from '@/constants/disclosure';
import { Spacing, TorqueColors } from '@/constants/theme';
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
          <View style={styles.icon}>
            <ThemedText style={styles.iconText}>TL</ThemedText>
          </View>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {detailsVisible ? 'What is collected, kept, and deleted' : 'Everything lives on this iPhone'}
          </ThemedText>
          {!detailsVisible && <ThemedText style={styles.intro}>Read this before you add a vehicle or turn on tracking. It will not change quietly later.</ThemedText>}
          {detailsVisible ? <DisclosureDetails /> : <DisclosureSummary />}
          {error && (
            <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </ThemedText>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={detailsVisible ? 'Start using Maintenance Tracker' : 'I understand, continue'} disabled={saving} onPress={detailsVisible ? accept : () => setDetailsVisible(true)} style={({ pressed }) => [styles.primaryButton, (pressed || saving) && styles.pressed]}>
            <ThemedText style={styles.primaryButtonText}>{saving ? 'Saving...' : detailsVisible ? 'Start using Maintenance Tracker' : 'I understand - continue'}</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setDetailsVisible(!detailsVisible)} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="linkPrimary">{detailsVisible ? 'Back to summary' : 'Read the full data summary'}</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DisclosureSummary() {
  return (
    <ThemedView style={styles.group}>
      <DisclosureRow title="No account, no server" detail="Your vehicles and history stay on this iPhone." />
      <DisclosureRow title="No sync or sharing" detail="The app does not copy your data to another device." />
      <DisclosureRow title="No app-level backup or recovery" detail="There is no account to restore from." />
      <DisclosureRow title="Uninstalling or losing this iPhone" detail="Can permanently lose your data." />
      <DisclosureRow title="No migration promise" detail="A future version may not carry this beta data forward." last />
    </ThemedView>
  );
}

function DisclosureDetails() {
  return (
    <ThemedView style={styles.group}>
      <DisclosureRow title="Temporary precise location" detail="Used for active distance, a short reconnect grace period, and safe recovery. Terminal trips do not retain precise points." />
      <DisclosureRow title="Records and retention" detail="Vehicle profiles, maintenance, odometer readings, and reviewed trips remain here until deleted." />
      <DisclosureRow title="Diagnostics and exports" detail="Diagnostics are local and capped. Any data you move outside the app remains under your control." />
      <DisclosureRow title="Deletion limits" detail="Deleting the app cannot remove device backups or copies you placed elsewhere." last />
    </ThemedView>
  );
}

function DisclosureRow({ title, detail, last = false }: Readonly<{ title: string; detail: string; last?: boolean }>) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <ThemedText style={styles.rowTitle}>{title}</ThemedText>
      <ThemedText style={styles.rowDetail}>{detail}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TorqueColors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: TorqueColors.primary,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: TorqueColors.text,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '700',
  },
  intro: { color: TorqueColors.secondary, fontSize: 15, lineHeight: 21 },
  group: {
    borderRadius: Spacing.three,
    backgroundColor: TorqueColors.card,
    paddingHorizontal: Spacing.three,
  },
  row: {
    paddingVertical: Spacing.three,
    gap: Spacing.half,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TorqueColors.divider,
  },
  lastRow: { borderBottomWidth: 0 },
  rowTitle: {
    color: TorqueColors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  rowDetail: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: TorqueColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  error: { color: TorqueColors.error },
  pressed: { opacity: 0.65 },
});
