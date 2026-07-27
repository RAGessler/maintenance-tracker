import { useEffect, useEffectEvent, useState } from 'react';
import { router, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { QuickAddFab } from '@/components/quick-add';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Chevron, MetaPill, SectionLabel, SeverityDot, toneOf } from '@/components/torque-ui';
import { Spacing, TorqueColors } from '@/constants/theme';
import { calculateDue, type DueCalculation } from '@/features/schedules/due-calculator';
import { dueStateRank, dueTone, statusLine } from '@/features/schedules/due-format';
import { civilToday, formatMilliMiles } from '@/utils/local-values';
import { maintenanceStore, type GarageVehicle, type MaintenanceSchedule, type ManualOdometerReading, type TrackingSnapshot } from '../../modules/maintenance-store';

type DueItem = Readonly<{ schedule: MaintenanceSchedule; due: DueCalculation }>;

/**
 * Read-only vehicle dashboard from the TorqueLog Alpha design (screen 02):
 * hero photo, live tracking state, odometer estimate with its manual baseline,
 * and the next services. Editing stays in the vehicle editor behind "Edit".
 */
export function VehicleDashboard({
  vehicle,
  onBack,
  onEdit,
  onOpenSchedule,
  onUpdateOdometer,
}: Readonly<{
  vehicle: GarageVehicle;
  onBack: () => void;
  onEdit: () => void;
  onOpenSchedule: (scheduleId: string) => void;
  onUpdateOdometer: () => void;
}>) {
  const [items, setItems] = useState<DueItem[]>([]);
  const [baseline, setBaseline] = useState<ManualOdometerReading | null>(null);
  const [trackingState, setTrackingState] = useState<TrackingSnapshot['state']>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useEffectEvent(() => {
    setError(null);
    setLoading(true);
    const today = civilToday();
    Promise.all([
      maintenanceStore.product.getMaintenanceSchedules(vehicle.id),
      maintenanceStore.product.getManualOdometerReadings(vehicle.id),
      maintenanceStore.tracking.getSnapshot().catch(() => ({ state: 'idle' as const })),
    ])
      .then(([schedules, readings, snapshot]) => {
        setItems(
          schedules
            .map((schedule) => ({ schedule, due: calculateDue(schedule, vehicle.currentOdometerMilliMiles, today) }))
            .sort((left, right) => dueStateRank[left.due.state] - dueStateRank[right.due.state] || left.schedule.serviceName.localeCompare(right.schedule.serviceName)),
        );
        setBaseline(readings.reduce<ManualOdometerReading | null>((latest, reading) => (!latest || Number(reading.effectiveAt) > Number(latest.effectiveAt) ? reading : latest), null));
        setTrackingState(snapshot.state);
      })
      .catch(() => setError('This vehicle could not be loaded. Try again.'))
      .finally(() => setLoading(false));
  });
  useEffect(() => {
    const task = setTimeout(load, 0);
    return () => clearTimeout(task);
  }, [vehicle]);

  const dueCount = items.filter((item) => item.due.state !== 'current').length;
  const dueTonePill = items.some((item) => item.due.state === 'due') ? styles.heroPillDue : styles.heroPillSoon;
  return (
    <ThemedView collapsable={false} style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.navigation}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Garage" onPress={onBack} style={styles.backButton} hitSlop={8}>
            <SymbolView name="chevron.left" tintColor={TorqueColors.primary} size={20} weight="semibold" />
          </Pressable>
          <ThemedText accessibilityRole="header" style={styles.navTitle} numberOfLines={1}>
            {vehicle.nickname}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${vehicle.nickname}`} onPress={onEdit} style={styles.editButton} hitSlop={8}>
            <ThemedText style={styles.navAction}>Edit</ThemedText>
          </Pressable>
        </View>
        <View style={styles.hero}>
          {vehicle.heroPhotoUri ? (
            <Image source={{ uri: vehicle.heroPhotoUri }} style={styles.heroImage} accessibilityLabel={`${vehicle.nickname} hero photo`} />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]}>
              <SymbolView name={{ ios: 'car.side.fill', android: 'directions_car', web: 'directions_car' }} tintColor="#B9D8F7" size={54} />
            </View>
          )}
          <View style={styles.heroOverlay}>
            <View style={styles.heroText}>
              <ThemedText style={styles.heroName} numberOfLines={1}>
                {vehicle.nickname}
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                {vehicle.year} {vehicle.make}
              </ThemedText>
            </View>
            {dueCount > 0 ? (
              <View style={[styles.heroPill, dueTonePill]}>
                <ThemedText style={styles.heroPillText}>{dueCount} due</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        {trackingState !== 'idle' ? <TrackingPanel state={trackingState} /> : null}
        <Card style={styles.odometerCard}>
          <View style={styles.odometerHead}>
            <SectionLabel style={styles.odometerLabel}>Odometer</SectionLabel>
            <Pressable accessibilityRole="button" accessibilityLabel="Update odometer" accessibilityHint="Opens the odometer reading form" onPress={onUpdateOdometer} hitSlop={8}>
              <ThemedText style={styles.updateLink}>Update</ThemedText>
            </Pressable>
          </View>
          <View style={styles.odometerValueRow}>
            <ThemedText style={styles.odometerValue}>{formatMilliMiles(vehicle.currentOdometerMilliMiles, true)}</ThemedText>
            <ThemedText style={styles.odometerUnit}>mi</ThemedText>
            <MetaPill label="Estimated" tone="neutral" uppercase />
          </View>
          <ThemedText style={styles.baseline}>{baseline ? `Baseline ${formatMilliMiles(baseline.milliMiles, true)} mi · ${formatShortDate(baseline.effectiveAt)}` : 'No manual odometer reading yet'}</ThemedText>
        </Card>
        <View style={styles.maintenanceHead}>
          <ThemedText accessibilityRole="header" style={styles.maintenanceTitle}>
            Maintenance
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="View all due maintenance" onPress={() => router.navigate('/due' as Href)} hitSlop={8}>
            <ThemedText style={styles.viewAll}>View all</ThemedText>
          </Pressable>
        </View>
        {loading ? (
          <ThemedText style={styles.muted}>Loading maintenance...</ThemedText>
        ) : error ? (
          <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </ThemedText>
        ) : items.length === 0 ? (
          <ThemedText style={styles.muted}>No maintenance schedules yet. Add one from Edit.</ThemedText>
        ) : (
          <Card>
            {items.map((item, index) => {
              const tone = dueTone[item.due.state];
              const status = statusLine(item.due);
              return (
                <Pressable
                  key={item.schedule.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.schedule.serviceName}, ${status.prefix}${status.detail ? `, ${status.detail}` : ''}`}
                  accessibilityHint="Opens this maintenance schedule"
                  onPress={() => onOpenSchedule(item.schedule.id)}
                  style={[styles.scheduleRow, index < items.length - 1 && styles.scheduleRowDivider]}
                >
                  <SeverityDot tone={tone} />
                  <View style={styles.scheduleText}>
                    <ThemedText style={styles.scheduleName}>{item.schedule.serviceName}</ThemedText>
                    <ThemedText style={[styles.scheduleStatus, { color: toneOf(tone).fg }, item.due.state === 'due' && styles.scheduleStatusDue]}>
                      {status.prefix}
                      {status.detail ? ` · ${status.detail}` : ''}
                    </ThemedText>
                  </View>
                  <Chevron />
                </Pressable>
              );
            })}
          </Card>
        )}
      </ScrollView>
      <QuickAddFab vehicles={[vehicle]} />
    </ThemedView>
  );
}

