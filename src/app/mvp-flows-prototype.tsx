// THROWAWAY PROTOTYPE for issue #63.
// Three application IA variants, switchable with ?variant=A|B|C. No persistence or real tracking.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrototypeSwitcher, type PrototypeVariant } from '@/components/prototype-switcher';

const C = {
  ink: '#28251f', muted: '#746e63', canvas: '#eeeae2', paper: '#fbf9f4', line: '#d8d1c5',
  dark: '#343128', clay: '#a65437', claySoft: '#f0d9cf', gold: '#c98b35', goldSoft: '#f5e5c9',
  green: '#42664d', greenSoft: '#dbe8dc', red: '#9b4038', redSoft: '#f1d7d2', white: '#ffffff',
};

type Focus = 'overview' | 'trips' | 'setup' | 'data';
type TrackingState = 'idle' | 'active' | 'recovery';
type CandidateState = 'pending' | 'confirmed' | 'rejected';
type VehicleId = 'gx' | 'miata';

const vehicles = {
  gx: { id: 'gx' as const, nickname: 'Atlas', model: '2019 Lexus GX 460', odometer: 84227, photo: true, tracking: 'Setup needs review' },
  miata: { id: 'miata' as const, nickname: 'Sunday', model: '2006 Mazda MX-5', odometer: 61480, photo: false, tracking: 'Manual only' },
};

const schedules = [
  { name: 'Engine oil & filter', state: 'DUE', detail: 'Due by 83,900 mi · now 327 mi over', tone: 'red' },
  { name: 'Tire rotation', state: 'DUE SOON', detail: 'Due at 84,700 mi · 473 mi remaining', tone: 'gold' },
  { name: 'Brake fluid', state: 'CURRENT', detail: 'Due Oct 2026 · 98 days remaining', tone: 'green' },
];

type PrototypeState = {
  focus: Focus;
  setFocus: (focus: Focus) => void;
  vehicle: VehicleId;
  setVehicle: (vehicle: VehicleId) => void;
  tracking: TrackingState;
  setTracking: (state: TrackingState) => void;
  candidate: CandidateState;
  setCandidate: (state: CandidateState) => void;
  reading: string;
  setReading: (reading: string) => void;
  odometer: number;
  reconcile: () => void;
  setupChecks: boolean[];
  toggleSetup: (index: number) => void;
  notice: string;
  setNotice: (notice: string) => void;
  compact: boolean;
};

function Button({ label, onPress, secondary, danger }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, danger && styles.buttonTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'red' | 'gold' | 'green' }) {
  const toneStyle = tone === 'red' ? styles.pillRed : tone === 'gold' ? styles.pillGold : tone === 'green' ? styles.pillGreen : styles.pillNeutral;
  return <View style={[styles.pill, toneStyle]}><Text style={styles.pillText}>{children}</Text></View>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <View style={styles.sectionTitle}><View style={{ flex: 1 }}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.h2}>{title}</Text></View>{action}</View>;
}

function VehicleArt({ photo, compact }: { photo: boolean; compact?: boolean }) {
  if (!photo) return <View style={[styles.vehicleArt, compact && styles.vehicleArtCompact, styles.noPhoto]}><Text style={styles.carGlyph}>◇</Text><Text style={styles.noPhotoText}>PHOTO OPTIONAL</Text></View>;
  return <View accessibilityLabel="Optional hero photo for Atlas" style={[styles.vehicleArt, compact && styles.vehicleArtCompact]}><View style={styles.sun} /><View style={styles.horizon} /><Text style={styles.carSilhouette}>▰</Text></View>;
}

function VehiclePicker({ state, vertical = false }: { state: PrototypeState; vertical?: boolean }) {
  return <View style={[styles.vehiclePicker, vertical && styles.vehiclePickerVertical]}>
    {(Object.keys(vehicles) as VehicleId[]).map((id) => {
      const item = vehicles[id]; const selected = state.vehicle === id;
      return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => state.setVehicle(id)} style={({ pressed }) => [styles.vehiclePick, vertical && styles.vehiclePickVertical, selected && styles.vehiclePickSelected, pressed && styles.pressed]}>
        <View style={[styles.vehicleDot, { backgroundColor: item.photo ? C.clay : C.dark }]} />
        <View style={{ flex: 1 }}><Text style={styles.vehiclePickName}>{item.nickname}</Text><Text numberOfLines={1} style={styles.caption}>{item.model}</Text></View>
        {selected ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>;
    })}
  </View>;
}

