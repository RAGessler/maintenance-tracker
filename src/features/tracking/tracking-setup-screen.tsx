import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailOverlayHeader, detailHeaderContentInset } from '@/components/detail-overlay-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, SectionLabel } from '@/components/torque-ui';
import { Spacing, TorqueColors } from '@/constants/theme';
import { maintenanceStore, type GarageVehicle, type SaveTrackingSetupInput, type SetupMutationResult, type SetupTransport, type TrackingSetup } from '../../../modules/maintenance-store';
import { setupChecklist, setupFailureCopy, setupStatusTitle } from './setup-checklist';

const transports: readonly Readonly<{ value: SetupTransport; title: string; detail: string }>[] = [
  { value: 'bluetooth', title: 'Bluetooth audio', detail: 'Automations select one exact Bluetooth device.' },
  { value: 'wireless_carplay', title: 'Wireless CarPlay', detail: 'Start uses the exact selected Bluetooth device; End uses CarPlay disconnect.' },
  { value: 'wired_carplay', title: 'Wired CarPlay', detail: 'One automatic wired vehicle on this iPhone. Other wired vehicles start manually.' },
];

export function TrackingSetupScreen({ vehicle, onBack }: Readonly<{ vehicle: GarageVehicle; onBack: () => void }>) {
  const insets = useSafeAreaInsets();
  const [setup, setSetup] = useState<TrackingSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sequence = useRef(0);
  const commandActive = useRef(false);
  const mounted = useRef(true);
  const scroll = useRef<ScrollView>(null);

  const refresh = useCallback(async () => {
    if (commandActive.current) return;
    const request = ++sequence.current;
    try {
      const next = await maintenanceStore.tracking.getSetup(vehicle.id);
      if (mounted.current && request === sequence.current) { setSetup(next); setError(null); }
    } catch (reason: unknown) {
      if (mounted.current && request === sequence.current) setError(reason instanceof Error && reason.message.startsWith('Rebuild') ? reason.message : 'Automatic tracking setup could not be loaded. Try again.');
    }
  }, [vehicle.id]);

  useEffect(() => {
    mounted.current = true;
    const startup = setTimeout(() => void refresh(), 0);
    const invalidate = () => { mounted.current = false; ++sequence.current; };
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { invalidate(); clearTimeout(startup); subscription.remove(); };
  }, [refresh]);
  const testing = setup?.testState === 'waiting_start' || setup?.testState === 'waiting_end';
  useEffect(() => {
    if (!testing) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 1500);
    return () => clearInterval(timer);
  }, [refresh, testing]);

  const mutate = async (operation: () => Promise<SetupMutationResult>, confirm?: (token: string) => void) => {
    if (commandActive.current) return;
    commandActive.current = true;
    ++sequence.current;
    setSaving(true);
    setError(null);
    try {
      const result = await operation();
      if (!mounted.current) return;
      setSetup(result.setup);
      if (result.failure) {
        setError(result.message ?? 'Setup could not be updated. Refresh and try again.');
        scroll.current?.scrollTo({ y: 0, animated: false });
        if (confirm && result.confirmationToken && result.conflictingVehicle) {
          const token = result.confirmationToken;
          Alert.alert('Reassign automatic tracking?', `Move this association from ${result.conflictingVehicle.nickname} to ${vehicle.nickname}? The old association becomes inactive. Repair the saved Shortcuts and run a new setup test before tracking can turn on.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reassign', style: 'destructive', onPress: () => confirm(token) },
          ]);
        }
      }
    } catch (reason: unknown) {
      if (mounted.current) { setError(reason instanceof Error && reason.message.startsWith('Rebuild') ? reason.message : 'Setup could not be updated. Refresh to check the saved state before trying again.'); scroll.current?.scrollTo({ y: 0, animated: false }); }
    } finally {
      commandActive.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const save = (input: SaveTrackingSetupInput) => {
    void mutate(() => maintenanceStore.tracking.saveSetup(input), (confirmationToken) => { save({ ...input, confirmationToken }); });
  };
  const attest = (field: 'shortcutsReady' | 'automationsReady' | 'checklistConfirmed', value: boolean) => {
    if (!setup?.transport) { setError('Choose the car’s connection type first.'); return; }
    save({ vehicleId: vehicle.id, setupId: setup.setupId, transport: setup.transport,
      shortcutsReady: setup.shortcutsReady, automationsReady: setup.automationsReady, checklistConfirmed: setup.checklistConfirmed, [field]: value });
  };
  const chooseTransport = (transport: SetupTransport) => {
    if (setup?.transport === transport) return;
    const change = () => save({ vehicleId: vehicle.id, setupId: setup?.setupId, transport, shortcutsReady: false, automationsReady: false, checklistConfirmed: false });
    if (setup?.transport) Alert.alert('Change connection type?', 'This clears the previous route and setup test. Confirm the new Shortcuts and automations before testing again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Change', onPress: change }]);
    else change();
  };
  const bind = (confirmationToken?: string) => {
    if (!setup?.setupId) { setError('Choose the car’s connection type first.'); return; }
    const setupId = setup.setupId;
    void mutate(() => maintenanceStore.tracking.bindRoute({ vehicleId: vehicle.id, setupId, confirmationToken }), bind);
  };
  const openShortcuts = async () => {
    try { await Linking.openURL('shortcuts://'); } catch { setError('Open Apple Shortcuts from the Home Screen to create or repair the saved actions.'); }
  };
  const showShortcuts = () => Alert.alert('Vehicle-bound Shortcuts', `Create normal Start Trip and End Trip Shortcuts using Maintenance Tracker’s actions. In both actions, select ${vehicle.nickname} as a fixed Vehicle, not Ask Each Time. After this app update, reselect Vehicle in older saved actions once to repair their identity. Keep that choice unchanged.`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Open Shortcuts', onPress: () => void openShortcuts() }, { text: 'I created both', onPress: () => attest('shortcutsReady', true) },
  ]);
  const showAutomations = () => {
    const instructions = setup?.transport === 'wired_carplay'
      ? `Create CarPlay Connects → ${vehicle.nickname} Start Trip and CarPlay Disconnects → ${vehicle.nickname} End Trip. CarPlay has no device selector; this must be your only automatic wired assignment.`
      : setup?.transport === 'wireless_carplay'
        ? `Select this car’s exact Bluetooth device for Connects → ${vehicle.nickname} Start Trip. Use CarPlay Disconnects → ${vehicle.nickname} End Trip. Do not end a wireless CarPlay trip on its initial Bluetooth disconnect.`
        : `Select this car’s exact Bluetooth device for Connects → ${vehicle.nickname} Start Trip and Disconnects → ${vehicle.nickname} End Trip. A display name alone is not the association.`;
    Alert.alert('Personal Automations', `${instructions} Set each automation to Run Immediately. The app cannot inspect or create your automations; confirm only after checking them in Shortcuts.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Open Shortcuts', onPress: () => void openShortcuts() }, { text: 'I checked both', onPress: () => attest('automationsReady', true) },
    ]);
  };
  const manageLocation = async () => {
    try {
      const status = await maintenanceStore.tracking.getLocationPermissionStatus();
      if (status === 'not_determined') await maintenanceStore.tracking.requestLocationPermission();
      else await Linking.openSettings();
      await refresh();
    } catch { setError('Open iOS Settings and allow Precise Location and Always access for Maintenance Tracker.'); }
  };
  const runTest = () => {
    if (!setup?.setupId) return;
    const setupId = setup.setupId;
    void mutate(() => maintenanceStore.tracking.armSetupTest(vehicle.id, setupId));
  };
  const cancelTest = () => {
    if (setup?.setupId) void mutate(() => maintenanceStore.tracking.cancelSetupTest(vehicle.id, setup.setupId!));
  };
  const remove = () => {
    if (!setup?.setupId) return;
    const setupId = setup.setupId;
    Alert.alert('Remove local binding?', 'This removes the app’s automatic setup and route association. Your Shortcuts and Personal Automations stay in Apple Shortcuts; remove or repair them there. Manual trips remain available.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void mutate(() => maintenanceStore.tracking.removeSetup(vehicle.id, setupId)) },
    ]);
  };

  const actions: Readonly<Record<string, () => void>> = { location: () => void manageLocation(), shortcuts: showShortcuts, automations: showAutomations, test: runTest, route: () => bind(), confirmation: () => attest('checklistConfirmed', !setup?.checklistConfirmed) };
  const details: Readonly<Record<string, string>> = {
    location: setup?.locationReady ? 'Granted. Precise points are temporary and deleted after a trip is finalized.' : 'Grant Precise Location and Always access. Tap to manage permission.',
    shortcuts: setup?.shortcutsReady ? 'You confirmed both Shortcuts carry this fixed vehicle.' : 'Create and confirm the Start Trip and End Trip Shortcuts.',
    automations: setup?.automationsReady ? 'You confirmed the correct triggers and Run Immediately.' : 'Check both automations in Apple Shortcuts, then confirm them here.',
    test: setup?.testReady ? 'Start and End delivered for the selected vehicle.' : testing ? 'Test running. Return after running the saved Shortcuts.' : 'Not passed yet. Run the test with your saved Shortcuts.',
    route: setup?.routeReady ? 'Observed and bound. Corroboration only, never a trigger.' : 'Connect to this car and play audio through its stereo. Tap to observe and bind.',
    confirmation: 'Required before automatic tracking turns on.',
  };
  const canTest = setup?.locationReady && setup.shortcutsReady && setup.automationsReady && setup.checklistConfirmed && setup.routeReady;

  return (
    <ThemedView collapsable={false} style={styles.screen}>
      <ScrollView ref={scroll} contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + detailHeaderContentInset }]}>
        {error ? <View><ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText><Action label="Refresh setup" onPress={() => void refresh()} disabled={saving} /></View> : null}
        {setup ? <>
          <View accessibilityLiveRegion="polite" style={[styles.banner, setup.state === 'ready' && styles.readyBanner]}>
            <ThemedText style={styles.bannerTitle}>{setupStatusTitle(setup)}</ThemedText>
            <ThemedText style={styles.detail}>{setup.state === 'ready' ? `Automatic setup is ready for ${vehicle.nickname}. A trip still needs movement, matching route corroboration, and a normal end.` : `Until every item is complete, automatic tracking stays off for ${vehicle.nickname}. Manual trips and odometer readings keep working.`}</ThemedText>
          </View>
          <SectionLabel>Connection type</SectionLabel>
          <Card>{transports.map((transport) => <Pressable key={transport.value} accessibilityRole="radio" accessibilityState={{ checked: setup.transport === transport.value, disabled: saving || testing }} disabled={saving || testing} onPress={() => chooseTransport(transport.value)} style={styles.row}>
            <SymbolView name={setup.transport === transport.value ? 'checkmark.circle.fill' : 'circle'} tintColor={TorqueColors.primary} size={22} />
            <View style={styles.rowText}><ThemedText style={styles.title}>{transport.title}</ThemedText><ThemedText style={styles.detail}>{transport.detail}</ThemedText></View>
          </Pressable>)}</Card>
          <SectionLabel>Readiness checklist · {vehicle.nickname}</SectionLabel>
          <Card>{setupChecklist(setup).map((item) => item.key === 'confirmation' ? <View key={item.key} style={styles.row}>
            <View style={styles.rowText}><ThemedText style={styles.title}>{item.title}</ThemedText><ThemedText style={styles.detail}>{details[item.key]}</ThemedText></View>
            <Switch accessibilityLabel="I confirmed the checklist" hitSlop={8} value={item.complete} disabled={saving || testing || !setup.transport} onValueChange={(value) => attest('checklistConfirmed', value)} />
          </View> : <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.title} disabled={saving || (testing && item.key !== 'location')} onPress={actions[item.key]} style={styles.row}>
            <SymbolView name={item.complete ? 'checkmark.circle.fill' : 'circle'} tintColor={item.complete ? TorqueColors.success : TorqueColors.secondary} size={22} />
            <View style={styles.rowText}><ThemedText style={styles.title}>{item.title}</ThemedText><ThemedText style={styles.detail}>{details[item.key]}</ThemedText></View>
          </Pressable>)}</Card>
          {testing ? <Card style={styles.testCard}>
            <ThemedText accessibilityLiveRegion="polite" style={styles.title}>{setup.testState === 'waiting_start' ? 'Waiting for Start Trip' : 'Start delivered — waiting for End Trip'}</ThemedText>
            <ThemedText style={styles.detail}>Keep this car connected. Open Shortcuts and run {vehicle.nickname}’s saved Start Trip, then End Trip. Return here to see the result. The test expires after 10 minutes and never creates a trip or changes mileage.</ThemedText>
            <Action label="Open Shortcuts" onPress={() => void openShortcuts()} disabled={saving} />
            <Action label="Cancel setup test" onPress={cancelTest} disabled={saving} />
          </Card> : <Action label={setup.testReady ? 'Run setup test again' : 'Run setup test'} onPress={runTest} disabled={saving || !canTest} />}
          {setup.testState === 'failed' ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{setupFailureCopy[setup.testFailure ?? ''] ?? 'The setup test failed. Repair the saved Shortcuts or connection and test again. No trip was created.'}</ThemedText> : null}
          {setup.testReady ? <Card style={styles.testCard}><ThemedText style={styles.title}>Test passed · no trip created</ThemedText><ThemedText style={styles.detail}>The saved Start and End actions delivered for this vehicle with matching route evidence. This does not guarantee future automation delivery.</ThemedText></Card> : null}
          <ThemedText style={styles.detail}>Start and End are triggered only by Shortcuts and Personal Automations you create. The app does not watch Bluetooth connections on its own. iOS decides background and locked delivery; exact timing, universal delivery, and force-quit operation are not promised.</ThemedText>
          {setup.transport && setup.transport !== 'bluetooth' ? <ThemedText style={styles.detail}>CarPlay uses a normalized local route heuristic for corroboration, not guaranteed hardware identity. Reconnect and restart stability must be checked in your vehicle.</ThemedText> : null}
          {setup.transport === 'bluetooth' ? <ThemedText style={styles.detail}>Before binding, verify the audio is playing through this car, not Bluetooth headphones or another speaker. The app observes an audio route; it cannot identify a car from its Bluetooth display name.</ThemedText> : null}
          {setup.setupId ? <Action label="Remove local binding only" onPress={remove} disabled={saving || testing} /> : null}
        </> : <ThemedText>Loading automatic tracking setup…</ThemedText>}
      </ScrollView>
      <DetailOverlayHeader title="Automatic tracking" leading={{ label: 'Back', disabled: saving, onPress: onBack }} />
    </ThemedView>
  );
}

function Action({ label, onPress, disabled }: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={[styles.action, disabled && styles.disabled]}><ThemedText style={styles.actionText}>{label}</ThemedText></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  content: { paddingHorizontal: Spacing.three, paddingBottom: 120, gap: Spacing.three },
  banner: { padding: Spacing.three, borderRadius: 16, backgroundColor: TorqueColors.warningSurface, borderWidth: 1, borderColor: TorqueColors.warning, gap: Spacing.one },
  readyBanner: { backgroundColor: TorqueColors.successSurface, borderColor: TorqueColors.success },
  bannerTitle: { color: TorqueColors.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider },
  rowText: { flex: 1, gap: 4 },
  title: { color: TorqueColors.text, fontSize: 16, fontWeight: '600' },
  detail: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 19 },
  error: { color: TorqueColors.error, fontSize: 14, lineHeight: 20 },
  testCard: { padding: Spacing.three, gap: Spacing.two },
  action: { minHeight: 48, borderRadius: 12, backgroundColor: TorqueColors.primary, padding: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
