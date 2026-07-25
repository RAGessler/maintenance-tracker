import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { Link, type Href, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScheduleManager } from '@/features/schedules/schedule-manager';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type GarageVehicle, type ManualOdometerReading, type TrackingSetup } from '../../modules/maintenance-store';

type Draft = Readonly<{ nickname: string; year: string; make: string; model: string; odometer: string }>;
const emptyDraft: Draft = { nickname: '', year: '', make: '', model: '', odometer: '' };

export function GarageScreen() {
  const { vehicleId, scheduleId } = useLocalSearchParams<{ vehicleId?: string; scheduleId?: string }>();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [archivedVehicles, setArchivedVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadVehicles = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    loadGarageVehicles().then(([active, archived]) => { setVehicles(active); setArchivedVehicles(archived); }).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Vehicles could not be loaded.')).finally(() => setLoading(false));
  }, []);

  useFocusEffect(loadVehicles);

  if (adding) {
    return <VehicleForm onCancel={() => setAdding(false)} onCreated={(vehicle) => { setVehicles((current) => [...current, vehicle]); setAdding(false); }} />;
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText accessibilityRole="header" style={styles.pageTitle}>Garage</ThemedText>
          {loading ? <ThemedText>Loading vehicles...</ThemedText> : loadError ? (
            <View style={styles.empty}>
              <ThemedText accessibilityLiveRegion="polite">{loadError}</ThemedText>
              <ActionButton label="Try again" onPress={loadVehicles} />
            </View>
          ) : vehicles.length === 0 && archivedVehicles.length === 0 ? (
            <EmptyGarage onAdd={() => setAdding(true)} />
          ) : (
            <VehicleList vehicles={vehicles} archivedVehicles={archivedVehicles} onAdd={() => setAdding(true)} onChanged={loadVehicles} openVehicleId={vehicleId} openScheduleId={scheduleId} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

async function loadGarageVehicles(): Promise<[GarageVehicle[], GarageVehicle[]]> {
  const [active, archived] = await Promise.all([
    maintenanceStore.product.getVehicles(),
    maintenanceStore.product.getArchivedVehicles().catch((error: unknown) => {
      if (error instanceof Error && error.message.includes('Rebuild the iOS development client')) return [];
      throw error;
    }),
  ]);
  return [active, archived];
}

function EmptyGarage({ onAdd }: Readonly<{ onAdd: () => void }>) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><SymbolView name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }} tintColor={TorqueColors.primary} size={38} /></View>
      <ThemedText accessibilityRole="header" style={styles.emptyTitle}>No vehicles yet</ThemedText>
      <ThemedText style={styles.emptyCopy}>Add a vehicle to track maintenance and odometer readings. Automatic trip tracking is optional and set up later.</ThemedText>
      <ActionButton label="Add a vehicle" onPress={onAdd} />
      <Link href={'/settings' as Href} asChild>
        <Pressable accessibilityRole="link"><ThemedText type="linkPrimary">How this app stores your data</ThemedText></Pressable>
      </Link>
    </View>
  );
}

function VehicleList({ vehicles, archivedVehicles, onAdd, onChanged, openVehicleId, openScheduleId }: Readonly<{ vehicles: GarageVehicle[]; archivedVehicles: GarageVehicle[]; onAdd: () => void; onChanged: () => void; openVehicleId?: string; openScheduleId?: string }>) {
  return (
    <View style={styles.list}>
      {vehicles.map((vehicle) => (
         <VehicleCard key={`${vehicle.id}:${vehicle.id === openVehicleId}`} vehicle={vehicle} onChanged={onChanged} open={vehicle.id === openVehicleId} openScheduleId={vehicle.id === openVehicleId ? openScheduleId : undefined} />
      ))}
      <ActionButton label="Add another vehicle" onPress={onAdd} />
      {archivedVehicles.length > 0 && <>
        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>Archived vehicles</ThemedText>
        {archivedVehicles.map((vehicle) => <ArchivedVehicleCard key={vehicle.id} vehicle={vehicle} onChanged={onChanged} />)}
      </>}
    </View>
  );
}

