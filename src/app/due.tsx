import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TorqueColors } from '@/constants/theme';
import { buildDueList, type DueListGroup } from '@/features/schedules/due-list';
import { maintenanceStore } from '../../modules/maintenance-store';

export default function DueScreen() {
  const [groups, setGroups] = useState<DueListGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const vehicles = await maintenanceStore.product.getVehicles();
      const schedules = await Promise.all(vehicles.map(async (vehicle) => (await maintenanceStore.product.getMaintenanceSchedules(vehicle.id)).map((schedule) => ({ vehicleId: vehicle.id, vehicleName: vehicle.nickname, schedule, currentOdometerMilliMiles: vehicle.currentOdometerMilliMiles }))));
      setGroups(buildDueList(schedules.flat(), civilToday()));
    } catch {
      setError('Due status could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const refreshAtMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      return setTimeout(() => { void load(); timeout = refreshAtMidnight(); }, midnight - now.getTime() + 100);
    };
    let timeout = refreshAtMidnight();
    return () => clearTimeout(timeout);
  }, [load]));

  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <ThemedText accessibilityRole="header" style={styles.title}>Due</ThemedText>
    <ThemedText style={styles.subtitle}>Maintenance across your active vehicles.</ThemedText>
    {loading ? <ThemedText style={styles.muted}>Updating due status...</ThemedText> : error ? <View style={styles.empty}><ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText><Action label="Try again" onPress={() => void load()} /></View> : groups.length === 0 ? <ThemedText style={styles.muted}>Add maintenance schedules in Garage to see due status here.</ThemedText> : groups.map((group) => <View key={group.state} style={styles.group}><ThemedText accessibilityRole="header" style={styles.groupTitle}>{group.state === 'due' ? 'Due now' : group.state === 'due_soon' ? 'Due soon' : 'Current'}</ThemedText>{group.items.map((item) => <Pressable key={item.schedule.id} accessibilityRole="button" accessibilityLabel={`${item.schedule.serviceName} for ${item.vehicleName}, ${dueSummary(item)}. ${dueDetails(item)}`} accessibilityHint="Opens the vehicle's maintenance schedule" onPress={() => router.navigate({ pathname: '/', params: { vehicleId: item.vehicleId, scheduleId: item.schedule.id } })} style={styles.card}><ThemedText style={styles.service}>{item.schedule.serviceName}</ThemedText><ThemedText style={styles.vehicle}>{item.vehicleName}</ThemedText><ThemedText style={styles.status}>{dueSummary(item)}</ThemedText><ThemedText style={styles.detail}>{dueDetails(item)}</ThemedText></Pressable>)}</View>)}
  </ScrollView></SafeAreaView></ThemedView>;
}

function dueSummary(item: DueListGroup['items'][number]) {
  const { due } = item;
  if (due.controllingCondition === 'time' && due.time) return due.time.remainingDays < 0 ? `${Math.abs(due.time.remainingDays)} days overdue` : due.time.remainingDays === 0 ? 'Due today' : `${due.time.remainingDays} days remaining`;
  if (due.controllingCondition === 'both') return due.state === 'due' ? 'Due by mileage and time' : due.state === 'due_soon' ? 'Due soon by mileage and time' : 'Current by mileage and time';
  if (due.mileage) { const miles = Number(BigInt(due.mileage.remainingMilliMiles) / 1_000n); return miles <= 0 ? `${Math.abs(miles).toLocaleString()} mi overdue` : `${miles.toLocaleString()} mi remaining`; }
  return 'Review schedule';
}

function dueDetails(item: DueListGroup['items'][number]) {
  const mileage = item.due.mileage && `Mileage due at ${(BigInt(item.due.mileage.dueAtMilliMiles) / 1_000n).toLocaleString()} mi`;
  const time = item.due.time && `Time due ${item.due.time.dueOn}`;
  return [mileage, time].filter(Boolean).join(' · ');
}

function civilToday() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function Action({ label, onPress }: Readonly<{ label: string; onPress: () => void }>) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}><ThemedText style={styles.actionText}>{label}</ThemedText></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas }, safeArea: { flex: 1 }, content: { gap: Spacing.three, padding: Spacing.four }, title: { color: TorqueColors.text, fontSize: 34, fontWeight: '700' }, subtitle: { color: TorqueColors.secondary }, group: { gap: Spacing.two }, groupTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, card: { backgroundColor: TorqueColors.card, borderRadius: 14, gap: Spacing.one, padding: Spacing.three }, service: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, vehicle: { color: TorqueColors.secondary }, detail: { color: TorqueColors.secondary, fontSize: 12, lineHeight: 17, marginTop: Spacing.one }, status: { color: TorqueColors.primary, fontWeight: '700', marginTop: Spacing.one }, muted: { color: TorqueColors.secondary }, error: { color: TorqueColors.error }, empty: { gap: Spacing.two }, action: { alignSelf: 'flex-start', backgroundColor: TorqueColors.primary, borderRadius: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three }, actionText: { color: '#FFFFFF', fontWeight: '700' },
});
