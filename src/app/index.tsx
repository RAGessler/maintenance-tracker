import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTripDiagnostics } from '@/hooks/use-trip-diagnostics';
import { useTheme } from '@/hooks/use-theme';

export default function TripScreen() {
  const theme = useTheme();
  const {
    endTrip,
    configureCurrentRoute,
    error,
    isSupported,
    loading,
    requestPermissions,
    startTrip,
    status,
    tripSummaries,
  } = useTripDiagnostics();

  const isTracking = status && !['idle', 'completed', 'failed'].includes(status.state);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            IOS FEASIBILITY SPIKE
          </ThemedText>
          <ThemedText type="subtitle">Car-triggered mileage</ThemedText>
          <ThemedText themeColor="textSecondary">
            Shortcuts provides the trigger. Native location and route evidence determine the trip.
          </ThemedText>
        </View>

        {!isSupported && (
          <Card title="Development build required">
            <ThemedText themeColor="textSecondary">
              App Intents, audio routes, and locked-screen location are available only in the iOS
              development build.
            </ThemedText>
          </Card>
        )}

        <Card title="Current trip">
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isTracking ? '#20A464' : '#8B8D98' }]} />
            <ThemedText type="smallBold">{status?.state ?? 'loading'}</ThemedText>
          </View>
          <Detail label="Location" value={status?.locationAuthorization ?? 'checking'} />
          <Detail label="Trigger route" value={status?.selectedRouteName ?? 'not captured'} />
          <Detail label="Recognized vehicle" value={status?.selectedVehicleName ?? status?.currentVehicleName ?? 'unknown'} />
          <Detail label="Configured car" value={status?.configuredRouteName ?? 'not configured'} />
          <Detail label="Trip ID" value={status?.tripId ?? 'none'} code />
          {status?.graceDeadline && <Detail label="Grace deadline" value={status.graceDeadline} />}
        </Card>

        <Card title="Mileage">
          <Detail label="Current / latest trip" value={formatDistance(tripSummaries[0]?.distanceMeters)} />
          <Detail label="Accepted GPS fixes" value={String(tripSummaries[0]?.acceptedSamples ?? 0)} />
          <ThemedText type="small" themeColor="textSecondary">
            Estimated from accepted GPS fixes. Validate it against the odometer before relying on it.
          </ThemedText>
        </Card>

        <Card title="One-time setup">
          <SetupStep number="1" text="Grant Always Location while the app is open." />
          <SetupStep number="2" text="Connect the car stereo, then set the current route as the car." />
          <SetupStep number="3" text="Create CarPlay Connect → Start Trip (CarPlay)." />
          <SetupStep number="4" text="Create CarPlay Disconnect → End Trip." />
          <SetupStep number="5" text="Create Bluetooth Connect → Start Trip and Disconnect → End Trip." />
          <ThemedText type="small" themeColor="textSecondary">
            Set each automation to run immediately. Matching audio-route loss supplies reconnect
            grace if a Bluetooth disconnect automation is delayed or missed.
          </ThemedText>
        </Card>

        <View style={styles.actions}>
          <ActionButton
            title="Enable location"
            disabled={!isSupported || loading}
            onPress={requestPermissions}
          />
          <ActionButton
            title="Set current car route"
            disabled={!isSupported || loading}
            onPress={configureCurrentRoute}
          />
          <ActionButton
            title="Manual start"
            disabled={!isSupported || loading || Boolean(isTracking)}
            onPress={() => startTrip('manual')}
          />
          <ActionButton
            title="Manual stop"
            destructive
            disabled={!isSupported || loading || !isTracking}
            onPress={() => endTrip('manual')}
          />
        </View>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      </SafeAreaView>
    </ScrollView>
  );
}

function formatDistance(meters: number | undefined) {
  if (meters === undefined) return 'no trip yet';
  return `${(meters / 1_609.344).toFixed(2)} mi`;
}

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

function Detail({ code, label, value }: { code?: boolean; label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type={code ? 'code' : 'small'} numberOfLines={1} style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function SetupStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.setupStep}>
      <ThemedText type="smallBold" style={styles.stepNumber}>
        {number}
      </ThemedText>
      <ThemedText type="small" style={styles.stepText}>
        {text}
      </ThemedText>
    </View>
  );
}

function ActionButton({
  destructive,
  disabled,
  onPress,
  title,
}: {
  destructive?: boolean;
  disabled: boolean;
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.destructiveButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={styles.buttonText}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  header: { gap: Spacing.two, paddingVertical: Spacing.four },
  card: { borderRadius: 20, padding: Spacing.four, gap: Spacing.three },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  detailValue: { marginLeft: 'auto', maxWidth: '65%' },
  setupStep: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  stepNumber: { width: 24, height: 24, textAlign: 'center' },
  stepText: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: {
    backgroundColor: '#176B4D',
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  destructiveButton: { backgroundColor: '#A33A3A' },
  buttonText: { color: '#FFFFFF' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  error: { color: '#C43D3D' },
});
