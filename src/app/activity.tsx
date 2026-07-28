import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { type SymbolViewProps } from 'expo-symbols';

import { QuickAddFab } from '@/components/quick-add';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Chevron, IconTile, SectionLabel, type Tone } from '@/components/torque-ui';
import { buildActivityHistory, type ActivityFact } from '@/features/activity/history';
import { availableTripActions } from '@/features/activity/trip-actions';
import { Spacing, TorqueColors } from '@/constants/theme';
import { formatMilliMiles, isCivilDate, isMileage, mileageToMilliMiles } from '@/utils/local-values';
import { maintenanceStore, type GarageVehicle, type MaintenanceRecord, type ManualOdometerReading, type Trip, type TripRevision } from '../../modules/maintenance-store';

type ActivityFilter = 'all' | 'trips' | 'service' | 'odometer';
const filterOptions: readonly { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trips', label: 'Trips' },
  { key: 'service', label: 'Service' },
  { key: 'odometer', label: 'Odometer' },
];
const filterKinds: Record<ActivityFilter, ActivityFact['kind'] | 'all'> = { all: 'all', trips: 'trip', service: 'record', odometer: 'reading' };

type Draft = Readonly<{
  serviceName: string;
  completedOn: string;
  mileage: string;
  note: string;
}>;
const emptyDraft: Draft = {
  serviceName: '',
  completedOn: '',
  mileage: '',
  note: '',
};