function ScheduleList({ condensed = false }: { condensed?: boolean }) {
  return <View style={styles.list}>{schedules.map((item) => <View key={item.name} style={styles.listRow}>
    <View style={[styles.statusDot, { backgroundColor: item.tone === 'red' ? C.red : item.tone === 'gold' ? C.gold : C.green }]} />
    <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.caption}>{item.detail}</Text>{!condensed && item.state === 'DUE SOON' ? <Text style={styles.explain}>Due soon = final 10% of mileage interval or final 30 days.</Text> : null}</View>
    <Pill tone={item.tone as 'red' | 'gold' | 'green'}>{item.state}</Pill>
  </View>)}</View>;
}

function TripsAndReconcile({ state }: { state: PrototypeState }) {
  return <View style={styles.stack}>
    <View style={styles.calloutWarn}><Text style={styles.eyebrow}>REVIEW REQUIRED</Text><Text style={styles.h3}>Couldn’t verify Atlas after disconnect</Text><Text style={styles.body}>Candidate captured 14.6 mi with good GPS, but route corroboration was missing. Nothing counts until you decide.</Text><View style={styles.inlineButtons}><Button label="Confirm 14.6 mi" onPress={() => { state.setCandidate('confirmed'); state.setNotice('Trip confirmed. Estimated odometer and due states recalculated.'); }} /><Button secondary label="Reassign / edit" onPress={() => state.setNotice('Review controls opened: vehicle and total distance are editable.')} /><Button danger label="Reject" onPress={() => state.setCandidate('rejected')} /></View><Text style={styles.stateLine}>Candidate disposition: {state.candidate}</Text></View>
    <View style={styles.card}><SectionTitle eyebrow="AUTHORITATIVE READING" title="Reconcile the dashboard" /><Text style={styles.body}>A new dated reading becomes the baseline. It does not rewrite historical trip estimates.</Text><View style={styles.readingRow}><TextInput accessibilityLabel="New odometer reading" keyboardType="numeric" value={state.reading} onChangeText={state.setReading} style={styles.input} /><Text style={styles.inputSuffix}>mi</Text><Button label="Save reading" onPress={state.reconcile} /></View><Text style={styles.caption}>Current estimate {state.odometer.toLocaleString()} mi · last manual reading 83,940 mi on Jul 2 · trips since +287 mi</Text></View>
    <View style={styles.card}><SectionTitle eyebrow="AUDITABLE HISTORY" title="Trips & maintenance" /><View style={styles.list}>
      <View style={styles.listRow}><Pill tone="green">CONFIRMED</Pill><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Home → Lakeview · 18.2 mi</Text><Text style={styles.caption}>Today, 9:15 AM · automatically confirmed · estimate retained</Text></View></View>
      <View style={styles.listRow}><Pill>MAINTENANCE</Pill><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Brake inspection completed</Text><Text style={styles.caption}>Jun 14 · 83,612 mi · linked schedule reset</Text></View></View>
      <View style={styles.listRow}><Pill>ODOMETER</Pill><View style={{ flex: 1 }}><Text style={styles.rowTitle}>83,940 mi confirmed</Text><Text style={styles.caption}>Jul 2 · estimate was 27 mi high · history unchanged</Text></View></View>
    </View></View>
  </View>;
}

