import { useEffect, useState } from 'react';
import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { maintenanceStore, type GarageVehicle } from '../../modules/maintenance-store';

type Draft = Readonly<{ nickname: string; year: string; make: string; model: string; odometer: string }>;
const emptyDraft: Draft = { nickname: '', year: '', make: '', model: '', odometer: '' };

export function GarageScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadVehicles = () => {
    setLoading(true);
    setLoadError(false);
    maintenanceStore.product.getVehicles().then(setVehicles).catch(() => setLoadError(true)).finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    maintenanceStore.product.getVehicles()
      .then((loadedVehicles) => { if (active) setVehicles(loadedVehicles); })
      .catch(() => { if (active) setLoadError(true); })
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
          <ThemedText type="subtitle" accessibilityRole="header">Garage</ThemedText>
          {loading ? <ThemedText>Loading vehicles...</ThemedText> : loadError ? (
            <View style={styles.empty}>
              <ThemedText>Vehicles could not be loaded.</ThemedText>
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
      <ThemedText type="subtitle" accessibilityRole="header">No vehicles yet.</ThemedText>
      <ThemedText themeColor="textSecondary">Add a vehicle to track maintenance and odometer readings. Automatic trip tracking is optional and set up later.</ThemedText>
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
        <ThemedView key={vehicle.id} type="backgroundElement" style={styles.vehicleCard} accessibilityLabel={`${vehicle.nickname}, ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${formatMiles(vehicle.currentOdometerMilliMiles)} mile manual odometer reading`}>
          <ThemedText type="subtitle">{vehicle.nickname}</ThemedText>
          <ThemedText>{vehicle.year} {vehicle.make} {vehicle.model}</ThemedText>
          <ThemedText themeColor="textSecondary">{formatMiles(vehicle.currentOdometerMilliMiles)} miles</ThemedText>
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
          <ThemedText type="subtitle" accessibilityRole="header">Add vehicle</ThemedText>
          <ThemedText themeColor="textSecondary">Your odometer reading is the first authoritative manual baseline.</ThemedText>
          <Field label="Nickname" value={draft.nickname} onChangeText={(nickname) => setDraft({ ...draft, nickname })} onBlur={() => setTouched({ ...touched, nickname: true })} error={touched.nickname && !draft.nickname.trim() ? 'Nickname is required.' : undefined} />
          <Field label="Year" value={draft.year} onChangeText={(year) => setDraft({ ...draft, year })} onBlur={() => setTouched({ ...touched, year: true })} keyboardType="number-pad" error={touched.year && (!Number.isInteger(Number(draft.year)) || Number(draft.year) < 1886) ? 'Enter a valid year.' : undefined} />
          <Field label="Make" value={draft.make} onChangeText={(make) => setDraft({ ...draft, make })} onBlur={() => setTouched({ ...touched, make: true })} error={touched.make && !draft.make.trim() ? 'Make is required.' : undefined} />
          <Field label="Model" value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} onBlur={() => setTouched({ ...touched, model: true })} error={touched.model && !draft.model.trim() ? 'Model is required.' : undefined} />
          <Field label="Odometer (mi)" value={draft.odometer} onChangeText={(odometer) => setDraft({ ...draft, odometer })} onBlur={() => setTouched({ ...touched, odometer: true })} keyboardType="number-pad" error={touched.odometer && !isMileage(draft.odometer) ? 'Enter a non-negative whole number of miles.' : undefined} />
          {error && <ThemedText style={styles.error} accessibilityLiveRegion="polite">{error}</ThemedText>}
          <ActionButton label={saving ? 'Saving...' : 'Save vehicle'} onPress={save} disabled={Boolean(validation) || saving} />
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}><ThemedText type="linkPrimary">Cancel</ThemedText></Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({ label, error, ...props }: Readonly<{ label: string; error?: string } & React.ComponentProps<typeof TextInput>>) {
  return (
    <View style={styles.field}>
      <ThemedText>{label}</ThemedText>
      <TextInput {...props} accessibilityLabel={label} accessibilityHint={error} style={styles.input} />
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
  screen: { flex: 1 }, safeArea: { flex: 1 }, content: { padding: Spacing.four, gap: Spacing.three },
  empty: { flex: 1, justifyContent: 'center', gap: Spacing.three, minHeight: 480 }, list: { gap: Spacing.three },
  vehicleCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one }, field: { gap: Spacing.one },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#8A8883', borderRadius: 10, paddingHorizontal: Spacing.two, fontSize: 17, color: '#1D1C19' },
  action: { minHeight: 48, borderRadius: 24, backgroundColor: '#29352E', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  actionText: { color: '#FFFFFF', fontWeight: '700' }, cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#A52A2A' }, disabled: { opacity: 0.45 },
});