function TrackingPanel({ state }: Readonly<{ state: Exclude<TrackingSnapshot['state'], 'idle'> }>) {
  const tracking = state === 'tracking';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tracking ? 'A trip is active on this device. Open Activity.' : 'Trip recovery in progress. Open Activity.'}
      onPress={() => router.navigate('/activity' as Href)}
      style={[styles.trackingPanel, tracking ? styles.trackingPanelActive : styles.trackingPanelRecovering]}
    >
      <View style={styles.trackingHead}>
        <View style={[styles.trackingDot, { backgroundColor: tracking ? TorqueColors.successDot : TorqueColors.warningDot }]} />
        <ThemedText style={[styles.trackingTitle, { color: tracking ? TorqueColors.success : TorqueColors.warning }]}>{tracking ? 'Tracking active' : 'Recovering trip'}</ThemedText>
      </View>
      <ThemedText style={styles.trackingCopy}>{tracking ? 'One trip is active on this device. Open Activity to manage it.' : 'Maintenance Tracker is safely resolving the previous trip.'}</ThemedText>
    </Pressable>
  );
}

function formatShortDate(effectiveAt: string) {
  return new Date(Number(effectiveAt)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  content: { padding: Spacing.three, gap: Spacing.three },
  navigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backButton: { minWidth: 74, minHeight: 44, justifyContent: 'center' },
  navTitle: { flex: 1, color: TorqueColors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  editButton: { minWidth: 74, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  navAction: { color: TorqueColors.primary, fontSize: 17 },
  hero: { borderRadius: 18, overflow: 'hidden', backgroundColor: TorqueColors.card },
  heroImage: { width: '100%', height: 172 },
  heroFallback: { backgroundColor: TorqueColors.accentSurface, alignItems: 'center', justifyContent: 'center' },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two + 4,
    experimental_backgroundImage: 'linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0))',
  },
  heroText: { flex: 1, gap: 1 },
  heroName: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  heroSubtitle: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 13 },
  heroPill: { borderRadius: 100, paddingVertical: 3, paddingHorizontal: 9 },
  heroPillDue: { backgroundColor: 'rgba(255, 59, 48, 0.92)' },
  heroPillSoon: { backgroundColor: 'rgba(255, 149, 0, 0.92)' },
  heroPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  trackingPanel: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: Spacing.one },
  trackingPanelActive: { backgroundColor: TorqueColors.successSurface, borderColor: TorqueColors.success },
  trackingPanelRecovering: { backgroundColor: TorqueColors.warningSurface, borderColor: TorqueColors.warning },
  trackingHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  trackingDot: { width: 8, height: 8, borderRadius: 4 },
  trackingTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  trackingCopy: { color: TorqueColors.text, fontSize: 13, lineHeight: 18 },
  odometerCard: { padding: Spacing.three, gap: Spacing.one },
  odometerHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.two },
  odometerLabel: { paddingHorizontal: 0 },
  updateLink: { color: TorqueColors.primary, fontSize: 15, fontWeight: '600' },
  odometerValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  odometerValue: { color: TorqueColors.text, fontSize: 30, lineHeight: 36, fontWeight: '700' },
  odometerUnit: { color: TorqueColors.secondary, fontSize: 15 },
  baseline: { color: TorqueColors.secondary, fontSize: 13 },
  maintenanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, paddingHorizontal: Spacing.one },
  maintenanceTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' },
  viewAll: { color: TorqueColors.primary, fontSize: 15 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  scheduleRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider },
  scheduleText: { flex: 1, gap: 2 },
  scheduleName: { color: TorqueColors.text, fontSize: 16 },
  scheduleStatus: { fontSize: 13 },
  scheduleStatusDue: { fontWeight: '600' },
  muted: { color: TorqueColors.secondary },
  error: { color: TorqueColors.error },
});