function TrackingSetup({ state }: { state: PrototypeState }) {
  const labels = ['Precise Always Location granted', 'Vehicle-bound Shortcut installed', 'Run Immediately automations configured', 'In-app setup test passed'];
  const ready = state.setupChecks.every(Boolean);
  return <View style={styles.stack}>
    <View style={[styles.card, { borderColor: ready ? C.green : C.gold }]}><SectionTitle eyebrow="BEST-EFFORT AUTOMATION" title={ready ? 'Atlas is ready' : 'Finish automatic tracking setup'} action={<Pill tone={ready ? 'green' : 'gold'}>{ready ? 'READY' : `${state.setupChecks.filter(Boolean).length}/4`}</Pill>} /><Text style={styles.body}>A vehicle-bound Shortcut can start or end tracking when iOS delivers it. Force-quit, exact timing, and universal delivery are not guaranteed.</Text><View style={styles.checkList}>{labels.map((label, index) => <Pressable key={label} accessibilityRole="checkbox" accessibilityState={{ checked: state.setupChecks[index] }} onPress={() => state.toggleSetup(index)} style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}><View style={[styles.checkbox, state.setupChecks[index] && styles.checkboxOn]}><Text style={styles.checkboxText}>{state.setupChecks[index] ? '✓' : ''}</Text></View><Text style={styles.rowTitle}>{label}</Text></Pressable>)}</View></View>
    <View style={styles.calloutWarn}><Text style={styles.h3}>Attribution needs repair</Text><Text style={styles.body}>The saved Shortcut chose Atlas, but the observed route did not match. The start failed closed and no trip was created.</Text><View style={styles.inlineButtons}><Button label="Repair Shortcut" onPress={() => state.setNotice('Shortcut repair flow opened for Atlas.')} /><Button secondary label="Start manually" onPress={() => state.setTracking('active')} /></View></View>
    <View style={styles.card}><Text style={styles.eyebrow}>MULTI-VEHICLE LIMIT</Text><Text style={styles.h3}>One active trip on this iPhone</Text><Text style={styles.body}>Wired CarPlay supports one assigned automatic vehicle at a time. Use manual start for another wired vehicle or change the assignment.</Text></View>
  </View>;
}

function DataControls({ state }: { state: PrototypeState }) {
  return <View style={styles.stack}>
    <View style={styles.localBanner}><Text style={styles.darkEyebrow}>THIS BETA IS LOCAL-ONLY</Text><Text style={styles.darkTitle}>No account, sync, or app-level backup</Text><Text style={styles.darkBody}>Deleting the app, losing this iPhone, or replacing it can permanently lose profiles, photos, trips, maintenance, and diagnostics. Future migration is not promised.</Text></View>
    <View style={styles.card}><SectionTitle eyebrow="YOUR COPY" title="Export local data" /><Text style={styles.body}>Creates a sensitive archive of durable records, photos, configured identifiers, and retained diagnostics. Temporary precise location points are excluded.</Text><Button label="Prepare complete export" onPress={() => state.setNotice('Prototype: sensitive export prepared; user would choose Files or share sheet.')} /></View>
    <View style={[styles.card, { borderColor: C.red }]}><SectionTitle eyebrow="DESTRUCTIVE" title="Delete all data" /><Text style={styles.body}>Stops tracking and removes every app-owned record, photo, trigger binding, diagnostic, and temporary location state from this installation.</Text><Button danger label="Delete all data…" onPress={() => state.setNotice('Prototype confirmation: deletion is irreversible and returns to first run.')} /></View>
  </View>;
}

function ActiveTracking({ state, prominent = false }: { state: PrototypeState; prominent?: boolean }) {
  if (state.tracking === 'idle') return <View style={styles.trackIdle}><View><Text style={styles.eyebrow}>NO ACTIVE TRIP</Text><Text style={styles.caption}>Manual tracking is always available.</Text></View><Button label="Start manual trip" onPress={() => state.setTracking('active')} /></View>;
  return <View style={[styles.trackingBar, prominent && styles.trackingProminent, state.tracking === 'recovery' && styles.recoveryBar]}><View style={styles.pulse} /><View style={{ flex: 1 }}><Text style={styles.eyebrow}>{state.tracking === 'active' ? 'MANUAL TRIP ACTIVE · ATLAS' : 'CONNECTION LOST · RECOVERY'}</Text><Text style={styles.h3}>{state.tracking === 'active' ? '12.4 mi · 42 min · good signal' : 'Waiting up to 3 minutes for the matching route'}</Text><Text style={styles.caption}>{state.tracking === 'active' ? 'Temporary precise points delete after completion.' : 'If recovery fails, this becomes a candidate for review.'}</Text></View><View style={styles.inlineButtons}><Button secondary label={state.tracking === 'active' ? 'Simulate loss' : 'Reconnect'} onPress={() => state.setTracking(state.tracking === 'active' ? 'recovery' : 'active')} /><Button label="Stop" onPress={() => { state.setTracking('idle'); state.setCandidate('confirmed'); state.setNotice('Manual trip stopped and confirmed with usable distance.'); }} /></View></View>;
}

