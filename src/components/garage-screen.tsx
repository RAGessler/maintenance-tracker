import { useEffect, useState } from 'react';
import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type GarageVehicle } from '../../modules/maintenance-store';

type Draft = Readonly<{ nickname: string; year: string; make: string; model: string; odometer: string }>;
const emptyDraft: Draft = { nickname: '', year: '', make: '', model: '', odometer: '' };

export function GarageScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadVehicles = () => {
    setLoading(true);
    setLoadError(null);
    maintenanceStore.product.getVehicles().then(setVehicles).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Vehicles could not be loaded.')).finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    maintenanceStore.product.getVehicles()
      .then((loadedVehicles) => { if (active) setVehicles(loadedVehicles); })
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
          ) : vehicles.length === 0 ? (
            <EmptyGarage onAdd={() => setAdding(true)} />
          ) : (
            <VehicleList vehicles={vehicles} onAdd={() => setAdding(true)} />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
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

function VehicleList({ vehicles, onAdd }: Readonly<{ vehicles: GarageVehicle[]; onAdd: () => void }>) {
  return (
    <View style={styles.list}>
      {vehicles.map((vehicle) => (
        <ThemedView key={vehicle.id} style={styles.vehicleCard} accessibilityLabel={`${vehicle.nickname}, ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${formatMiles(vehicle.currentOdometerMilliMiles)} mile manual odometer reading`}>
          <View style={styles.vehicleHero}><SymbolView name={{ ios: 'car.side.fill', android: 'directions_car', web: 'directions_car' }} tintColor="#B9D8F7" size={54} /></View>
          <View style={styles.vehicleDetails}><ThemedText style={styles.vehicleName}>{vehicle.nickname}</ThemedText><ThemedText style={styles.vehicleModel}>{vehicle.year} {vehicle.make} {vehicle.model}</ThemedText><ThemedText style={styles.vehicleMileage}>{formatMiles(vehicle.currentOdometerMilliMiles)} mi manual baseline</ThemedText></View>
        </ThemedView>
      ))}
      <ActionButton label="Add another vehicle" onPress={onAdd} />
    </View>
  );
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
      onCreated({ ...vehicle, currentOdometerMilliMiles: toMilliMiles(draft.odometer) });
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
          <View style={styles.photoPanel}><SymbolView name={{ ios: 'photo.badge.plus', android: 'add_a_photo', web: 'image' }} tintColor={TorqueColors.primary} size={28} /><ThemedText style={styles.photoTitle}>Add a hero photo</ThemedText><ThemedText style={styles.photoDetail}>Optional</ThemedText></View>
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
  vehicleCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: TorqueColors.card }, vehicleHero: { height: 150, backgroundColor: '#E8F2FC', alignItems: 'center', justifyContent: 'center' }, vehicleDetails: { padding: Spacing.three, gap: Spacing.half }, vehicleName: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' }, vehicleModel: { color: TorqueColors.text, fontSize: 16 }, vehicleMileage: { color: TorqueColors.secondary, fontSize: 13 },
  formNavigation: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, formTitle: { color: TorqueColors.text, fontSize: 17, fontWeight: '700' }, navigationAction: { color: TorqueColors.primary, fontSize: 17 }, photoPanel: { height: 132, borderRadius: Spacing.three, borderWidth: 1, borderColor: TorqueColors.divider, backgroundColor: TorqueColors.card, alignItems: 'center', justifyContent: 'center', gap: Spacing.one }, photoTitle: { color: TorqueColors.primary, fontSize: 16, fontWeight: '600' }, photoDetail: { color: TorqueColors.secondary, fontSize: 13 }, formIntro: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 }, fieldGroup: { borderRadius: Spacing.three, backgroundColor: TorqueColors.card, paddingHorizontal: Spacing.three }, field: { gap: Spacing.one, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider }, fieldLabel: { color: TorqueColors.text, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 30, paddingVertical: Spacing.one, fontSize: 17, color: TorqueColors.text }, action: { minHeight: 48, borderRadius: 12, backgroundColor: TorqueColors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three }, actionText: { color: '#FFFFFF', fontWeight: '700' }, error: { color: TorqueColors.error }, disabled: { opacity: 0.45 },
});
