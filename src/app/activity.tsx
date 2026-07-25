import { useEffect, useEffectEvent, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type GarageVehicle, type MaintenanceRecord } from '../../modules/maintenance-store';

type Draft = Readonly<{ serviceName: string; completedOn: string; mileage: string; note: string }>;
const emptyDraft: Draft = { serviceName: '', completedOn: '', mileage: '', note: '' };

export default function ActivityScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (vehicleId = selectedVehicleId) => {
    try {
      setError(null);
      const loadedVehicles = await maintenanceStore.product.getVehicles();
      const nextVehicleId = vehicleId ?? loadedVehicles[0]?.id;
      setVehicles(loadedVehicles);
      setSelectedVehicleId(nextVehicleId);
      setRecords(nextVehicleId ? await maintenanceStore.product.getMaintenanceRecords(nextVehicleId) : []);
    } catch {
      setError('Maintenance history could not be loaded. Try again.');
    }
  };

  const loadEvent = useEffectEvent(load);
  useEffect(() => {
    const task = setTimeout(() => { void loadEvent(); }, 0);
    return () => clearTimeout(task);
  }, []);

  if (adding || editing) {
    return <MaintenanceForm vehicleId={selectedVehicleId} record={editing ?? undefined} onCancel={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); void load(); }} />;
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText accessibilityRole="header" style={styles.title}>Activity</ThemedText>
          {error && vehicles.length === 0 ? <View style={styles.empty}><ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText><ActionButton label="Try again" onPress={() => void load()} /></View> : vehicles.length === 0 ? <ThemedText style={styles.muted}>Add a vehicle in Garage before recording maintenance.</ThemedText> : <>
            <View style={styles.vehiclePicker} accessibilityRole="radiogroup" accessibilityLabel="Vehicle history">
              {vehicles.map((vehicle) => <Pressable key={vehicle.id} accessibilityRole="radio" accessibilityState={{ selected: vehicle.id === selectedVehicleId }} onPress={() => { setSelectedVehicleId(vehicle.id); void load(vehicle.id); }} style={[styles.vehicleChoice, vehicle.id === selectedVehicleId && styles.vehicleChoiceSelected]}><ThemedText style={vehicle.id === selectedVehicleId ? styles.selectedText : undefined}>{vehicle.nickname}</ThemedText></Pressable>)}
            </View>
            {error ? <View style={styles.empty}><ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText><ActionButton label="Try again" onPress={() => void load()} /></View> : <>
              <View style={styles.sectionHeader}><ThemedText accessibilityRole="header" style={styles.sectionTitle}>Maintenance history</ThemedText><ActionButton label="Add record" onPress={() => setAdding(true)} /></View>
              {records.length === 0 ? <ThemedText style={styles.muted}>No completed maintenance records for this vehicle.</ThemedText> : records.map((record) => <RecordCard key={record.id} record={record} onEdit={() => setEditing(record)} onDelete={() => { Alert.alert('Delete this record?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await maintenanceStore.product.deleteMaintenanceRecord(record.id); await load(); } catch { setError('The record could not be deleted. Try again.'); } } }]); }} />)}
            </>}
          </>}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function RecordCard({ record, onEdit, onDelete }: Readonly<{ record: MaintenanceRecord; onEdit: () => void; onDelete: () => void }>) {
  return <ThemedView style={styles.card}><View style={styles.cardHeader}><ThemedText style={styles.recordTitle}>{record.serviceName}</ThemedText><ThemedText style={styles.muted}>{record.completedOn}</ThemedText></View><ThemedText>{formatMilliMiles(record.milliMiles)} mi</ThemedText>{record.note ? <ThemedText style={styles.note}>{record.note}</ThemedText> : null}<View style={styles.cardActions}><Pressable accessibilityRole="button" onPress={onEdit}><ThemedText type="linkPrimary">Edit</ThemedText></Pressable><Pressable accessibilityRole="button" onPress={onDelete}><ThemedText style={styles.deleteText}>Delete</ThemedText></Pressable></View></ThemedView>;
}

function MaintenanceForm({ vehicleId, record, onCancel, onSaved }: Readonly<{ vehicleId?: string; record?: MaintenanceRecord; onCancel: () => void; onSaved: () => void }>) {
  const [draft, setDraft] = useState<Draft>(record ? { serviceName: record.serviceName, completedOn: record.completedOn, mileage: formatMilliMiles(record.milliMiles), note: record.note ?? '' } : emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Boolean(vehicleId && draft.serviceName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(draft.completedOn) && /^\d+(\.\d{1,3})?$/.test(draft.mileage.trim()));
  const save = async () => {
    if (!valid || !vehicleId) return;
    setSaving(true); setError(null);
    try {
      const input = { vehicleId, serviceName: draft.serviceName.trim(), completedOn: draft.completedOn, milliMiles: decimalToMilliMiles(draft.mileage), note: draft.note.trim() || undefined };
      if (record) await maintenanceStore.product.updateMaintenanceRecord({ ...input, id: record.id });
      else await maintenanceStore.product.createMaintenanceRecord(input);
      onSaved();
    } catch { setError('The record could not be saved. Your changes are still here.'); }
    finally { setSaving(false); }
  };
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.formNavigation}><Pressable accessibilityRole="button" onPress={onCancel}><ThemedText type="linkPrimary">Cancel</ThemedText></Pressable><ThemedText accessibilityRole="header" style={styles.formTitle}>{record ? 'Edit maintenance' : 'Add maintenance'}</ThemedText><Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid || saving }} disabled={!valid || saving} onPress={() => void save()}><ThemedText style={[styles.saveText, (!valid || saving) && styles.disabled]}>Save</ThemedText></Pressable></View><View style={styles.form}><Field label="Service" value={draft.serviceName} onChangeText={(serviceName) => setDraft({ ...draft, serviceName })} /><Field label="Completed date (YYYY-MM-DD)" value={draft.completedOn} onChangeText={(completedOn) => setDraft({ ...draft, completedOn })} keyboardType="numbers-and-punctuation" /><Field label="Odometer (mi)" value={draft.mileage} onChangeText={(mileage) => setDraft({ ...draft, mileage })} keyboardType="decimal-pad" /><Field label="Note (optional)" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} multiline />{error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : null}</View></ScrollView></SafeAreaView></ThemedView>;
}

function Field({ label, ...props }: Readonly<{ label: string } & React.ComponentProps<typeof TextInput>>) { return <View style={styles.field}><ThemedText style={styles.label}>{label}</ThemedText><TextInput {...props} accessibilityLabel={label} placeholderTextColor={TorqueColors.secondary} style={styles.input} /></View>; }
function ActionButton({ label, onPress }: Readonly<{ label: string; onPress: () => void }>) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}><ThemedText style={styles.actionText}>{label}</ThemedText></Pressable>; }
function decimalToMilliMiles(value: string) { const [whole, fraction = ''] = value.trim().split('.'); return `${BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0'))}`; }
function formatMilliMiles(value: string) { const milli = BigInt(value); const whole = milli / 1_000n; const fraction = (milli % 1_000n).toString().padStart(3, '0').replace(/0+$/, ''); return fraction ? `${whole}.${fraction}` : whole.toString(); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas }, safeArea: { flex: 1 }, content: { padding: Spacing.four, gap: Spacing.three }, title: { color: TorqueColors.text, fontSize: 34, lineHeight: 41, fontWeight: '700' }, muted: { color: TorqueColors.secondary }, vehiclePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }, vehicleChoice: { borderRadius: 18, borderWidth: 1, borderColor: TorqueColors.divider, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one }, vehicleChoiceSelected: { backgroundColor: TorqueColors.primary, borderColor: TorqueColors.primary }, selectedText: { color: '#FFFFFF', fontWeight: '700' }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, card: { padding: Spacing.three, borderRadius: 16, backgroundColor: TorqueColors.card, gap: Spacing.one }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }, recordTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, note: { color: TorqueColors.secondary }, cardActions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one }, deleteText: { color: TorqueColors.error }, action: { minHeight: 40, borderRadius: 10, backgroundColor: TorqueColors.primary, justifyContent: 'center', paddingHorizontal: Spacing.two }, actionText: { color: '#FFFFFF', fontWeight: '700' }, empty: { gap: Spacing.two }, error: { color: TorqueColors.error }, formNavigation: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, formTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, saveText: { color: TorqueColors.primary, fontSize: 17 }, disabled: { opacity: 0.45 }, form: { borderRadius: 16, backgroundColor: TorqueColors.card, paddingHorizontal: Spacing.three }, field: { gap: Spacing.one, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider }, label: { color: TorqueColors.text, fontSize: 13, fontWeight: '600' }, input: { minHeight: 32, paddingVertical: Spacing.one, fontSize: 17, color: TorqueColors.text },
});
