import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type MaintenanceSchedule } from '../../../modules/maintenance-store';
import { calculateDue } from './due-calculator';
import { scheduleTemplates, type ScheduleTemplate } from './schedule-templates';

type Draft = Readonly<{ serviceName: string; mileage: string; days: string; baselineDate: string; baselineMiles: string; sourceTemplateKey?: string; sourceTemplateVersion?: number }>;

export function ScheduleManager({ vehicleId, currentOdometerMilliMiles }: Readonly<{ vehicleId: string; currentOdometerMilliMiles: string }>) {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<MaintenanceSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => maintenanceStore.product.getMaintenanceSchedules(vehicleId).then(setSchedules).catch(() => setError('Maintenance schedules could not be loaded. Try again.'));
  useEffect(() => {
    void maintenanceStore.product.getMaintenanceSchedules(vehicleId).then(setSchedules).catch(() => setError('Maintenance schedules could not be loaded. Try again.'));
  }, [vehicleId]);

  const open = (template?: ScheduleTemplate, schedule?: MaintenanceSchedule) => {
    setError(null);
    setEditing(schedule ?? null);
    setDraft(schedule ? {
      serviceName: schedule.serviceName,
      mileage: schedule.mileageIntervalMilliMiles ? formatInputMiles(schedule.mileageIntervalMilliMiles) : '',
      days: schedule.dayInterval?.toString() ?? '', baselineDate: schedule.baselineDate,
      baselineMiles: formatInputMiles(schedule.baselineMilliMiles), sourceTemplateKey: schedule.sourceTemplateKey, sourceTemplateVersion: schedule.sourceTemplateVersion,
    } : {
      serviceName: template?.serviceName ?? '',
      mileage: template?.mileageIntervalMilliMiles ? formatInputMiles(template.mileageIntervalMilliMiles) : '',
      days: template?.dayInterval?.toString() ?? '', baselineDate: civilToday(),
      baselineMiles: formatInputMiles(currentOdometerMilliMiles), sourceTemplateKey: template?.key, sourceTemplateVersion: template?.version,
    });
  };

  const save = async () => {
    if (!draft || !valid(draft)) return;
    const input = { serviceName: draft.serviceName.trim(), mileageIntervalMilliMiles: draft.mileage ? toMilliMiles(draft.mileage) : undefined, dayInterval: draft.days ? Number(draft.days) : undefined, baselineDate: draft.baselineDate, baselineMilliMiles: toMilliMiles(draft.baselineMiles), sourceTemplateKey: draft.sourceTemplateKey, sourceTemplateVersion: draft.sourceTemplateVersion };
    try {
      if (editing) await maintenanceStore.product.updateMaintenanceSchedule({ id: editing.id, ...input });
      else await maintenanceStore.product.createMaintenanceSchedule({ vehicleId, ...input });
      setDraft(null); setEditing(null); await load();
    } catch (error: unknown) {
      setError(error instanceof Error && error.message.includes('Rebuild the iOS development client')
        ? 'Rebuild the iOS development client to save maintenance schedules.'
        : 'The schedule could not be saved. Your changes are still here.');
    }
  };

  const remove = (schedule: MaintenanceSchedule) => Alert.alert('Delete this schedule?', `${schedule.serviceName} will no longer appear in Due. Completed maintenance history is not deleted.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => maintenanceStore.product.deleteMaintenanceSchedule(schedule.id).then(load).catch(() => setError('The schedule could not be deleted. Try again.')) },
  ]);

  return <View style={styles.section}>
    <ThemedText accessibilityRole="header" style={styles.title}>Maintenance schedules</ThemedText>
    <ThemedText style={styles.copy}>Due status is calculated from the saved baseline and your estimated odometer.</ThemedText>
    {error && <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText>}
    {draft ? <View style={styles.form}>
      <ThemedText style={styles.formTitle}>{editing ? 'Edit schedule' : 'New schedule'}</ThemedText>
      <ScheduleField label="Service name" value={draft.serviceName} onChangeText={(serviceName) => setDraft({ ...draft, serviceName })} />
      <ScheduleField label="Mileage interval (mi)" value={draft.mileage} keyboardType="number-pad" onChangeText={(mileage) => setDraft({ ...draft, mileage })} />
      <ScheduleField label="Time interval (days)" value={draft.days} keyboardType="number-pad" onChangeText={(days) => setDraft({ ...draft, days })} />
      <ScheduleField label="Baseline date (YYYY-MM-DD)" value={draft.baselineDate} onChangeText={(baselineDate) => setDraft({ ...draft, baselineDate })} />
      <ScheduleField label="Baseline odometer (mi)" value={draft.baselineMiles} keyboardType="number-pad" onChangeText={(baselineMiles) => setDraft({ ...draft, baselineMiles })} />
      <View style={styles.actions}><Button label="Cancel" secondary onPress={() => { setDraft(null); setEditing(null); }} /><Button label="Save schedule" disabled={!valid(draft)} onPress={() => void save()} /></View>
    </View> : <>
      {schedules.map((schedule) => <ScheduleRow key={schedule.id} schedule={schedule} currentOdometerMilliMiles={currentOdometerMilliMiles} onEdit={() => open(undefined, schedule)} onDelete={() => remove(schedule)} />)}
      <View style={styles.templates}>{scheduleTemplates.map((template) => <Button key={template.key} label={`Add ${template.serviceName}`} secondary onPress={() => open(template)} />)}</View>
      <Button label="Add custom schedule" onPress={() => open()} />
    </>}
  </View>;
}

function ScheduleRow({ schedule, currentOdometerMilliMiles, onEdit, onDelete }: Readonly<{ schedule: MaintenanceSchedule; currentOdometerMilliMiles: string; onEdit: () => void; onDelete: () => void }>) {
  const due = calculateDue(schedule, currentOdometerMilliMiles, civilToday());
  const mileageCopy = due.mileage && (BigInt(due.mileage.remainingMilliMiles) < 0n ? `${formatMiles((-BigInt(due.mileage.remainingMilliMiles)).toString())} mi overdue` : `${formatMiles(due.mileage.remainingMilliMiles)} mi remaining`);
  const timeCopy = due.time && (due.time.remainingDays < 0 ? `${Math.abs(due.time.remainingDays)} days overdue` : `${due.time.remainingDays} days remaining`);
  return <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={`${schedule.serviceName}, ${due.state.replace('_', ' ')}`} onPress={onEdit}><ThemedText style={styles.rowTitle}>{schedule.serviceName}</ThemedText><ThemedText style={styles.rowCopy}>{due.state === 'due' ? 'Due now' : due.state === 'due_soon' ? 'Due soon' : 'Current'} · Controlled by {due.controllingCondition === 'both' ? 'both thresholds' : due.controllingCondition}</ThemedText><ThemedText style={styles.rowCopy}>Baseline: {formatMiles(schedule.baselineMilliMiles)} mi on {schedule.baselineDate}</ThemedText>{due.mileage && <ThemedText style={styles.rowCopy}>Mileage: due at {formatMiles(due.mileage.dueAtMilliMiles)} mi · {mileageCopy}</ThemedText>}{due.time && <ThemedText style={styles.rowCopy}>Time: due {due.time.dueOn} · {timeCopy}</ThemedText>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${schedule.serviceName}`} onPress={onDelete}><ThemedText style={styles.delete}>Delete</ThemedText></Pressable></View>;
}