function FocusContent({ state }: { state: PrototypeState }) {
  if (state.focus === 'trips') return <TripsAndReconcile state={state} />;
  if (state.focus === 'setup') return <TrackingSetup state={state} />;
  if (state.focus === 'data') return <DataControls state={state} />;
  return <View style={styles.stack}><ActiveTracking state={state} /><View style={styles.card}><SectionTitle eyebrow="CURRENT ODOMETER" title={`${state.odometer.toLocaleString()} mi`} action={<Button secondary label="Add reading" onPress={() => state.setFocus('trips')} />} /><Text style={styles.caption}>Estimated from the Jul 2 manual baseline plus confirmed trips since.</Text></View><View style={styles.card}><SectionTitle eyebrow="MAINTENANCE" title="What needs attention" /><ScheduleList /></View><View style={styles.card}><SectionTitle eyebrow="RECENT COMPLETIONS" title="History stays intact" /><Text style={styles.rowTitle}>Brake inspection · Jun 14 · 83,612 mi</Text><Text style={styles.caption}>Linked to annual inspection schedule · optional note, no attachment</Text></View></View>;
}

function VariantA({ state }: { state: PrototypeState }) {
  const vehicle = vehicles[state.vehicle];
  const nav: { key: Focus; label: string }[] = [{ key: 'overview', label: 'Overview' }, { key: 'trips', label: 'Trips & mileage' }, { key: 'setup', label: 'Tracking setup' }, { key: 'data', label: 'Data & privacy' }];
  return <View style={styles.variant}><View style={[styles.aShell, state.compact && { flexDirection: 'column' }]}>
    <View style={[styles.aRail, state.compact && styles.aRailMobile]}><Text style={styles.wordmark}>MILEMARK</Text><Text style={styles.railTitle}>Garage</Text><VehiclePicker state={state} vertical={!state.compact} /><Button secondary label="＋ Add vehicle" onPress={() => state.setNotice('Vehicle profile requires nickname, year, make, model, and current odometer. Hero photo is optional.')} /><View style={styles.railDisclosure}><Text style={styles.caption}>Stored only on this iPhone</Text></View></View>
    <ScrollView style={styles.aMain} contentContainerStyle={styles.pagePad}><View style={[styles.hero, state.compact && { flexDirection: 'column' }]}><VehicleArt photo={vehicle.photo} /><View style={styles.heroCopy}><Text style={styles.eyebrow}>{vehicle.nickname.toUpperCase()} · VEHICLE WORKSPACE</Text><Text style={styles.h1}>{vehicle.model}</Text><Text style={styles.body}>{vehicle.tracking} · {state.odometer.toLocaleString()} mi</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subnav}>{nav.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: state.focus === item.key }} onPress={() => state.setFocus(item.key)} style={[styles.subnavItem, state.focus === item.key && styles.subnavItemOn]}><Text style={[styles.subnavText, state.focus === item.key && styles.subnavTextOn]}>{item.label}</Text></Pressable>)}</ScrollView>
      <FocusContent state={state} />
    </ScrollView>
  </View></View>;
}

