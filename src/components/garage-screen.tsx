import { useEffect, useRef, useState } from 'react';
import { Link, type Href, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScheduleManager } from '@/features/schedules/schedule-manager';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type GarageVehicle } from '../../modules/maintenance-store';

type Draft = Readonly<{ nickname: string; year: string; make: string; model: string; odometer: string }>;
const emptyDraft: Draft = { nickname: '', year: '', make: '', model: '', odometer: '' };

export function GarageScreen() {
  const { vehicleId, scheduleId } = useLocalSearchParams<{ vehicleId?: string; scheduleId?: string }>();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [archivedVehicles, setArchivedVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadVehicles = () => {
    setLoading(true);
    setLoadError(null);
    loadGarageVehicles().then(([active, archived]) => { setVehicles(active); setArchivedVehicles(archived); }).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Vehicles could not be loaded.')).finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    loadGarageVehicles()
      .then(([loadedVehicles, loadedArchivedVehicles]) => { if (active) { setVehicles(loadedVehicles); setArchivedVehicles(loadedArchivedVehicles); } })
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : 'Vehicles could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
  const scrollRef = useRef<ScrollView>(null);
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
  return <ThemedView style={styles.screen}><SafeAreaView style={styles.safeArea}><ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.formNavigation}><Pressable accessibilityRole="button" onPress={onCancel}><ThemedText style={styles.navigationAction}>Cancel</ThemedText></Pressable><ThemedText accessibilityRole="header" style={styles.formTitle}>Vehicle profile</ThemedText><Pressable accessibilityRole="button" disabled={!valid || saving} onPress={save}><ThemedText style={[styles.navigationAction, (!valid || saving) && styles.disabled]}>Save</ThemedText></Pressable></View>
    <ThemedText style={styles.formIntro}>Identity fields can be changed here. Odometer readings remain an auditable history and are updated separately.</ThemedText>
    <Pressable accessibilityRole="button" accessibilityLabel="Hero photo" accessibilityHint="Opens photo options" onPress={photoOptions} style={styles.photoPanel}>{vehicle.heroPhotoUri ? <Image source={{ uri: vehicle.heroPhotoUri }} style={styles.photoPreview} accessibilityLabel={`${vehicle.nickname} hero photo`} /> : <SymbolView name={{ ios: 'photo.badge.plus', android: 'add_a_photo', web: 'image' }} tintColor={TorqueColors.primary} size={28} />}<ThemedText style={styles.photoTitle}>{vehicle.heroPhotoUri ? 'Hero photo' : 'Add a hero photo'}</ThemedText></Pressable>
    <View style={styles.fieldGroup}><Field label="Nickname" value={draft.nickname} onChangeText={(nickname) => setDraft({ ...draft, nickname })} /><Field label="Year" value={draft.year} onChangeText={(year) => setDraft({ ...draft, year })} keyboardType="number-pad" /><Field label="Make" value={draft.make} onChangeText={(make) => setDraft({ ...draft, make })} /><Field label="Model" value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} /></View>
    <View style={styles.readOnlyRow}><ThemedText style={styles.fieldLabel}>Current manual odometer</ThemedText><ThemedText>{formatMiles(vehicle.currentOdometerMilliMiles)} mi</ThemedText></View>
    <ScheduleManager vehicleId={vehicle.id} currentOdometerMilliMiles={vehicle.currentOdometerMilliMiles} highlightedScheduleId={openScheduleId} scrollRef={scrollRef} />
    {error && <ThemedText style={styles.error} accessibilityLiveRegion="polite">{error}</ThemedText>}
    <ActionButton label="Archive vehicle" onPress={archive} />
  </ScrollView></SafeAreaView></ThemedView>;
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

function isMileage(value: string) { return /^\d+$/.test(value.trim()); }
function toMilliMiles(value: string) { return (BigInt(value.trim()) * 1_000n).toString(); }
function formatMiles(milliMiles: string) { return (BigInt(milliMiles) / 1_000n).toLocaleString(); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas }, safeArea: { flex: 1 }, content: { padding: Spacing.four, gap: Spacing.three }, pageTitle: { color: TorqueColors.text, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.three, minHeight: 480 }, emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, emptyCopy: { color: TorqueColors.secondary, fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 300 }, list: { gap: Spacing.three },
  vehicleCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: TorqueColors.card }, vehicleHero: { height: 150, backgroundColor: '#E8F2FC', alignItems: 'center', justifyContent: 'center' }, vehicleDetails: { padding: Spacing.three, gap: Spacing.half }, vehicleName: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, vehicleModel: { color: TorqueColors.text, fontSize: 16 }, vehicleMileage: { color: TorqueColors.secondary, fontSize: 13 }, sectionTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700', marginTop: Spacing.two }, archivedCard: { borderRadius: 16, backgroundColor: TorqueColors.card, padding: Spacing.three, gap: Spacing.two }, archivedDetails: { gap: Spacing.half }, readOnlyRow: { borderRadius: Spacing.three, backgroundColor: TorqueColors.card, padding: Spacing.three, gap: Spacing.one },
  formNavigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, formTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, navigationAction: { color: TorqueColors.primary, fontSize: 17 }, photoPanel: { minHeight: 132, borderRadius: Spacing.three, borderWidth: 1, borderColor: TorqueColors.divider, backgroundColor: TorqueColors.card, alignItems: 'center', justifyContent: 'center', gap: Spacing.one, overflow: 'hidden' }, photoPreview: { width: '100%', height: 132 }, photoTitle: { color: TorqueColors.primary, fontSize: 16, fontWeight: '600' }, photoDetail: { color: TorqueColors.secondary, fontSize: 13 }, formIntro: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 }, fieldGroup: { borderRadius: Spacing.three, backgroundColor: TorqueColors.card, paddingHorizontal: Spacing.three }, field: { gap: Spacing.one, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider }, fieldLabel: { color: TorqueColors.text, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 30, paddingVertical: Spacing.one, fontSize: 17, color: TorqueColors.text }, action: { minHeight: 48, borderRadius: 12, backgroundColor: TorqueColors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three }, actionText: { color: '#FFFFFF', fontWeight: '700' }, error: { color: TorqueColors.error }, disabled: { opacity: 0.45 },
});
