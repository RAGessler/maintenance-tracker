import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { buildActivityHistory, type ActivityFact } from '@/features/activity/history';
import { availableTripActions } from '@/features/activity/trip-actions';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type GarageVehicle, type MaintenanceRecord, type ManualOdometerReading, type Trip, type TripRevision } from '../../modules/maintenance-store';

type Draft = Readonly<{ serviceName: string; completedOn: string; mileage: string; note: string }>;
const emptyDraft: Draft = { serviceName: '', completedOn: '', mileage: '', note: '' };

export default function ActivityScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>();
  const [historyVehicleId, setHistoryVehicleId] = useState<string>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [readings, setReadings] = useState<ManualOdometerReading[]>([]);
  const [snapshot, setSnapshot] = useState<'idle' | 'tracking' | 'recovering'>('idle');
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const loadedVehicles = await maintenanceStore.product.getVehicles();
      const [nextSnapshot, facts] = await Promise.all([
        maintenanceStore.tracking.getSnapshot(),
        Promise.all(loadedVehicles.map(async (vehicle) => Promise.all([
          maintenanceStore.tracking.getTrips(vehicle.id), maintenanceStore.product.getMaintenanceRecords(vehicle.id), maintenanceStore.product.getManualOdometerReadings(vehicle.id),
        ]))),
      ]);
      if (version !== loadVersion.current) return;
      setError(null);
      setVehicles(loadedVehicles);
      setSelectedVehicleId((current) => current && loadedVehicles.some((vehicle) => vehicle.id === current) ? current : loadedVehicles[0]?.id);
      setHistoryVehicleId((current) => current && loadedVehicles.some((vehicle) => vehicle.id === current) ? current : undefined);
      setSnapshot(nextSnapshot.state);
      setTrips(facts.flatMap(([vehicleTrips]) => vehicleTrips));
      setRecords(facts.flatMap(([, vehicleRecords]) => vehicleRecords));
      setReadings(facts.flatMap(([, , vehicleReadings]) => vehicleReadings));
    } catch (loadError: unknown) {
      if (version !== loadVersion.current) return;
      setError(loadError instanceof Error && loadError.message.startsWith('Rebuild the iOS development client') ? loadError.message : 'Activity could not be loaded. Try again.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);

  const commandTracking = async () => {
    if (!selectedVehicleId || saving) return;
    setSaving(true);
    try {
      if (snapshot === 'tracking') await maintenanceStore.tracking.stop();
      else await maintenanceStore.tracking.start(selectedVehicleId, 'manual');
      await load();
    } catch {
      setError(snapshot === 'tracking' ? 'The active trip could not be stopped. Try again.' : 'A trip is already active for another vehicle. Stop it before starting this one.');
    } finally {
      setSaving(false);
    }
  };

  if (adding || editing) return <MaintenanceForm vehicleId={editing?.vehicleId ?? selectedVehicleId} record={editing ?? undefined} onCancel={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); void load(); }} />;

  const history = buildActivityHistory({ trips, records, readings }, historyVehicleId).filter((fact) => fact.kind !== 'trip' || fact.trip.disposition !== 'review_required');
  const reviewRequired = trips.filter((trip) => trip.disposition === 'review_required');
  return <><ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <ThemedText accessibilityRole="header" style={styles.title}>Activity</ThemedText>
    {loading ? <ThemedText style={styles.muted}>Loading activity...</ThemedText> : error ? <StateMessage message={error} retry={load} /> : vehicles.length === 0 ? <ThemedText style={styles.muted}>Add a vehicle in Garage before recording activity.</ThemedText> : <>
      <ThemedView style={styles.controlCard}><ThemedText style={styles.sectionTitle}>{snapshot === 'tracking' ? 'Trip in progress' : 'Manual trip'}</ThemedText><ThemedText style={styles.muted}>{snapshot === 'tracking' ? 'One trip is active on this device.' : 'Start a trip when automatic tracking is unavailable.'}</ThemedText><VehiclePicker vehicles={vehicles} selectedVehicleId={selectedVehicleId} onSelect={setSelectedVehicleId} label="Trip vehicle" /><ActionButton label={saving ? 'Saving...' : snapshot === 'tracking' ? 'Stop trip' : 'Start trip'} disabled={saving || !selectedVehicleId} onPress={() => void commandTracking()} /></ThemedView>
      {reviewRequired.length > 0 ? <View style={styles.section}><ThemedText accessibilityRole="header" style={styles.sectionTitle}>Review required</ThemedText>{reviewRequired.map((trip) => <TripCard key={trip.id} trip={trip} vehicleName={vehicleName(vehicles, trip.vehicleId)} onPress={() => setReviewing(trip)} />)}</View> : null}
      <View style={styles.sectionHeader}><ThemedText accessibilityRole="header" style={styles.sectionTitle}>History</ThemedText><ActionButton label="Add record" onPress={() => setAdding(true)} /></View>
      <View accessibilityRole="radiogroup" accessibilityLabel="History vehicle" style={styles.picker}><Choice label="All vehicles" selected={!historyVehicleId} onPress={() => setHistoryVehicleId(undefined)} />{vehicles.map((vehicle) => <Choice key={vehicle.id} label={vehicle.nickname} selected={historyVehicleId === vehicle.id} onPress={() => setHistoryVehicleId(vehicle.id)} />)}</View>
      {history.length === 0 ? <ThemedText style={styles.muted}>{historyVehicleId ? 'No activity for this vehicle yet.' : 'No activity yet.'}</ThemedText> : history.map((fact) => <HistoryCard key={`${fact.kind}:${fact.id}`} fact={fact} vehicleName={vehicleName(vehicles, fact.vehicleId)} onTrip={() => fact.kind === 'trip' && setReviewing(fact.trip)} onRecord={() => fact.kind === 'record' && setEditing(fact.record)} onDeleteRecord={() => fact.kind === 'record' && Alert.alert('Delete this record?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void maintenanceStore.product.deleteMaintenanceRecord(fact.record.id).then(load).catch(() => setError('The record could not be deleted. Try again.')); } }])} onReading={() => fact.kind === 'reading' && Alert.alert('Manual odometer reading', `${vehicleName(vehicles, fact.reading.vehicleId)}\n${formatTimestamp(fact.reading.effectiveAt)}\n${formatMilliMiles(fact.reading.milliMiles)} mi`)} />)}
    </>}
  </ScrollView></SafeAreaView></ThemedView>{reviewing ? <Modal visible presentationStyle="pageSheet" onRequestClose={() => setReviewing(null)}><TripReview trip={reviewing} vehicles={vehicles} onCancel={() => setReviewing(null)} onSaved={() => { setReviewing(null); void load(); }} /></Modal> : null}</>;
}

function TripReview({ trip, vehicles, onCancel, onSaved }: Readonly<{ trip: Trip; vehicles: GarageVehicle[]; onCancel: () => void; onSaved: () => void }>) {
  const [mileage, setMileage] = useState(trip.effectiveMilliMiles ? formatMilliMiles(trip.effectiveMilliMiles) : '');
  const [vehicleId, setVehicleId] = useState(trip.vehicleId);
  const [revisions, setRevisions] = useState<TripRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const actions = availableTripActions(trip.disposition);
  useEffect(() => {
    void maintenanceStore.tracking.getRevisions(trip.id).then(setRevisions).catch(() => setError('Trip revisions could not be loaded.')).finally(() => setLoadingRevisions(false));
  }, [trip.id]);
  const review = async (action: 'confirm' | 'correct' | 'reassign' | 'reject') => {
    setSaving(true); setError(null);
    try { await maintenanceStore.tracking.review({ tripId: trip.id, action, effectiveMilliMiles: action === 'confirm' || action === 'correct' ? decimalToMilliMiles(mileage) : undefined, vehicleId: action === 'reassign' ? vehicleId : undefined }); onSaved(); }
    catch { setError('This trip could not be updated. Your changes are still here.'); }
    finally { setSaving(false); }
  };
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}><View style={styles.navigation}><Pressable accessibilityRole="button" onPress={onCancel}><ThemedText type="linkPrimary">Cancel</ThemedText></Pressable><ThemedText accessibilityRole="header" style={styles.sectionTitle}>Review trip</ThemedText><View /></View><TripCard trip={trip} vehicleName={vehicleName(vehicles, trip.vehicleId)} onPress={() => {}} />{actions.length > 0 ? <><View style={styles.form}><Field label="Effective distance (mi)" value={mileage} onChangeText={setMileage} keyboardType="decimal-pad" /><VehiclePicker vehicles={vehicles} selectedVehicleId={vehicleId} onSelect={setVehicleId} label="Assign vehicle" /></View><View style={styles.actions}>{actions.includes('confirm') ? <ActionButton label="Confirm" disabled={saving || !isMileage(mileage)} onPress={() => void review('confirm')} /> : null}{actions.includes('correct') ? <ActionButton label="Save correction" disabled={saving || !isMileage(mileage)} onPress={() => void review('correct')} /> : null}{actions.includes('reassign') ? <ActionButton label="Reassign" disabled={saving || !vehicleId} onPress={() => void review('reassign')} /> : null}{actions.includes('reject') ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void review('reject')}><ThemedText style={styles.delete}>Reject trip</ThemedText></Pressable> : null}</View></> : <ThemedText style={styles.muted}>This trip is read-only. Its revision history remains available below.</ThemedText>}{error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : null}<ThemedText accessibilityRole="header" style={styles.sectionTitle}>Revision history</ThemedText>{loadingRevisions ? <ThemedText style={styles.muted}>Loading revisions...</ThemedText> : revisions.length === 0 ? <ThemedText style={styles.muted}>No revisions have been recorded.</ThemedText> : revisions.map((revision) => <ThemedView key={revision.revisionNumber} style={styles.card}><ThemedText>{revision.action} · {revision.disposition}</ThemedText><ThemedText style={styles.muted}>{formatTimestamp(revision.occurredAt)} · {revision.actor}</ThemedText><ThemedText style={styles.muted}>{vehicleName(vehicles, revision.vehicleId)}</ThemedText>{revision.effectiveMilliMiles ? <ThemedText>{formatMilliMiles(revision.effectiveMilliMiles)} mi</ThemedText> : null}</ThemedView>)}</ScrollView></SafeAreaView></ThemedView>;
}

function HistoryCard({ fact, vehicleName, onTrip, onRecord, onDeleteRecord, onReading }: Readonly<{ fact: ActivityFact; vehicleName: string; onTrip: () => void; onRecord: () => void; onDeleteRecord: () => void; onReading: () => void }>) {
  if (fact.kind === 'trip') return <TripCard trip={fact.trip} vehicleName={vehicleName} onPress={onTrip} />;
  if (fact.kind === 'record') return <ThemedView style={styles.card}><Pressable accessibilityRole="button" accessibilityLabel={`Maintenance record: ${fact.record.serviceName}`} onPress={onRecord}><ThemedText style={styles.recordTitle}>{fact.record.serviceName}</ThemedText><ThemedText style={styles.muted}>{vehicleName} · {fact.record.completedOn}</ThemedText><ThemedText>{formatMilliMiles(fact.record.milliMiles)} mi</ThemedText></Pressable><Pressable accessibilityRole="button" onPress={onDeleteRecord}><ThemedText style={styles.delete}>Delete record</ThemedText></Pressable></ThemedView>;
  return <Pressable accessibilityRole="button" accessibilityLabel="Manual odometer reading" onPress={onReading}><ThemedView style={styles.card}><ThemedText style={styles.recordTitle}>Manual odometer reading</ThemedText><ThemedText style={styles.muted}>{vehicleName} · {formatTimestamp(fact.reading.effectiveAt)}</ThemedText><ThemedText>{formatMilliMiles(fact.reading.milliMiles)} mi</ThemedText></ThemedView></Pressable>;
}

function TripCard({ trip, vehicleName, onPress }: Readonly<{ trip: Trip; vehicleName: string; onPress: () => void }>) { return <Pressable accessibilityRole="button" accessibilityLabel={`Trip ${trip.disposition} for ${vehicleName}`} onPress={onPress}><ThemedView style={styles.card}><View style={styles.cardHeader}><ThemedText style={styles.recordTitle}>Trip · {trip.disposition.replace('_', ' ')}</ThemedText><ThemedText style={styles.muted}>{formatTimestamp(trip.endedAt)}</ThemedText></View><ThemedText style={styles.muted}>{vehicleName}{trip.failureReason ? ` · ${trip.failureReason.replaceAll('_', ' ')}` : ''}</ThemedText>{trip.effectiveMilliMiles ? <ThemedText>{formatMilliMiles(trip.effectiveMilliMiles)} mi effective</ThemedText> : null}</ThemedView></Pressable>; }
function VehiclePicker({ vehicles, selectedVehicleId, onSelect, label }: Readonly<{ vehicles: GarageVehicle[]; selectedVehicleId?: string; onSelect: (id: string) => void; label: string }>) { return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.picker}>{vehicles.map((vehicle) => <Choice key={vehicle.id} label={vehicle.nickname} selected={vehicle.id === selectedVehicleId} onPress={() => onSelect(vehicle.id)} />)}</View>; }
function Choice({ label, selected, onPress }: Readonly<{ label: string; selected: boolean; onPress: () => void }>) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><ThemedText style={selected ? styles.choiceTextSelected : undefined}>{label}</ThemedText></Pressable>; }
function StateMessage({ message, retry }: Readonly<{ message: string; retry: () => void }>) { return <View style={styles.section}><ThemedText accessibilityLiveRegion="polite" style={styles.error}>{message}</ThemedText><ActionButton label="Try again" onPress={() => void retry()} /></View>; }
function MaintenanceForm({ vehicleId, record, onCancel, onSaved }: Readonly<{ vehicleId?: string; record?: MaintenanceRecord; onCancel: () => void; onSaved: () => void }>) { const [draft, setDraft] = useState<Draft>(record ? { serviceName: record.serviceName, completedOn: record.completedOn, mileage: formatMilliMiles(record.milliMiles), note: record.note ?? '' } : emptyDraft); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const valid = Boolean(vehicleId && draft.serviceName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(draft.completedOn) && isMileage(draft.mileage)); const save = async () => { if (!valid || !vehicleId) return; setSaving(true); try { const input = { vehicleId, serviceName: draft.serviceName.trim(), completedOn: draft.completedOn, milliMiles: decimalToMilliMiles(draft.mileage), note: draft.note.trim() || undefined }; if (record) await maintenanceStore.product.updateMaintenanceRecord({ ...input, id: record.id }); else await maintenanceStore.product.createMaintenanceRecord(input); onSaved(); } catch { setError('The record could not be saved. Your changes are still here.'); } finally { setSaving(false); } }; return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}><View style={styles.navigation}><Pressable accessibilityRole="button" onPress={onCancel}><ThemedText type="linkPrimary">Cancel</ThemedText></Pressable><ThemedText accessibilityRole="header" style={styles.sectionTitle}>{record ? 'Edit maintenance' : 'Add maintenance'}</ThemedText><Pressable accessibilityRole="button" disabled={!valid || saving} onPress={() => void save()}><ThemedText type="linkPrimary">Save</ThemedText></Pressable></View><View style={styles.form}><Field label="Service" value={draft.serviceName} onChangeText={(serviceName) => setDraft({ ...draft, serviceName })} /><Field label="Completed date (YYYY-MM-DD)" value={draft.completedOn} onChangeText={(completedOn) => setDraft({ ...draft, completedOn })} /><Field label="Odometer (mi)" value={draft.mileage} onChangeText={(mileage) => setDraft({ ...draft, mileage })} keyboardType="decimal-pad" /><Field label="Note (optional)" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} multiline /></View>{error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : null}</ScrollView></SafeAreaView></ThemedView>; }
function Field({ label, ...props }: Readonly<{ label: string } & React.ComponentProps<typeof TextInput>>) { return <View style={styles.field}><ThemedText>{label}</ThemedText><TextInput {...props} accessibilityLabel={label} placeholderTextColor={TorqueColors.secondary} style={styles.input} /></View>; }
function ActionButton({ label, onPress, disabled = false }: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}><ThemedText style={styles.actionText}>{label}</ThemedText></Pressable>; }
function vehicleName(vehicles: GarageVehicle[], vehicleId?: string) { return vehicles.find((vehicle) => vehicle.id === vehicleId)?.nickname ?? 'Unavailable vehicle'; }
function isMileage(value: string) { return /^\d+(\.\d{1,3})?$/.test(value.trim()); }
function decimalToMilliMiles(value: string) { const [whole, fraction = ''] = value.trim().split('.'); return `${BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0'))}`; }
function formatMilliMiles(value: string) { const milli = BigInt(value); const whole = milli / 1_000n; const fraction = (milli % 1_000n).toString().padStart(3, '0').replace(/0+$/, ''); return fraction ? `${whole}.${fraction}` : whole.toString(); }
function formatTimestamp(value: string) { return new Date(Number(value)).toLocaleString(); }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: TorqueColors.canvas }, safeArea: { flex: 1 }, content: { padding: Spacing.four, gap: Spacing.three }, title: { color: TorqueColors.text, fontSize: 34, lineHeight: 41, fontWeight: '700' }, section: { gap: Spacing.two }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, muted: { color: TorqueColors.secondary }, controlCard: { padding: Spacing.three, borderRadius: 16, backgroundColor: TorqueColors.card, gap: Spacing.two }, card: { padding: Spacing.three, borderRadius: 16, backgroundColor: TorqueColors.card, gap: Spacing.one }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }, recordTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, picker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }, choice: { borderRadius: 18, borderWidth: 1, borderColor: TorqueColors.divider, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one }, choiceSelected: { backgroundColor: TorqueColors.primary, borderColor: TorqueColors.primary }, choiceTextSelected: { color: '#FFFFFF', fontWeight: '700' }, action: { minHeight: 40, borderRadius: 10, backgroundColor: TorqueColors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.two }, actionText: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.45 }, navigation: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, form: { borderRadius: 16, backgroundColor: TorqueColors.card, paddingHorizontal: Spacing.three }, field: { gap: Spacing.one, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: TorqueColors.divider }, input: { color: TorqueColors.text, fontSize: 17, minHeight: 40 }, actions: { gap: Spacing.two }, delete: { color: TorqueColors.error, fontWeight: '700', textAlign: 'center', padding: Spacing.two }, error: { color: TorqueColors.error } });