function VariantB({ state }: { state: PrototypeState }) {
  const nav: { key: Focus; label: string; count?: number }[] = [{ key: 'overview', label: 'Command center', count: 3 }, { key: 'trips', label: 'Review queue', count: 1 }, { key: 'setup', label: 'Tracking health', count: 1 }, { key: 'data', label: 'Settings' }];
  return <View style={[styles.variant, { backgroundColor: '#e7e1d7' }]}><View style={[styles.bTop, state.compact && { paddingHorizontal: 16 }]}><Text style={styles.wordmarkLight}>MILEMARK / BETA</Text><View style={styles.bVehicleQuick}><View style={styles.vehicleDot} /><Text style={styles.bTopText}>Atlas · {state.odometer.toLocaleString()} mi</Text></View></View><View style={[styles.bShell, state.compact && { flexDirection: 'column' }]}>
    <View style={[styles.bNav, state.compact && styles.bNavMobile]}>{nav.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: state.focus === item.key }} onPress={() => state.setFocus(item.key)} style={[styles.bNavItem, state.focus === item.key && styles.bNavItemOn]}><Text style={[styles.bNavText, state.focus === item.key && styles.bNavTextOn]}>{item.label}</Text>{item.count ? <View style={styles.count}><Text style={styles.countText}>{item.count}</Text></View> : null}</Pressable>)}</View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.bContent}><View style={styles.bHeading}><View><Text style={styles.eyebrow}>FRIDAY · PRIVATE BETA</Text><Text style={styles.h1}>{state.focus === 'overview' ? 'Three things need you' : nav.find((item) => item.key === state.focus)?.label}</Text></View><Button label="Start manual trip" onPress={() => state.setTracking('active')} /></View>
      {state.focus === 'overview' ? <><ActiveTracking state={state} prominent /><View style={[styles.bColumns, state.compact && { flexDirection: 'column' }]}><View style={{ flex: 1.6, gap: 16 }}><View style={styles.queueCard}><Pill tone="red">DO NOW</Pill><Text style={styles.h2}>Review a 14.6 mi candidate</Text><Text style={styles.body}>Route mismatch prevented automatic confirmation. Decide before it affects mileage.</Text><Button label="Review trip" onPress={() => state.setFocus('trips')} /></View><View style={styles.card}><SectionTitle eyebrow="ALL VEHICLES" title="Maintenance pressure" /><ScheduleList condensed /></View></View><View style={{ flex: 1, gap: 16 }}><View style={styles.card}><SectionTitle eyebrow="GARAGE" title="2 vehicles" /><VehiclePicker state={state} vertical /><Text style={styles.caption}>Atlas has a hero photo · Sunday uses a neutral placeholder.</Text></View><View style={styles.card}><SectionTitle eyebrow="LAST COMPLETED" title="Brake inspection" /><Text style={styles.body}>Jun 14 · 83,612 mi</Text><Text style={styles.caption}>Linked schedule reset; older completions remain history.</Text></View></View></View></> : <FocusContent state={state} />}
    </ScrollView>
  </View></View>;
}

function TaskCard({ number, title, detail, active, onPress }: { number: string; title: string; detail: string; active?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.taskCard, active && styles.taskCardOn, pressed && styles.pressed]}><Text style={styles.taskNumber}>{number}</Text><View style={{ flex: 1 }}><Text style={styles.h3}>{title}</Text><Text style={styles.caption}>{detail}</Text></View><Text style={styles.taskArrow}>→</Text></Pressable>;
}