function VehicleCard({ vehicle, onChanged, open, openScheduleId }: Readonly<{ vehicle: GarageVehicle; onChanged: () => void; open: boolean; openScheduleId?: string }>) {
  const [editing, setEditing] = useState(open);
  if (editing) return <VehicleEditor vehicle={vehicle} onCancel={() => setEditing(false)} onChanged={() => { setEditing(false); onChanged(); }} openScheduleId={openScheduleId} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${vehicle.nickname}, ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${formatMiles(vehicle.currentOdometerMilliMiles)} mile manual odometer reading`} onPress={() => setEditing(true)}>
      <ThemedView style={styles.vehicleCard}>
          {vehicle.heroPhotoUri ? <Image source={{ uri: vehicle.heroPhotoUri }} style={styles.vehicleHero} accessibilityLabel={`${vehicle.nickname} hero photo`} /> : <View style={styles.vehicleHero}><SymbolView name={{ ios: 'car.side.fill', android: 'directions_car', web: 'directions_car' }} tintColor="#B9D8F7" size={54} /></View>}
          <View style={styles.vehicleDetails}><ThemedText style={styles.vehicleName}>{vehicle.nickname}</ThemedText><ThemedText style={styles.vehicleModel}>{vehicle.year} {vehicle.make} {vehicle.model}</ThemedText><ThemedText style={styles.vehicleMileage}>{formatMiles(vehicle.currentOdometerMilliMiles)} mi estimated</ThemedText><ThemedText style={styles.vehicleMileage}>Due: {vehicle.scheduleCount === 0 ? 'No schedules yet' : `${vehicle.scheduleCount} schedules`}</ThemedText><ThemedText style={styles.vehicleMileage}>Tracking: {vehicle.trackingReadiness === 'automatic_setup' ? 'Automatic setup configured' : 'Manual only'}</ThemedText><ThemedText style={styles.vehicleMileage}>Hero photo: {vehicle.heroPhotoUri ? 'Added' : 'Not added'}</ThemedText></View>
      </ThemedView>
    </Pressable>
  );
}

function ArchivedVehicleCard({ vehicle, onChanged }: Readonly<{ vehicle: GarageVehicle; onChanged: () => void }>) {
  const restore = async () => {
    try { await maintenanceStore.product.restoreVehicle(vehicle.id); onChanged(); }
    catch { Alert.alert('Could not restore vehicle', 'The vehicle remains archived. Try again.'); }
  };
  return <ThemedView style={styles.archivedCard}><View style={styles.archivedDetails}><ThemedText style={styles.vehicleName}>{vehicle.nickname}</ThemedText><ThemedText style={styles.vehicleModel}>{vehicle.year} {vehicle.make} {vehicle.model}</ThemedText><ThemedText style={styles.vehicleMileage}>Archived · tracking setup removed</ThemedText></View><ActionButton label="Restore" onPress={restore} /></ThemedView>;
}

function VehicleEditor({ vehicle, onCancel, onChanged, openScheduleId }: Readonly<{ vehicle: GarageVehicle; onCancel: () => void; onChanged: () => void; openScheduleId?: string }>) {
  const [draft, setDraft] = useState({ nickname: vehicle.nickname, year: String(vehicle.year), make: vehicle.make, model: vehicle.model });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = draft.nickname.trim() && draft.make.trim() && draft.model.trim() && Number.isInteger(Number(draft.year)) && Number(draft.year) >= 1886;
  const save = async () => {
    if (!valid) return;
    setSaving(true); setError(null);
    try { await maintenanceStore.product.updateVehicle({ id: vehicle.id, nickname: draft.nickname.trim(), year: Number(draft.year), make: draft.make.trim(), model: draft.model.trim() }); onChanged(); }
    catch { setError('The profile could not be saved. Your changes are still here.'); }
    finally { setSaving(false); }
  };
  const archive = () => Alert.alert('Archive this vehicle?', 'Its history stays available, but active tracking setup is removed. You can restore the profile later.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Archive', style: 'destructive', onPress: async () => { try { await maintenanceStore.product.archiveVehicle(vehicle.id); onChanged(); } catch { setError('This vehicle cannot be archived while a trip is active. Stop the trip first.'); } } },
  ]);
  const changePhoto = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
    if (result.canceled) return;
    const photo = result.assets[0];
    if (photo.fileSize && photo.fileSize > 10_000_000) {
      setError('Choose an image smaller than 10 MB.');
      return;
    }
    try { await maintenanceStore.product.replaceHeroPhoto({ vehicleId: vehicle.id, sourceUri: photo.uri }); onChanged(); }
    catch { setError('The photo could not be added. Your current photo is unchanged.'); }
  };
  const removePhoto = async () => {
    try { await maintenanceStore.product.removeHeroPhoto(vehicle.id); onChanged(); }
    catch { setError('The photo could not be removed. Try again.'); }
  };
  const photoOptions = () => {
    const options = vehicle.heroPhotoUri ? ['Replace photo', 'Remove photo', 'Cancel'] : ['Choose photo', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: vehicle.heroPhotoUri ? 1 : undefined }, (index) => {
      if (index === 0) void changePhoto();
      if (vehicle.heroPhotoUri && index === 1) void removePhoto();
    });
  };
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.formNavigation}><Pressable accessibilityRole="button" onPress={onCancel}><ThemedText style={styles.navigationAction}>Cancel</ThemedText></Pressable><ThemedText accessibilityRole="header" style={styles.formTitle}>Vehicle profile</ThemedText><Pressable accessibilityRole="button" disabled={!valid || saving} onPress={save}><ThemedText style={[styles.navigationAction, (!valid || saving) && styles.disabled]}>Save</ThemedText></Pressable></View>
    <ThemedText style={styles.formIntro}>Identity fields can be changed here. Odometer readings remain an auditable history and are updated separately.</ThemedText>
    <TrackingSetupStatus vehicleId={vehicle.id} />
    <Pressable accessibilityRole="button" accessibilityLabel="Hero photo" accessibilityHint="Opens photo options" onPress={photoOptions} style={styles.photoPanel}>{vehicle.heroPhotoUri ? <Image source={{ uri: vehicle.heroPhotoUri }} style={styles.photoPreview} accessibilityLabel={`${vehicle.nickname} hero photo`} /> : <SymbolView name={{ ios: 'photo.badge.plus', android: 'add_a_photo', web: 'image' }} tintColor={TorqueColors.primary} size={28} />}<ThemedText style={styles.photoTitle}>{vehicle.heroPhotoUri ? 'Hero photo' : 'Add a hero photo'}</ThemedText></Pressable>
    <View style={styles.fieldGroup}><Field label="Nickname" value={draft.nickname} onChangeText={(nickname) => setDraft({ ...draft, nickname })} /><Field label="Year" value={draft.year} onChangeText={(year) => setDraft({ ...draft, year })} keyboardType="number-pad" /><Field label="Make" value={draft.make} onChangeText={(make) => setDraft({ ...draft, make })} /><Field label="Model" value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} /></View>
    <OdometerReadingManager vehicle={vehicle} onChanged={onChanged} />
    <ScheduleManager vehicleId={vehicle.id} currentOdometerMilliMiles={vehicle.currentOdometerMilliMiles} highlightedScheduleId={openScheduleId} />
    {error && <ThemedText style={styles.error} accessibilityLiveRegion="polite">{error}</ThemedText>}
    <ActionButton label="Archive vehicle" onPress={archive} />
  </ScrollView></SafeAreaView></ThemedView>;
}

function TrackingSetupStatus({ vehicleId }: Readonly<{ vehicleId: string }>) {
  const [setup, setSetup] = useState<TrackingSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useEffectEvent(() => {
    setError(null);
    maintenanceStore.tracking.getSetup(vehicleId).then(setSetup).catch((reason: unknown) => {
      setError(reason instanceof Error && reason.message.includes('Rebuild the iOS development client') ? reason.message : 'Automatic tracking setup could not be checked.');
    });
  });
  useEffect(() => {
    const task = setTimeout(load, 0);
    return () => clearTimeout(task);
  }, [vehicleId]);
  if (error) return <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText>;
  if (!setup) return <ThemedText style={styles.formIntro}>Checking automatic tracking setup...</ThemedText>;
  const requirements = [
    [setup.locationReady, 'Precise Always Location'],
    [setup.automationsReady, 'Start and End Trip Shortcuts with Run Immediately'],
    [setup.routeReady, 'Supported route observation'],
    [setup.testReady, 'In-app Shortcut test'],
  ] as const;
  return <View accessibilityLiveRegion="polite" style={styles.trackingPanel}>
    <ThemedText accessibilityRole="header" style={styles.trackingTitle}>{setup.state === 'ready' ? 'Automatic tracking ready' : 'Automatic tracking off'}</ThemedText>
    <ThemedText style={styles.trackingCopy}>{setup.state === 'ready' ? 'This vehicle can receive its selected Shortcut. Review every captured trip before it affects the estimate.' : 'Setup is incomplete, so no trip will start on its own. You can still start a trip manually and add odometer readings.'}</ThemedText>
    {requirements.map(([ready, label]) => <ThemedText key={label} style={styles.trackingRequirement}>{ready ? 'Complete' : 'Required'}: {label}</ThemedText>)}
    {setup.state === 'incomplete' ? <ThemedText style={styles.trackingCopy}>In Shortcuts, add Start Trip and End Trip, select this vehicle, then create your selected Bluetooth or CarPlay automations and choose Run Immediately. A route observation and in-app test complete setup.</ThemedText> : null}
  </View>;
}

function OdometerReadingManager({ vehicle, onChanged }: Readonly<{ vehicle: GarageVehicle; onChanged: () => void }>) {
  const [adding, setAdding] = useState(false);
  const [readings, setReadings] = useState<ManualOdometerReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useEffectEvent(() => {
    setLoading(true);
    maintenanceStore.product.getManualOdometerReadings(vehicle.id).then(setReadings).catch(() => setError('Odometer history could not be loaded. Try again.')).finally(() => setLoading(false));
  });
  useEffect(() => {
    const task = setTimeout(load, 0);
    return () => clearTimeout(task);
  }, [vehicle.id, reloadKey]);
  if (adding) return <OdometerReadingForm vehicle={vehicle} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); setReloadKey((key) => key + 1); onChanged(); }} />;
  return <View style={styles.odometerSection}>
    <View style={styles.readOnlyRow}><View><ThemedText style={styles.fieldLabel}>Estimated odometer</ThemedText><ThemedText>{formatMiles(vehicle.currentOdometerMilliMiles)} mi</ThemedText></View><Pressable accessibilityRole="button" accessibilityLabel="Add odometer reading" onPress={() => setAdding(true)}><ThemedText type="linkPrimary">Odometer reading</ThemedText></Pressable></View>
    <ThemedText style={styles.formIntro}>A dashboard reading becomes the current baseline. Earlier trips and maintenance remain unchanged.</ThemedText>
    <ThemedText accessibilityRole="header" style={styles.historyTitle}>Odometer history</ThemedText>
    {loading ? <ThemedText>Loading odometer history...</ThemedText> : error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : readings.map((reading) => <View key={reading.id} style={styles.historyRow}><ThemedText>{formatDate(reading.effectiveAt)}</ThemedText><ThemedText>{formatMiles(reading.milliMiles)} mi</ThemedText></View>)}
  </View>;
}

function OdometerReadingForm({ vehicle, onCancel, onSaved }: Readonly<{ vehicle: GarageVehicle; onCancel: () => void; onSaved: () => void }>) {
  const [miles, setMiles] = useState(formatMiles(vehicle.currentOdometerMilliMiles));
  const [date, setDate] = useState(civilToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isMileage(miles) && isCivilDate(date);
  const save = async () => {
    if (!valid) return;
    const submit = async () => {
      setSaving(true); setError(null);
      try { await maintenanceStore.product.appendManualOdometerReading({ vehicleId: vehicle.id, milliMiles: toMilliMiles(miles), effectiveAt: String(new Date(`${date}T12:00:00`).getTime()) }); onSaved(); }
      catch { setError('The odometer reading could not be saved. Your entry is still here.'); }
      finally { setSaving(false); }
    };
    if (BigInt(toMilliMiles(miles)) < BigInt(vehicle.currentOdometerMilliMiles)) {
      Alert.alert('This reading is lower than your estimate', 'Save it only if the dashboard reading is correct. This adds a new baseline and does not delete prior history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save lower reading', style: 'destructive', onPress: () => void submit() }]);
      return;
    }
    await submit();
  };
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.formNavigation}><Pressable accessibilityRole="button" onPress={onCancel}><ThemedText style={styles.navigationAction}>Cancel</ThemedText></Pressable><ThemedText accessibilityRole="header" style={styles.formTitle}>Odometer reading</ThemedText><Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid || saving }} disabled={!valid || saving} onPress={() => void save()}><ThemedText style={[styles.navigationAction, (!valid || saving) && styles.disabled]}>Save</ThemedText></Pressable></View><ThemedText style={styles.formIntro}>Enter the dashboard reading. Saving adds an auditable row; it never changes an earlier reading.</ThemedText><View style={styles.fieldGroup}><Field label="Reading date (YYYY-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" error={date && !isCivilDate(date) ? 'Enter a valid calendar date.' : undefined} /><Field label="Odometer (mi)" value={miles} onChangeText={setMiles} keyboardType="decimal-pad" error={miles && !isMileage(miles) ? 'Enter a non-negative mileage with up to three decimal places.' : undefined} /></View>{error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : null}</ScrollView></SafeAreaView></ThemedView>;
}

function VehicleForm({ onCancel, onCreated }: Readonly<{ onCancel: () => void; onCreated: (vehicle: GarageVehicle) => void }>) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof Draft, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const validation = validate(draft);

  const save = async () => {
    if (validation) return;
    setSaving(true);
    setError(null);
    try {
      const vehicle = await maintenanceStore.product.createVehicle({
        nickname: draft.nickname.trim(), year: Number(draft.year), make: draft.make.trim(), model: draft.model.trim(), initialOdometerMilliMiles: toMilliMiles(draft.odometer),
      });
       onCreated({ ...vehicle, currentOdometerMilliMiles: toMilliMiles(draft.odometer), scheduleCount: 0, trackingReadiness: 'manual_only' });
    } catch {
      setError('The vehicle could not be saved. Your information is still here. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.formNavigation}><Pressable accessibilityRole="button" onPress={onCancel}><ThemedText style={styles.navigationAction}>Cancel</ThemedText></Pressable><ThemedText accessibilityRole="header" style={styles.formTitle}>Add vehicle</ThemedText><Pressable accessibilityRole="button" disabled={Boolean(validation) || saving} onPress={save}><ThemedText style={[styles.navigationAction, (validation || saving) && styles.disabled]}>Save</ThemedText></Pressable></View>
           <View style={styles.photoPanel}><SymbolView name={{ ios: 'photo.badge.plus', android: 'add_a_photo', web: 'image' }} tintColor={TorqueColors.primary} size={28} /><ThemedText style={styles.photoTitle}>Add a hero photo after saving</ThemedText><ThemedText style={styles.photoDetail}>Optional</ThemedText></View>
          <ThemedText style={styles.formIntro}>Your current odometer is the first authoritative manual baseline.</ThemedText>
          <View style={styles.fieldGroup}><Field label="Nickname" value={draft.nickname} onChangeText={(nickname) => setDraft({ ...draft, nickname })} onBlur={() => setTouched({ ...touched, nickname: true })} error={touched.nickname && !draft.nickname.trim() ? 'Nickname is required.' : undefined} /><Field label="Year" value={draft.year} onChangeText={(year) => setDraft({ ...draft, year })} onBlur={() => setTouched({ ...touched, year: true })} keyboardType="number-pad" error={touched.year && (!Number.isInteger(Number(draft.year)) || Number(draft.year) < 1886) ? 'Enter a valid year.' : undefined} /><Field label="Make" value={draft.make} onChangeText={(make) => setDraft({ ...draft, make })} onBlur={() => setTouched({ ...touched, make: true })} error={touched.make && !draft.make.trim() ? 'Make is required.' : undefined} /><Field label="Model" value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} onBlur={() => setTouched({ ...touched, model: true })} error={touched.model && !draft.model.trim() ? 'Model is required.' : undefined} /><Field label="Odometer (mi)" value={draft.odometer} onChangeText={(odometer) => setDraft({ ...draft, odometer })} onBlur={() => setTouched({ ...touched, odometer: true })} keyboardType="number-pad" error={touched.odometer && !isMileage(draft.odometer) ? 'Enter a non-negative whole number of miles.' : undefined} /></View>
          {error && <ThemedText style={styles.error} accessibilityLiveRegion="polite">{error}</ThemedText>}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({ label, error, ...props }: Readonly<{ label: string; error?: string } & React.ComponentProps<typeof TextInput>>) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput {...props} accessibilityLabel={label} accessibilityHint={error} placeholderTextColor={TorqueColors.secondary} style={styles.input} />
      {error && <ThemedText style={styles.error} accessibilityLiveRegion="polite">{error}</ThemedText>}
    </View>
  );
}

function ActionButton({ label, onPress, disabled = false }: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, (pressed || disabled) && styles.disabled]}><ThemedText style={styles.actionText}>{label}</ThemedText></Pressable>;
}

function validate(draft: Draft) {
  if (!draft.nickname.trim() || !draft.make.trim() || !draft.model.trim()) return 'required';
  if (!Number.isInteger(Number(draft.year)) || Number(draft.year) < 1886) return 'year';
  return isMileage(draft.odometer) ? null : 'odometer';
}

function isMileage(value: string) { return /^\d+(\.\d{1,3})?$/.test(value.trim()); }
function toMilliMiles(value: string) { const [whole, fraction = ''] = value.trim().split('.'); return (BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0'))).toString(); }
function formatMiles(milliMiles: string) { const miles = BigInt(milliMiles); const whole = miles / 1_000n; const fraction = (miles % 1_000n).toString().padStart(3, '0').replace(/0+$/, ''); return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`; }
function civilToday() { return new Date().toISOString().slice(0, 10); }
function isCivilDate(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return false; const date = new Date(`${value}T12:00:00`); return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]); }
function formatDate(effectiveAt: string) { return new Date(Number(effectiveAt)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas }, safeArea: { flex: 1 }, content: { padding: Spacing.four, gap: Spacing.three }, pageTitle: { color: TorqueColors.text, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.three, minHeight: 480 }, emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, emptyCopy: { color: TorqueColors.secondary, fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 300 }, list: { gap: Spacing.three },
  vehicleCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: TorqueColors.card }, vehicleHero: { height: 150, backgroundColor: '#E8F2FC', alignItems: 'center', justifyContent: 'center' }, vehicleDetails: { padding: Spacing.three, gap: Spacing.half }, vehicleName: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, vehicleModel: { color: TorqueColors.text, fontSize: 16 }, vehicleMileage: { color: TorqueColors.secondary, fontSize: 13 }, sectionTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700', marginTop: Spacing.two }, archivedCard: { borderRadius: 16, backgroundColor: TorqueColors.card, padding: Spacing.three, gap: Spacing.two }, archivedDetails: { gap: Spacing.half }, readOnlyRow: { borderRadius: Spacing.three, backgroundColor: TorqueColors.card, padding: Spacing.three, gap: Spacing.one, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, odometerSection: { gap: Spacing.two }, historyTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700', marginTop: Spacing.one }, historyRow: { borderRadius: Spacing.two, backgroundColor: TorqueColors.card, padding: Spacing.two, flexDirection: 'row', justifyContent: 'space-between' },
  formNavigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, formTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, navigationAction: { color: TorqueColors.primary, fontSize: 17 }, photoPanel: { minHeight: 132, borderRadius: Spacing.three, borderWidth: 1, borderColor: TorqueColors.divider, backgroundColor: TorqueColors.card, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, overflow: 'hidden' }, photoPreview: { width: '100%', height: 132 }, photoTitle: { color: TorqueColors.primary, fontSize: 16, fontWeight: '600' }, photoDetail: { color: TorqueColors.secondary, fontSize: 13 }, formIntro: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 }, fieldGroup: { borderRadius: Spacing.three, backgroundColor: TorqueColors.card, paddingHorizontal: Spacing.three }, field: { gap: Spacing.one, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider }, fieldLabel: { color: TorqueColors.text, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 30, paddingVertical: Spacing.one, fontSize: 17, color: TorqueColors.text }, action: { minHeight: 48, borderRadius: 12, backgroundColor: TorqueColors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three }, actionText: { color: '#FFFFFF', fontWeight: '700' }, error: { color: TorqueColors.error }, disabled: { opacity: 0.45 },
  trackingPanel: { borderRadius: Spacing.three, backgroundColor: '#F2F2F7', borderWidth: StyleSheet.hairlineWidth, borderColor: TorqueColors.divider, padding: Spacing.three, gap: Spacing.one }, trackingTitle: { color: TorqueColors.text, fontSize: 16, fontWeight: '700' }, trackingCopy: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 }, trackingRequirement: { color: TorqueColors.text, fontSize: 13 },
});
