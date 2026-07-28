import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, IconTile, SectionLabel } from '@/components/torque-ui';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type LocationPermissionStatus } from '../../modules/maintenance-store';

export default function SettingsScreen() {
  const [locationStatus, setLocationStatus] = useState<LocationPermissionStatus>('unavailable');
  const [locationError, setLocationError] = useState<string | null>(null);

  const loadLocationStatus = useCallback(() => {
    setLocationError(null);
    maintenanceStore.tracking.getLocationPermissionStatus().then(setLocationStatus).catch((reason: unknown) => {
      setLocationError(reason instanceof Error ? reason.message : 'Location permission status could not be checked.');
    });
  }, []);

  useFocusEffect(loadLocationStatus);

  const requestLocation = async () => {
    setLocationError(null);
    if (locationStatus === 'denied' || locationStatus === 'restricted') {
      await Linking.openSettings();
      return;
    }
    try {
      setLocationStatus(await maintenanceStore.tracking.requestLocationPermission());
      setTimeout(loadLocationStatus, 500);
    } catch (reason: unknown) {
      setLocationError(reason instanceof Error ? reason.message : 'Location permission could not be requested.');
    }
  };

  const locationTitle = locationStatus === 'always' ? 'Location access enabled' : locationStatus === 'always_reduced' ? 'Enable Precise Location' : locationStatus === 'when_in_use' ? 'Allow Always location access' : 'Allow location access';
  const locationCopy = locationStatus === 'always'
    ? 'Precise location is available for automatic trip tracking while a trip is active.'
    : locationStatus === 'always_reduced'
      ? 'Always access is enabled, but iOS is providing reduced accuracy. Open iOS Settings and turn on Precise Location.'
    : locationStatus === 'when_in_use'
      ? 'Automatic trip tracking needs Always access. Tap below to continue the iOS permission flow.'
      : 'Automatic trip tracking needs Precise Location and Always access. Location is used only while a trip is active.';
  const locationAction = locationStatus === 'always' ? null : locationStatus === 'denied' || locationStatus === 'restricted' || locationStatus === 'always_reduced' ? 'Open iOS Settings' : locationStatus === 'when_in_use' ? 'Allow Always' : 'Allow Location';

  return (
    <ThemedView collapsable={false} style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          Settings
        </ThemedText>
        <SectionLabel>Local data &amp; privacy</SectionLabel>
        <Card>
          <View style={[styles.row, styles.rowDivider]}>
            <IconTile symbol="lock.fill" tone="success" />
            <View style={styles.rowText}>
              <ThemedText style={styles.rowTitle}>On this iPhone only</ThemedText>
              <ThemedText style={styles.rowSubtitle}>Your data stays on this device. There is no account, automatic sync, sharing, or app-level recovery.</ThemedText>
            </View>
          </View>
          <View style={styles.row}>
            <IconTile symbol="location.fill" tone="primary" />
            <View style={styles.rowText}>
              <ThemedText style={styles.rowTitle}>{locationTitle}</ThemedText>
              <ThemedText style={styles.rowSubtitle}>{locationCopy}</ThemedText>
              {locationAction ? (
                <Pressable accessibilityRole="button" accessibilityLabel={locationAction} onPress={() => void requestLocation()} style={styles.permissionButton}>
                  <ThemedText style={styles.permissionButtonText}>{locationAction}</ThemedText>
                </Pressable>
              ) : null}
              {locationError ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{locationError}</ThemedText> : null}
            </View>
          </View>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  content: { paddingVertical: Spacing.four, paddingHorizontal: Spacing.three, gap: Spacing.three },
  title: { color: TorqueColors.text, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, alignItems: 'flex-start' },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: TorqueColors.text, fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 },
  permissionButton: { alignSelf: 'flex-start', marginTop: Spacing.one, minHeight: 44, justifyContent: 'center' },
  permissionButtonText: { color: TorqueColors.primary, fontSize: 15, fontWeight: '600' },
  error: { color: TorqueColors.error, fontSize: 13, lineHeight: 18, marginTop: Spacing.one },
});