function VariantC({ state }: { state: PrototypeState }) {
  const taskTitle = state.focus === 'trips' ? 'Review & reconcile' : state.focus === 'setup' ? 'Make tracking ready' : state.focus === 'data' ? 'Protect your local history' : 'Know what to do next';
  return <View style={[styles.variant, { backgroundColor: '#f4f0e8' }]}><ScrollView contentContainerStyle={styles.cPage}>
    <View style={styles.cHeader}><Text style={styles.wordmark}>MILEMARK</Text><View style={styles.cNav}><Pressable onPress={() => state.setFocus('overview')}><Text style={styles.cNavText}>Today</Text></Pressable><Pressable onPress={() => state.setFocus('trips')}><Text style={styles.cNavText}>Drive</Text></Pressable><Pressable onPress={() => state.setFocus('overview')}><Text style={styles.cNavText}>Care</Text></Pressable><Pressable onPress={() => state.setFocus('data')}><Text style={styles.cNavText}>Data</Text></Pressable></View><VehiclePicker state={state} /></View>
    <View style={[styles.cIntro, state.compact && { flexDirection: 'column' }]}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>ATLAS · GUIDED HUB</Text><Text style={styles.cDisplay}>{taskTitle}</Text><Text style={styles.body}>Move from vehicle readiness to a trustworthy odometer, then to maintenance—without pretending automation is guaranteed.</Text></View><VehicleArt photo={vehicles[state.vehicle].photo} compact /></View>
    <ActiveTracking state={state} prominent />
    <View style={[styles.cJourney, state.compact && { flexDirection: 'column' }]}><View style={styles.cSteps}><Text style={styles.eyebrow}>YOUR CURRENT JOURNEY</Text><TaskCard number="01" title="Set up the vehicle" detail="Shortcut, permission, route test" active={state.focus === 'setup'} onPress={() => state.setFocus('setup')} /><TaskCard number="02" title="Capture & review drives" detail="1 candidate needs a decision" active={state.focus === 'trips'} onPress={() => state.setFocus('trips')} /><TaskCard number="03" title="Trust the odometer" detail={`${state.odometer.toLocaleString()} mi · append-only readings`} active={state.focus === 'trips'} onPress={() => state.setFocus('trips')} /><TaskCard number="04" title="Care at the right time" detail="1 due · 1 due soon · 1 current" active={state.focus === 'overview'} onPress={() => state.setFocus('overview')} /><TaskCard number="05" title="Keep your own copy" detail="Local-only · export or delete" active={state.focus === 'data'} onPress={() => state.setFocus('data')} /></View><View style={styles.cWork}><FocusContent state={state} /></View></View>
    <View style={styles.cFooter}><Text style={styles.caption}>Private beta · no account · no sync · loss may be unrecoverable</Text><Button secondary label="Review privacy disclosure" onPress={() => state.setFocus('data')} /></View>
  </ScrollView></View>;
}