function ScheduleField({ label, ...props }: Readonly<{ label: string } & React.ComponentProps<typeof TextInput>>) { return <View style={styles.field}><ThemedText style={styles.label}>{label}</ThemedText><TextInput {...props} accessibilityLabel={label} style={styles.input} /></View>; }
function Button({ label, secondary = false, disabled = false, onPress }: Readonly<{ label: string; secondary?: boolean; disabled?: boolean; onPress: () => void }>) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}><ThemedText style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</ThemedText></Pressable>; }
function valid(draft: Draft) { return Boolean(draft.serviceName.trim()) && validMiles(draft.mileage || '0') && /^\d+$/.test(draft.days || '0') && (Number(draft.mileage) > 0 || Number(draft.days) > 0) && /^\d{4}-\d{2}-\d{2}$/.test(draft.baselineDate) && validMiles(draft.baselineMiles); }
function civilToday() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatMiles(value: string) { const [whole, fraction] = formatInputMiles(value).split('.'); return `${BigInt(whole).toLocaleString()}${fraction ? `.${fraction}` : ''}`; }
function formatInputMiles(value: string) { const miles = BigInt(value) / 1_000n; const fraction = (BigInt(value) % 1_000n).toString().padStart(3, '0').replace(/0+$/, ''); return fraction ? `${miles}.${fraction}` : miles.toString(); }
function validMiles(value: string) { return /^\d+(\.\d{1,3})?$/.test(value); }
function toMilliMiles(value: string) { const [miles, fraction = ''] = value.split('.'); return (BigInt(miles) * 1_000n + BigInt(fraction.padEnd(3, '0'))).toString(); }

const styles = StyleSheet.create({
  section: { gap: Spacing.two }, title: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, copy: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 }, error: { color: TorqueColors.error }, row: { backgroundColor: TorqueColors.card, borderRadius: 12, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }, rowTitle: { color: TorqueColors.text, fontSize: 16, fontWeight: '600' }, rowCopy: { color: TorqueColors.secondary, fontSize: 13, marginTop: 3 }, delete: { color: TorqueColors.error, fontSize: 15 }, templates: { gap: Spacing.one }, form: { gap: Spacing.two, backgroundColor: TorqueColors.card, borderRadius: 12, padding: Spacing.three }, formTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, field: { gap: Spacing.half }, label: { color: TorqueColors.text, fontSize: 13, fontWeight: '600' }, input: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: TorqueColors.divider, color: TorqueColors.text, minHeight: 36, fontSize: 16 }, actions: { flexDirection: 'row', gap: Spacing.two }, button: { minHeight: 44, borderRadius: 10, backgroundColor: TorqueColors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two, flex: 1 }, buttonText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }, secondary: { backgroundColor: '#E5F1FF' }, secondaryText: { color: TorqueColors.primary }, disabled: { opacity: 0.45 },
});
