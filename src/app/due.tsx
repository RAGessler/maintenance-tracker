import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { QuickAddFab } from '@/components/quick-add';
import { PrimaryTabHeader, usePrimaryTabHeaderContentInset } from '@/components/primary-tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Chevron, ProgressBar, SeverityDot, toneOf } from '@/components/torque-ui';
import { Spacing, TorqueColors } from '@/constants/theme';
import { calculateDue, type DueCalculation } from '@/features/schedules/due-calculator';
import { dueStateRank, dueTone, intervalFraction, statusLine } from '@/features/schedules/due-format';
import { civilToday, formatMilliMiles } from '@/utils/local-values';
import { maintenanceStore, type GarageVehicle, type MaintenanceSchedule } from '../../modules/maintenance-store';

type DueItem = Readonly<{ schedule: MaintenanceSchedule; due: DueCalculation }>;
type VehicleDue = Readonly<{ vehicle: GarageVehicle; items: DueItem[]; dueCount: number; soonCount: number }>;

export default function DueScreen() {
  const primaryHeaderInset = usePrimaryTabHeaderContentInset();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [groups, setGroups] = useState<VehicleDue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const today = civilToday();
      const vehicles = await maintenanceStore.product.getVehicles();
      setVehicles(vehicles);
      const built = await Promise.all(
        vehicles.map(async (vehicle): Promise<VehicleDue> => {
          const schedules = await maintenanceStore.product.getMaintenanceSchedules(vehicle.id);
          const items = schedules
            .map((schedule) => ({ schedule, due: calculateDue(schedule, vehicle.currentOdometerMilliMiles, today) }))
            .sort((left, right) => dueStateRank[left.due.state] - dueStateRank[right.due.state] || left.schedule.serviceName.localeCompare(right.schedule.serviceName));
          return {
            vehicle,
            items,
            dueCount: items.filter((item) => item.due.state === 'due').length,
            soonCount: items.filter((item) => item.due.state === 'due_soon').length,
          };
        }),
      );
      setGroups(built.filter((group) => group.items.length > 0));
    } catch {
      setError('Due status could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const refreshAtMidnight = () => {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        return setTimeout(
          () => {
            void load();
            timeout = refreshAtMidnight();
          },
          midnight - now.getTime() + 100,
        );
      };
      let timeout = refreshAtMidnight();
      return () => clearTimeout(timeout);
    }, [load]),
  );

  const totals = groups.reduce((sum, group) => ({ due: sum.due + group.dueCount, soon: sum.soon + group.soonCount }), { due: 0, soon: 0 });
  const openSchedule = (vehicleId: string, scheduleId: string) => router.navigate({ pathname: '/', params: { vehicleId, scheduleId } });

  return (
    <ThemedView collapsable={false} style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: primaryHeaderInset }]} scrollIndicatorInsets={{ top: primaryHeaderInset }}>
        {groups.length > 0 ? (
          <ThemedText style={styles.headerSummary}>
            {totals.due} due · {totals.soon} soon
          </ThemedText>
        ) : null}
        {loading ? (
          <ThemedText style={styles.muted}>Updating due status...</ThemedText>
        ) : error ? (
          <View style={styles.empty}>
            <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </ThemedText>
            <Action label="Try again" onPress={() => void load()} />
          </View>
        ) : groups.length === 0 ? (
          <ThemedText style={styles.muted}>Add maintenance schedules in Garage to see due status here.</ThemedText>
        ) : (
          <>
            {groups.map((group) => (
              <View key={group.vehicle.id} style={styles.group}>
                <VehicleHeader vehicle={group.vehicle} />
                <Card>
                  {group.items.map((item, index) => (
                    <DueRow key={item.schedule.id} item={item} last={index === group.items.length - 1} onOpen={() => openSchedule(group.vehicle.id, item.schedule.id)} />
                  ))}
                </Card>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/' })} style={styles.manageLink}>
              <ThemedText style={styles.manageText}>Manage schedules</ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
      <PrimaryTabHeader title="Due" />
      <QuickAddFab vehicles={vehicles} />
    </ThemedView>
  );
}

function VehicleHeader({ vehicle }: Readonly<{ vehicle: GarageVehicle }>) {
  const model = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
  return (
    <View style={styles.vehicleHeader}>
      <View style={styles.thumb}>
        {vehicle.heroPhotoUri ? (
          <Image source={{ uri: vehicle.heroPhotoUri }} style={styles.thumbImage} accessibilityLabel={`${vehicle.nickname} photo`} />
        ) : null}
      </View>
      <View style={styles.vehicleHeaderText}>
        <ThemedText style={styles.vehicleName}>{model}</ThemedText>
        <ThemedText style={styles.vehicleMeta}>{formatMilliMiles(vehicle.currentOdometerMilliMiles, true)} mi est.</ThemedText>
      </View>
    </View>
  );
}

function DueRow({ item, last, onOpen }: Readonly<{ item: DueItem; last: boolean; onOpen: () => void }>) {
  const { state } = item.due;
  const tone = dueTone[state];
  const status = statusLine(item.due);
  const actionable = state !== 'current';
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.schedule.serviceName}, ${status.prefix}${status.detail ? `, ${status.detail}` : ''}`}
        accessibilityHint="Opens this maintenance schedule"
        onPress={onOpen}
        style={styles.rowContent}
      >
        <View style={styles.rowMain}>
          <SeverityDot tone={tone} />
          <View style={styles.rowText}>
            <ThemedText style={styles.service}>{item.schedule.serviceName}</ThemedText>
            <ThemedText style={[styles.status, { color: toneOf(tone).fg }]}>
              {status.prefix}
              {status.detail ? ` · ${status.detail}` : ''}
            </ThemedText>
          </View>
          {actionable ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Log ${item.schedule.serviceName}`} onPress={onOpen} style={[styles.logButton, state === 'due' ? styles.logButtonDue : styles.logButtonSoon]}>
              <ThemedText style={state === 'due' ? styles.logTextDue : styles.logTextSoon}>Log</ThemedText>
            </Pressable>
          ) : (
            <Chevron />
          )}
        </View>
        {actionable ? <ProgressBar fraction={intervalFraction(item.due, item.schedule)} tone={tone} /> : null}
      </Pressable>
    </View>
  );
}