export default function MvpFlowsPrototype() {
  const params = useLocalSearchParams<{ variant?: string | string[] }>();
  const raw = Array.isArray(params.variant) ? params.variant[0] : params.variant;
  const variant: PrototypeVariant = raw === 'B' || raw === 'C' ? raw : 'A';
  const { width } = useWindowDimensions();
  const [focus, setFocus] = useState<Focus>('overview');
  const [vehicle, setVehicle] = useState<VehicleId>('gx');
  const [tracking, setTracking] = useState<TrackingState>('idle');
  const [candidate, setCandidate] = useState<CandidateState>('pending');
  const [odometer, setOdometer] = useState(84227);
  const [reading, setReading] = useState('84241');
  const [setupChecks, setSetupChecks] = useState([true, true, false, false]);
  const [notice, setNotice] = useState('Fixture state is in memory only. Try the focused controls.');
  const state: PrototypeState = { focus, setFocus, vehicle, setVehicle: (nextVehicle) => { setVehicle(nextVehicle); setOdometer(vehicles[nextVehicle].odometer); setReading(String(vehicles[nextVehicle].odometer)); }, tracking, setTracking, candidate, setCandidate, reading, setReading, odometer, reconcile: () => { const next = Number(reading.replace(/,/g, '')); if (Number.isFinite(next)) { setOdometer(next); setNotice(`${next.toLocaleString()} mi saved as a new authoritative reading; trip history was not rewritten.`); } }, setupChecks, toggleSetup: (index) => setSetupChecks((current) => current.map((item, itemIndex) => itemIndex === index ? !item : item)), notice, setNotice, compact: width < 760 };
  return <SafeAreaView style={styles.root}><View style={styles.prototypeNote}><Text style={styles.prototypeNoteText}>THROWAWAY HITL PROTOTYPE · State: {notice}</Text></View>{variant === 'A' ? <VariantA state={state} /> : variant === 'B' ? <VariantB state={state} /> : <VariantC state={state} />}<PrototypeSwitcher current={variant} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas }, variant: { flex: 1, paddingBottom: 78 }, pressed: { opacity: 0.68 },
  prototypeNote: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#181714' }, prototypeNoteText: { color: '#dfd9ce', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  wordmark: { color: C.ink, fontSize: 13, fontWeight: '900', letterSpacing: 2.2 }, wordmarkLight: { color: C.white, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  h1: { color: C.ink, fontSize: 34, lineHeight: 39, fontWeight: '700', letterSpacing: -0.8 }, h2: { color: C.ink, fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -0.3 }, h3: { color: C.ink, fontSize: 17, lineHeight: 22, fontWeight: '700' }, body: { color: C.muted, fontSize: 15, lineHeight: 22 }, caption: { color: C.muted, fontSize: 12, lineHeight: 17 }, eyebrow: { color: C.muted, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1.2 }, darkEyebrow: { color: '#d9d2c5', fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1.2 }, darkTitle: { color: C.white, fontSize: 17, lineHeight: 22, fontWeight: '700', marginTop: 3 }, darkBody: { color: '#e2ddd3', fontSize: 15, lineHeight: 22, marginTop: 6 },
  button: { minHeight: 44, paddingHorizontal: 17, borderRadius: 22, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }, buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line }, buttonDanger: { backgroundColor: C.redSoft, borderWidth: 1, borderColor: '#dfaaa2' }, buttonText: { color: C.white, fontSize: 13, fontWeight: '700' }, buttonTextSecondary: { color: C.ink }, buttonTextDanger: { color: C.red },
  pill: { minHeight: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }, pillNeutral: { backgroundColor: '#e5e0d7' }, pillRed: { backgroundColor: C.redSoft }, pillGold: { backgroundColor: C.goldSoft }, pillGreen: { backgroundColor: C.greenSoft }, pillText: { color: C.ink, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }, stack: { gap: 16 }, card: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 18 }, list: { borderTopWidth: 1, borderTopColor: C.line }, listRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }, rowTitle: { color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' }, explain: { color: C.gold, fontSize: 11, lineHeight: 16, marginTop: 4 }, statusDot: { width: 8, height: 8, borderRadius: 4 },
  inlineButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, stateLine: { color: C.muted, marginTop: 12, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }, calloutWarn: { backgroundColor: C.goldSoft, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#dfbd84' }, localBanner: { backgroundColor: C.dark, borderRadius: 18, padding: 20 },
  readingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginVertical: 14 }, input: { minWidth: 160, minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: C.white, color: C.ink, paddingHorizontal: 13, fontSize: 20, fontWeight: '700' }, inputSuffix: { color: C.muted, marginRight: 8 },
  checkList: { marginTop: 16, gap: 6 }, checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 5 }, checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white }, checkboxOn: { backgroundColor: C.green, borderColor: C.green }, checkboxText: { color: C.white, fontWeight: '900' },
  trackIdle: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }, trackingBar: { borderRadius: 16, backgroundColor: C.greenSoft, borderWidth: 1, borderColor: '#a9c3ad', padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, trackingProminent: { padding: 20 }, recoveryBar: { backgroundColor: C.goldSoft, borderColor: '#dfbd84' }, pulse: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.green },
  vehicleArt: { minWidth: 270, height: 156, borderRadius: 16, overflow: 'hidden', backgroundColor: '#bf7658', position: 'relative' }, vehicleArtCompact: { minWidth: 230, width: 260, height: 132 }, noPhoto: { backgroundColor: '#d9d2c5', alignItems: 'center', justifyContent: 'center' }, noPhotoText: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 }, carGlyph: { color: C.muted, fontSize: 45 }, sun: { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: '#efc47c', top: 20, right: 34 }, horizon: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 62, backgroundColor: '#554f40' }, carSilhouette: { position: 'absolute', bottom: 34, left: 90, color: '#211f1a', fontSize: 64 },
  vehiclePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, vehiclePickerVertical: { flexDirection: 'column' }, vehiclePick: { minHeight: 52, minWidth: 155, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, borderRadius: 12, borderWidth: 1, borderColor: C.line }, vehiclePickVertical: { width: '100%' }, vehiclePickSelected: { backgroundColor: C.claySoft, borderColor: '#d3a08d' }, vehicleDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.clay }, vehiclePickName: { color: C.ink, fontSize: 13, fontWeight: '800' }, check: { color: C.clay, fontWeight: '900' },
  aShell: { flex: 1, flexDirection: 'row' }, aRail: { width: 264, padding: 24, gap: 20, backgroundColor: '#e2ddd3', borderRightWidth: 1, borderRightColor: C.line }, aRailMobile: { width: '100%', padding: 14, gap: 12, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: C.line }, railTitle: { color: C.ink, fontSize: 28, fontWeight: '700' }, railDisclosure: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 }, aMain: { flex: 1 }, pagePad: { padding: 26, paddingBottom: 100, maxWidth: 1050, width: '100%', alignSelf: 'center' }, hero: { flexDirection: 'row', alignItems: 'center', gap: 24 }, heroCopy: { flex: 1, gap: 7 }, subnav: { gap: 8, marginVertical: 22, borderBottomWidth: 1, borderBottomColor: C.line }, subnavItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, subnavItemOn: { borderBottomWidth: 3, borderBottomColor: C.clay }, subnavText: { color: C.muted, fontSize: 13, fontWeight: '700' }, subnavTextOn: { color: C.ink },
  bTop: { minHeight: 62, backgroundColor: C.dark, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, bVehicleQuick: { flexDirection: 'row', alignItems: 'center', gap: 8 }, bTopText: { color: C.white, fontSize: 13, fontWeight: '700' }, bShell: { flex: 1, flexDirection: 'row' }, bNav: { width: 230, backgroundColor: C.paper, borderRightWidth: 1, borderRightColor: C.line, padding: 16, gap: 8 }, bNavMobile: { width: '100%', flexDirection: 'row', overflow: 'hidden', padding: 8 }, bNavItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, borderRadius: 10 }, bNavItemOn: { backgroundColor: C.dark }, bNavText: { flex: 1, color: C.muted, fontSize: 13, fontWeight: '700' }, bNavTextOn: { color: C.white }, count: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: C.clay, alignItems: 'center', justifyContent: 'center' }, countText: { color: C.white, fontSize: 10, fontWeight: '800' }, bContent: { padding: 26, paddingBottom: 100, maxWidth: 1120, width: '100%', alignSelf: 'center' }, bHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }, bColumns: { flexDirection: 'row', gap: 16, marginTop: 16 }, queueCard: { backgroundColor: C.claySoft, borderRadius: 18, padding: 20, gap: 10 },
  cPage: { padding: 26, paddingBottom: 110, maxWidth: 1180, width: '100%', alignSelf: 'center' }, cHeader: { minHeight: 66, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 24, borderBottomWidth: 1, borderBottomColor: C.line }, cNav: { flexDirection: 'row', flex: 1, gap: 20 }, cNavText: { minHeight: 44, textAlignVertical: 'center', color: C.ink, fontSize: 13, fontWeight: '700' }, cIntro: { flexDirection: 'row', alignItems: 'center', gap: 30, paddingVertical: 36 }, cDisplay: { color: C.ink, fontSize: 46, lineHeight: 50, fontWeight: '700', letterSpacing: -1.4, marginVertical: 10 }, cJourney: { flexDirection: 'row', gap: 24, marginTop: 24 }, cSteps: { flex: 0.8, gap: 9 }, cWork: { flex: 1.4 }, taskCard: { minHeight: 74, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.paper }, taskCardOn: { backgroundColor: C.goldSoft, borderColor: '#d9b779' }, taskNumber: { color: C.clay, fontSize: 11, fontWeight: '900' }, taskArrow: { color: C.muted, fontSize: 18 }, cFooter: { minHeight: 80, marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
});