export default function ActivityScreen() {
  const { quickAdd } = useLocalSearchParams<{ quickAdd?: string }>();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>();
  const [filter, setFilter] = useState<ActivityFilter>('all');
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
      const [nextSnapshot, facts] = await Promise.all([maintenanceStore.tracking.getSnapshot(), Promise.all(loadedVehicles.map(async (vehicle) => Promise.all([maintenanceStore.tracking.getTrips(vehicle.id), maintenanceStore.product.getMaintenanceRecords(vehicle.id), maintenanceStore.product.getManualOdometerReadings(vehicle.id)])))]);
      if (version !== loadVersion.current) return;
      setError(null);
      setVehicles(loadedVehicles);
      setSelectedVehicleId((current) => (current && loadedVehicles.some((vehicle) => vehicle.id === current) ? current : loadedVehicles[0]?.id));
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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);

  const commandTracking = async () => {
    if (!selectedVehicleId || saving || snapshot === 'recovering') return;
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

  // Quick Add routes its maintenance action here so the record form owns the flow.
  if (adding || editing || quickAdd === 'record') {
    const closeForm = () => {
      setAdding(false);
      setEditing(null);
      router.setParams({ quickAdd: undefined });
    };
    return (
      <MaintenanceForm
        vehicleId={editing?.vehicleId ?? selectedVehicleId}
        record={editing ?? undefined}
        onCancel={closeForm}
        onSaved={() => {
          closeForm();
          void load();
        }}
      />
    );
  }

  const history = buildActivityHistory({ trips, records, readings }).filter((fact) => (fact.kind !== 'trip' || fact.trip.disposition === 'confirmed') && (filter === 'all' || fact.kind === filterKinds[filter]));
  const { today, earlier } = splitByDay(history);
  const reviewRequired = trips.filter((trip) => trip.disposition === 'review_required');
  return (
    <>
      <ThemedView collapsable={false} style={styles.screen}>
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
            <ThemedText accessibilityRole="header" style={styles.title}>
              Activity
            </ThemedText>
            {loading ? (
              <ThemedText style={styles.muted}>Loading activity...</ThemedText>
            ) : error ? (
              <StateMessage message={error} retry={load} />
            ) : vehicles.length === 0 ? (
              <ThemedText style={styles.muted}>Add a vehicle in Garage before recording activity.</ThemedText>
            ) : (
              <>
                <ThemedView style={styles.controlCard}>
                  <ThemedText style={styles.sectionTitle}>{snapshot === 'tracking' ? 'Trip in progress' : snapshot === 'recovering' ? 'Trip recovery in progress' : 'Manual trip'}</ThemedText>
                  <ThemedText style={styles.muted}>{snapshot === 'tracking' ? 'One trip is active on this device.' : snapshot === 'recovering' ? 'Maintenance Tracker is safely resolving the previous trip.' : 'Start a trip when automatic tracking is unavailable.'}</ThemedText>
                  {snapshot === 'idle' ? <VehiclePicker vehicles={vehicles} selectedVehicleId={selectedVehicleId} onSelect={setSelectedVehicleId} label="Trip vehicle" /> : null}
                  <ActionButton label={saving ? 'Saving...' : snapshot === 'tracking' ? 'Stop trip' : snapshot === 'recovering' ? 'Recovering trip...' : 'Start trip'} disabled={saving || !selectedVehicleId || snapshot === 'recovering'} onPress={() => void commandTracking()} />
                </ThemedView>
                {reviewRequired.length > 0 ? (
                  <View style={styles.section}>
                    <SectionLabel>Review required</SectionLabel>
                    <Card>
                      {reviewRequired.map((trip, index) => (
                        <ActivityRow key={trip.id} descriptor={tripDescriptor(trip)} vehicleName={vehicleName(vehicles, trip.vehicleId)} timeLabel={formatTimeOfDay(trip.endedAt)} last={index === reviewRequired.length - 1} onPress={() => setReviewing(trip)} />
                      ))}
                    </Card>
                  </View>
                ) : null}
                <View style={styles.sectionHeader}>
                  <SectionLabel style={styles.historyHeader}>History</SectionLabel>
                  <Pressable accessibilityRole="button" accessibilityLabel="Add maintenance record" onPress={() => setAdding(true)} style={styles.addRecord}>
                    <ThemedText style={styles.addRecordText}>Add record</ThemedText>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {filterOptions.map((option) => (
                    <FilterChip key={option.key} label={option.label} selected={filter === option.key} onPress={() => setFilter(option.key)} />
                  ))}
                </ScrollView>
                {history.length === 0 ? (
                  <ThemedText style={styles.muted}>{filter === 'all' ? 'No activity yet.' : `No ${filter} activity yet.`}</ThemedText>
                ) : (
                  <>
                    {today.length > 0 ? <ActivityGroup label="Today" facts={today} vehicles={vehicles} onTrip={setReviewing} onEdit={setEditing} onDeleteRecord={(record) => confirmDeleteRecord(record, load, setError)} /> : null}
                    {earlier.length > 0 ? <ActivityGroup label="Earlier" facts={earlier} vehicles={vehicles} onTrip={setReviewing} onEdit={setEditing} onDeleteRecord={(record) => confirmDeleteRecord(record, load, setError)} /> : null}
                  </>
                )}
              </>
            )}
          </ScrollView>
          <QuickAddFab vehicles={vehicles} />
      </ThemedView>
      {reviewing ? (
        <Modal visible presentationStyle="pageSheet" onRequestClose={() => setReviewing(null)}>
          <TripReview
            trip={reviewing}
            vehicles={vehicles}
            onCancel={() => setReviewing(null)}
            onSaved={() => {
              setReviewing(null);
              void load();
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

function TripReview({
  trip,
  vehicles,
  onCancel,
  onSaved,
}: Readonly<{
  trip: Trip;
  vehicles: GarageVehicle[];
  onCancel: () => void;
  onSaved: () => void;
}>) {
  const proposedMilliMiles = trip.effectiveMilliMiles ?? trip.capturedMilliMiles;
  const proposedMileage = proposedMilliMiles ? formatMilliMiles(proposedMilliMiles) : '';
  const [mileage, setMileage] = useState(proposedMileage);
  const [vehicleId, setVehicleId] = useState(trip.vehicleId);
  const [revisions, setRevisions] = useState<TripRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const actions = availableTripActions(trip.disposition);
  const normalizedMileage = isMileage(mileage) ? mileageToMilliMiles(mileage) : undefined;
  const mileageChanged = normalizedMileage !== proposedMilliMiles;
  const vehicleChanged = vehicleId !== trip.vehicleId;
  useEffect(() => {
    void maintenanceStore.tracking
      .getRevisions(trip.id)
      .then(setRevisions)
      .catch(() => setError('Trip revisions could not be loaded.'))
      .finally(() => setLoadingRevisions(false));
  }, [trip.id]);
  const review = async (action: 'confirm' | 'correct' | 'reassign' | 'reject') => {
    setSaving(true);
    setError(null);
    try {
      await maintenanceStore.tracking.review({
        tripId: trip.id,
        action,
        effectiveMilliMiles: action === 'confirm' || action === 'correct' ? mileageToMilliMiles(mileage) : undefined,
        vehicleId: action === 'reassign' ? vehicleId : undefined,
      });
      onSaved();
    } catch {
      setError('This trip could not be updated. Your changes are still here.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <ThemedView collapsable={false} style={styles.screen}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
          <View style={styles.navigation}>
            <Pressable accessibilityRole="button" onPress={onCancel}>
              <ThemedText type="linkPrimary">Cancel</ThemedText>
            </Pressable>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
              Review trip
            </ThemedText>
            <View />
          </View>
          <TripCard trip={trip} vehicleName={vehicleName(vehicles, trip.vehicleId)} />
          {actions.length > 0 ? (
            <>
              <View style={styles.form}>
                <Field label="Effective distance (mi)" value={mileage} onChangeText={setMileage} keyboardType="decimal-pad" />
                <VehiclePicker vehicles={vehicles} selectedVehicleId={vehicleId} onSelect={setVehicleId} label="Assign vehicle" />
              </View>
              <View style={styles.actions}>
                {actions.includes('confirm') ? <ActionButton label="Confirm" disabled={saving || !isMileage(mileage) || mileageChanged} onPress={() => void review('confirm')} /> : null}
                {actions.includes('correct') ? <ActionButton label="Save correction" disabled={saving || !isMileage(mileage) || !mileageChanged} onPress={() => void review('correct')} /> : null}
                {actions.includes('reassign') ? <ActionButton label="Reassign" disabled={saving || !vehicleId || !vehicleChanged} onPress={() => void review('reassign')} /> : null}
                {actions.includes('reject') ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() =>
                      Alert.alert('Reject this trip?', 'Its mileage will not be added. The rejected trip will be removed from Activity history.', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Reject trip',
                          style: 'destructive',
                          onPress: () => void review('reject'),
                        },
                      ])
                    }
                  >
                    <ThemedText style={styles.delete}>Reject trip</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <ThemedText style={styles.muted}>This trip is read-only. Its revision history remains available below.</ThemedText>
          )}
          {error ? (
            <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            Revision history
          </ThemedText>
          {loadingRevisions ? (
            <ThemedText style={styles.muted}>Loading revisions...</ThemedText>
          ) : revisions.length === 0 ? (
            <ThemedText style={styles.muted}>No revisions have been recorded.</ThemedText>
          ) : (
            revisions.map((revision) => (
              <ThemedView key={revision.revisionNumber} style={styles.card}>
                <ThemedText>
                  {revision.action} · {revision.disposition}
                </ThemedText>
                <ThemedText style={styles.muted}>
                  {formatTimestamp(revision.occurredAt)} · {revision.actor}
                </ThemedText>
                <ThemedText style={styles.muted}>{vehicleName(vehicles, revision.vehicleId)}</ThemedText>
                {revision.effectiveMilliMiles ? <ThemedText>{formatMilliMiles(revision.effectiveMilliMiles)} mi</ThemedText> : null}
              </ThemedView>
            ))
          )}
        </ScrollView>
    </ThemedView>
  );
}

type Descriptor = Readonly<{ title: string; detail?: string; icon: SymbolViewProps['name']; tone: Tone }>;

function ActivityGroup({
  label,
  facts,
  vehicles,
  onTrip,
  onEdit,
  onDeleteRecord,
}: Readonly<{
  label: string;
  facts: ActivityFact[];
  vehicles: GarageVehicle[];
  onTrip: (trip: Trip) => void;
  onEdit: (record: MaintenanceRecord) => void;
  onDeleteRecord: (record: MaintenanceRecord) => void;
}>) {
  const isToday = label === 'Today';
  return (
    <View style={styles.section}>
      <SectionLabel>{label}</SectionLabel>
      <Card>
        {facts.map((fact, index) => {
          const last = index === facts.length - 1;
          const vehicle = vehicleName(vehicles, fact.vehicleId);
          const when = describeWhen(fact, isToday);
          if (fact.kind === 'trip') return <ActivityRow key={`trip:${fact.id}`} descriptor={tripDescriptor(fact.trip)} vehicleName={vehicle} timeLabel={when} last={last} onPress={() => onTrip(fact.trip)} />;
          if (fact.kind === 'record') return <ActivityRow key={`record:${fact.id}`} descriptor={recordDescriptor(fact.record)} vehicleName={vehicle} timeLabel={when} last={last} onPress={() => onEdit(fact.record)} onLongPress={() => onDeleteRecord(fact.record)} />;
          return <ActivityRow key={`reading:${fact.id}`} descriptor={readingDescriptor(fact.reading)} vehicleName={vehicle} timeLabel={when} last={last} onPress={() => Alert.alert('Manual odometer reading', `${vehicle}\n${formatTimestamp(fact.reading.effectiveAt)}\n${formatMilliMiles(fact.reading.milliMiles)} mi`)} />;
        })}
      </Card>
    </View>
  );
}

function ActivityRow({
  descriptor,
  vehicleName,
  timeLabel,
  last,
  onPress,
  onLongPress,
}: Readonly<{
  descriptor: Descriptor;
  vehicleName: string;
  timeLabel: string;
  last: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}>) {
  const subtitle = [vehicleName, timeLabel, descriptor.detail].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${descriptor.title}. ${subtitle}`}
      accessibilityHint={onLongPress ? 'Double tap to open, touch and hold to delete' : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, !last && styles.rowDivider]}
    >
      <IconTile symbol={descriptor.icon} tone={descriptor.tone} />
      <View style={styles.rowText}>
        <ThemedText style={styles.rowTitle}>{descriptor.title}</ThemedText>
        <ThemedText style={styles.rowSubtitle}>{subtitle}</ThemedText>
      </View>
      <Chevron />
    </Pressable>
  );
}

function FilterChip({ label, selected, onPress }: Readonly<{ label: string; selected: boolean; onPress: () => void }>) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</ThemedText>
    </Pressable>
  );
}

function tripDescriptor(trip: Trip): Descriptor {
  const distance = trip.effectiveMilliMiles ?? trip.capturedMilliMiles;
  const reason = trip.failureReason ? trip.failureReason.replaceAll('_', ' ') : undefined;
  if (trip.disposition === 'confirmed') return { title: `Trip confirmed${distance ? ` — ${formatMilliMiles(distance, true)} mi` : ''}`, icon: 'point.topleft.down.curvedto.point.bottomright.up', tone: 'trip' };
  if (trip.disposition === 'review_required') return { title: 'Trip needs review', detail: reason ?? 'needs review', icon: 'exclamationmark.circle.fill', tone: 'danger' };
  if (trip.disposition === 'rejected') return { title: 'Trip rejected', icon: 'point.topleft.down.curvedto.point.bottomright.up', tone: 'neutral' };
  return { title: 'Trip failed', detail: reason, icon: 'exclamationmark.triangle.fill', tone: 'warning' };
}

function recordDescriptor(record: MaintenanceRecord): Descriptor {
  return { title: record.serviceName, detail: `${formatMilliMiles(record.milliMiles, true)} mi`, icon: 'wrench.and.screwdriver.fill', tone: 'success' };
}

function readingDescriptor(reading: ManualOdometerReading): Descriptor {
  return { title: `Odometer — ${formatMilliMiles(reading.milliMiles, true)} mi`, detail: 'new baseline', icon: 'gauge.with.needle', tone: 'warning' };
}

function splitByDay(facts: ActivityFact[]): Readonly<{ today: ActivityFact[]; earlier: ActivityFact[] }> {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  return {
    today: facts.filter((fact) => fact.occurredAt >= startOfToday),
    earlier: facts.filter((fact) => fact.occurredAt < startOfToday),
  };
}

function describeWhen(fact: ActivityFact, isToday: boolean) {
  if (fact.kind === 'record') return isToday ? 'Today' : formatShortDate(fact.occurredAt, true);
  return isToday ? formatTimeOfDay(fact.kind === 'trip' ? fact.trip.endedAt : fact.reading.effectiveAt) : formatShortDate(fact.occurredAt, false);
}

function confirmDeleteRecord(record: MaintenanceRecord, reload: () => Promise<void>, setError: (message: string) => void) {
  Alert.alert('Delete this record?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        void maintenanceStore.product
          .deleteMaintenanceRecord(record.id)
          .then(reload)
          .catch(() => setError('The record could not be deleted. Try again.'));
      },
    },
  ]);
}

function TripCard({ trip, vehicleName, onPress }: Readonly<{ trip: Trip; vehicleName: string; onPress?: () => void }>) {
  const content = (
    <ThemedView style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.recordTitle}>Trip · {trip.disposition.replace('_', ' ')}</ThemedText>
        <ThemedText style={styles.muted}>{formatTimestamp(trip.endedAt)}</ThemedText>
      </View>
      <ThemedText style={styles.muted}>
        {vehicleName}
        {trip.failureReason ? ` · ${trip.failureReason.replaceAll('_', ' ')}` : ''}
      </ThemedText>
      {trip.capturedMilliMiles ? <ThemedText>{formatMilliMiles(trip.capturedMilliMiles)} mi captured</ThemedText> : null}
      {trip.effectiveMilliMiles ? <ThemedText>{formatMilliMiles(trip.effectiveMilliMiles)} mi effective</ThemedText> : null}
    </ThemedView>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`Trip ${trip.disposition} for ${vehicleName}`} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}
function VehiclePicker({
  vehicles,
  selectedVehicleId,
  onSelect,
  label,
}: Readonly<{
  vehicles: GarageVehicle[];
  selectedVehicleId?: string;
  onSelect: (id: string) => void;
  label: string;
}>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.picker}>
      {vehicles.map((vehicle) => (
        <Choice key={vehicle.id} label={vehicle.nickname} selected={vehicle.id === selectedVehicleId} onPress={() => onSelect(vehicle.id)} />
      ))}
    </View>
  );
}
function Choice({ label, selected, onPress }: Readonly<{ label: string; selected: boolean; onPress: () => void }>) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <ThemedText style={selected ? styles.choiceTextSelected : undefined}>{label}</ThemedText>
    </Pressable>
  );
}
function StateMessage({ message, retry }: Readonly<{ message: string; retry: () => void }>) {
  return (
    <View style={styles.section}>
      <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
        {message}
      </ThemedText>
      <ActionButton label="Try again" onPress={() => void retry()} />
    </View>
  );
}
function MaintenanceForm({
  vehicleId,
  record,
  onCancel,
  onSaved,
}: Readonly<{
  vehicleId?: string;
  record?: MaintenanceRecord;
  onCancel: () => void;
  onSaved: () => void;
}>) {
  const [draft, setDraft] = useState<Draft>(
    record
      ? {
          serviceName: record.serviceName,
          completedOn: record.completedOn,
          mileage: formatMilliMiles(record.milliMiles),
          note: record.note ?? '',
        }
      : emptyDraft,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = Boolean(vehicleId && draft.serviceName.trim() && isCivilDate(draft.completedOn) && isMileage(draft.mileage));
  const save = async () => {
    if (!valid || !vehicleId) return;
    setSaving(true);
    try {
      const input = {
        vehicleId,
        serviceName: draft.serviceName.trim(),
        completedOn: draft.completedOn,
        milliMiles: mileageToMilliMiles(draft.mileage),
        note: draft.note.trim() || undefined,
      };
      if (record)
        await maintenanceStore.product.updateMaintenanceRecord({
          ...input,
          id: record.id,
        });
      else await maintenanceStore.product.createMaintenanceRecord(input);
      onSaved();
    } catch {
      setError('The record could not be saved. Your changes are still here.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <ThemedView collapsable={false} style={styles.screen}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
          <View style={styles.navigation}>
            <Pressable accessibilityRole="button" onPress={onCancel}>
              <ThemedText type="linkPrimary">Cancel</ThemedText>
            </Pressable>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
              {record ? 'Edit maintenance' : 'Add maintenance'}
            </ThemedText>
            <Pressable accessibilityRole="button" disabled={!valid || saving} onPress={() => void save()}>
              <ThemedText type="linkPrimary">Save</ThemedText>
            </Pressable>
          </View>
          <View style={styles.form}>
            <Field label="Service" value={draft.serviceName} onChangeText={(serviceName) => setDraft({ ...draft, serviceName })} />
            <Field label="Completed date (YYYY-MM-DD)" value={draft.completedOn} onChangeText={(completedOn) => setDraft({ ...draft, completedOn })} />
            <Field label="Odometer (mi)" value={draft.mileage} onChangeText={(mileage) => setDraft({ ...draft, mileage })} keyboardType="decimal-pad" />
            <Field label="Note (optional)" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} multiline />
          </View>
          {error ? (
            <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
    </ThemedView>
  );
}
function Field({ label, ...props }: Readonly<{ label: string } & React.ComponentProps<typeof TextInput>>) {
  return (
    <View style={styles.field}>
      <ThemedText>{label}</ThemedText>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={TorqueColors.secondary} style={styles.input} />
    </View>
  );
}
function ActionButton({ label, onPress, disabled = false }: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}>
      <ThemedText style={styles.actionText}>{label}</ThemedText>
    </Pressable>
  );
}
function vehicleName(vehicles: GarageVehicle[], vehicleId?: string) {
  return vehicles.find((vehicle) => vehicle.id === vehicleId)?.nickname ?? 'Unavailable vehicle';
}
function formatTimestamp(value: string) {
  return new Date(Number(value)).toLocaleString();
}
function formatTimeOfDay(value: string) {
  return new Date(Number(value)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function formatShortDate(ms: number, utc: boolean) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(utc ? { timeZone: 'UTC' } : {}) });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  content: { padding: Spacing.four, gap: Spacing.three },
  title: {
    color: TorqueColors.text,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
  },
  section: { gap: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  historyHeader: { fontSize: 20, textTransform: 'none', color: TorqueColors.text, fontWeight: '700', letterSpacing: 0 },
  addRecord: { minHeight: 32, justifyContent: 'center' },
  addRecordText: { color: TorqueColors.primary, fontSize: 15 },
  chipRow: { flexDirection: 'row', gap: Spacing.one, paddingVertical: 2, paddingRight: Spacing.four },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 100,
    backgroundColor: TorqueColors.neutralSurface,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipSelected: { backgroundColor: TorqueColors.text },
  chipText: { color: TorqueColors.text, fontSize: 14, fontWeight: '500' },
  chipTextSelected: { color: TorqueColors.canvas, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    minHeight: 60,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: TorqueColors.text, fontSize: 16 },
  rowSubtitle: { color: TorqueColors.secondary, fontSize: 13 },
  muted: { color: TorqueColors.secondary },
  controlCard: {
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: TorqueColors.card,
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: TorqueColors.card,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  recordTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TorqueColors.divider,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  choiceSelected: {
    backgroundColor: TorqueColors.primary,
    borderColor: TorqueColors.primary,
  },
  choiceTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  action: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: TorqueColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  actionText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.45 },
  navigation: {
    minHeight: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: Spacing.two,
    rowGap: Spacing.one,
  },
  form: {
    borderRadius: 16,
    backgroundColor: TorqueColors.card,
    paddingHorizontal: Spacing.three,
  },
  field: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: TorqueColors.divider,
  },
  input: { color: TorqueColors.text, fontSize: 17, minHeight: 44 },
  actions: { gap: Spacing.two },
  delete: {
    color: TorqueColors.error,
    fontWeight: '700',
    textAlign: 'center',
    padding: Spacing.two,
  },
  error: { color: TorqueColors.error },
});
