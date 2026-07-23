import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTripDiagnostics } from '@/hooks/use-trip-diagnostics';
import { useTheme } from '@/hooks/use-theme';
import { exportEvidence } from '@/utils/export-evidence';

export default function DiagnosticsScreen() {
  const theme = useTheme();
  const { deleteAllData, events, isSupported, refresh, status, tripSummaries } = useTripDiagnostics();

  function confirmExport() {
    Alert.alert(
      'Export sensitive diagnostics?',
      'The JSON may include vehicle route names, trip identifiers, and location timing.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => void exportEvidence() },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert('Delete all spike data?', 'This permanently removes trips, samples, and diagnostics.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteAllData },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <SafeAreaView style={styles.container}>
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <ThemedText type="subtitle">Diagnostics</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Persistent native events, newest first
            </ThemedText>
          </View>
          <View style={styles.headingActions}>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.refreshButton}>
              <ThemedText type="smallBold" style={styles.refreshText}>
                Refresh
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!isSupported}
              onPress={confirmExport}
              style={styles.exportButton}>
              <ThemedText type="smallBold">Export</ThemedText>
            </Pressable>
          </View>
        </View>

        <ThemedView type="backgroundElement" style={styles.routeCard}>
          <ThemedText type="smallBold">Current audio outputs</ThemedText>
          {status?.currentRoute.length ? (
            status.currentRoute.map((port) => (
              <View key={port.uid}>
                <ThemedText type="small">{port.name}</ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {port.type}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No native route data
            </ThemedText>
          )}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.routeCard}>
          <ThemedText type="smallBold">Trip summaries</ThemedText>
          {tripSummaries.length ? (
            tripSummaries.map((trip) => (
              <View key={trip.id} style={styles.trip}>
                <ThemedText type="smallBold">{trip.vehicleName ?? 'Unknown vehicle'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {(trip.distanceMeters / 1_609.344).toFixed(2)} mi · {trip.acceptedSamples} accepted fixes
                </ThemedText>
                <ThemedText type="code" themeColor="textSecondary">{trip.startedAt}</ThemedText>
              </View>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary">No recorded trips</ThemedText>
          )}
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          disabled={!isSupported}
          onPress={confirmDelete}
          style={styles.deleteButton}>
          <ThemedText type="smallBold" style={styles.deleteText}>
            Delete all spike data
          </ThemedText>
        </Pressable>

        <View style={styles.events}>
          {events.map((event) => (
            <ThemedView key={event.eventId} type="backgroundElement" style={styles.event}>
              <View style={styles.eventHeader}>
                <ThemedText type="smallBold">{event.name}</ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {event.source}
                </ThemedText>
              </View>
              <ThemedText type="code" themeColor="textSecondary">
                {event.timestamp}
              </ThemedText>
              <ThemedText type="code" numberOfLines={4}>
                {event.payload}
              </ThemedText>
            </ThemedView>
          ))}
        </View>
      </SafeAreaView>
    </ScrollView>
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
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  headingText: { flex: 1, gap: Spacing.one },
  headingActions: { gap: Spacing.two },
  refreshButton: { backgroundColor: '#176B4D', borderRadius: 12, padding: 12 },
  refreshText: { color: '#FFFFFF' },
  exportButton: { borderWidth: 1, borderColor: '#8B8D98', borderRadius: 12, padding: 12 },
  deleteButton: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  deleteText: { color: '#C43D3D' },
  routeCard: { padding: Spacing.four, borderRadius: 20, gap: Spacing.two },
  trip: { gap: Spacing.one, paddingVertical: Spacing.one },
  events: { gap: Spacing.two },
  event: { borderRadius: 14, padding: Spacing.three, gap: Spacing.one },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
});