function Action({ label, onPress }: Readonly<{ label: string; onPress: () => void }>) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <ThemedText style={styles.actionText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  content: { gap: Spacing.three, paddingVertical: Spacing.four, paddingHorizontal: Spacing.three },
  headerSummary: { color: TorqueColors.secondary, fontSize: 13 },
  group: { gap: Spacing.two },
  vehicleHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.one },
  thumb: { width: 36, height: 36, borderRadius: 9, overflow: 'hidden', backgroundColor: TorqueColors.accentSurface },
  thumbImage: { width: 36, height: 36 },
  vehicleHeaderText: { flex: 1 },
  vehicleName: { color: TorqueColors.text, fontSize: 16, fontWeight: '700' },
  vehicleMeta: { color: TorqueColors.secondary, fontSize: 12 },
  row: { paddingHorizontal: Spacing.three },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider },
  rowContent: { paddingVertical: Spacing.two + 4, gap: Spacing.two },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowText: { flex: 1, gap: 2 },
  service: { color: TorqueColors.text, fontSize: 16 },
  status: { fontSize: 13, fontWeight: '600' },
  logButton: { borderRadius: 100, paddingVertical: 6, paddingHorizontal: 14, minHeight: 32, justifyContent: 'center' },
  logButtonDue: { backgroundColor: TorqueColors.primary },
  logButtonSoon: { backgroundColor: TorqueColors.primarySurface },
  logTextDue: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  logTextSoon: { color: TorqueColors.primary, fontSize: 13, fontWeight: '600' },
  manageLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  manageText: { color: TorqueColors.primary, fontSize: 15 },
  muted: { color: TorqueColors.secondary },
  error: { color: TorqueColors.error },
  empty: { gap: Spacing.two },
  action: {
    alignSelf: 'flex-start',
    backgroundColor: TorqueColors.primary,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  actionText: { color: '#FFFFFF', fontWeight: '700' },
});
