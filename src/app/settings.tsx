import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, IconTile, SectionLabel } from '@/components/torque-ui';
import { Spacing, TorqueColors } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <ThemedView collapsable={false} style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <ThemedText accessibilityRole="header" style={styles.title}>
          Settings
        </ThemedText>
        <SectionLabel>Local data &amp; privacy</SectionLabel>
        <Card>
          <View style={[styles.row, styles.rowDivider]}>
            <IconTile symbol="lock.fill" tone="success" />
            <View style={styles.rowText}>
              <ThemedText style={styles.rowTitle}>On this iPhone only</ThemedText>
              <ThemedText style={styles.rowSubtitle}>Your data stays on this device. There is no account, automatic sync, sharing, or app-level recovery.</ThemedText>
            </View>
          </View>
          <View style={styles.row}>
            <IconTile symbol="location.fill" tone="primary" />
            <View style={styles.rowText}>
              <ThemedText style={styles.rowTitle}>Location &amp; exports</ThemedText>
              <ThemedText style={styles.rowSubtitle}>Precise location is temporary while tracking. Exports and device backups you choose to keep are outside the app&apos;s deletion control.</ThemedText>
            </View>
          </View>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  content: { padding: Spacing.four, gap: Spacing.three },
  title: { color: TorqueColors.text, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.three, alignItems: 'flex-start' },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: TorqueColors.text, fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 },
});
