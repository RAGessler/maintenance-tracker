import { type ReactNode } from 'react';
import { StyleSheet, View, type ColorValue, type TextStyle, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TorqueColors } from '@/constants/theme';

/**
 * Shared presentation primitives for the TorqueLog Alpha iOS layout: grouped
 * white cards, tinted icon tiles, severity dots, capsule meta pills, and
 * progress meters. Tones map to the design's fixed semantic palette so a
 * "danger" pill and a "danger" dot always read as the same severity.
 */
export type Tone = 'danger' | 'warning' | 'success' | 'trip' | 'neutral' | 'primary';

type ToneStyle = Readonly<{ fg: ColorValue; surface: ColorValue; dot: ColorValue }>;

const TONES: Record<Tone, ToneStyle> = {
  danger: { fg: TorqueColors.danger, surface: TorqueColors.dangerSurface, dot: TorqueColors.dangerDot },
  warning: { fg: TorqueColors.warning, surface: TorqueColors.warningSurface, dot: TorqueColors.warningDot },
  success: { fg: TorqueColors.success, surface: TorqueColors.successSurface, dot: TorqueColors.successDot },
  trip: { fg: TorqueColors.trip, surface: TorqueColors.tripSurface, dot: TorqueColors.trip },
  primary: { fg: TorqueColors.primary, surface: TorqueColors.primarySurface, dot: TorqueColors.primary },
  neutral: { fg: TorqueColors.secondary, surface: TorqueColors.neutralSurface, dot: TorqueColors.neutralDot },
};

export function toneOf(tone: Tone): ToneStyle {
  return TONES[tone];
}

/** Uppercase grouped-list section header, e.g. "Today" or "Checklist · GX 460". */
export function SectionLabel({ children, style }: Readonly<{ children: ReactNode; style?: TextStyle }>) {
  return (
    <ThemedText accessibilityRole="header" style={[styles.sectionLabel, style]}>
      {children}
    </ThemedText>
  );
}

/** White rounded grouped-list container. Rows inside supply their own dividers. */
export function Card({ children, style }: Readonly<{ children: ReactNode; style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Small colored status dot (8px) used to lead a due/maintenance row. */
export function SeverityDot({ tone }: Readonly<{ tone: Tone }>) {
  return <View style={[styles.dot, { backgroundColor: toneOf(tone).dot }]} />;
}

/** Capsule label such as "2 due" or "ESTIMATED". */
export function MetaPill({ label, tone, uppercase = false }: Readonly<{ label: string; tone: Tone; uppercase?: boolean }>) {
  const { fg, surface } = toneOf(tone);
  return (
    <View style={[styles.pill, { backgroundColor: surface }]}>
      <ThemedText style={[styles.pillText, { color: fg }, uppercase && styles.pillUppercase]}>{label}</ThemedText>
    </View>
  );
}

/** Rounded square tile holding a tinted SF Symbol, leading Activity/Quick Add rows. */
export function IconTile({ symbol, tone, size = 34 }: Readonly<{ symbol: SymbolViewProps['name']; tone: Tone; size?: number }>) {
  const { fg, surface } = toneOf(tone);
  return (
    <View style={[styles.iconTile, { width: size, height: size, backgroundColor: surface }]}>
      <SymbolView name={symbol} tintColor={fg} size={Math.round(size * 0.52)} />
    </View>
  );
}

/** Horizontal progress meter showing how much of a maintenance interval is used. */
export function ProgressBar({ fraction, tone }: Readonly<{ fraction: number; tone: Tone }>) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.trackFill, { width: `${clamped * 100}%`, backgroundColor: toneOf(tone).dot }]} />
    </View>
  );
}

/** Trailing disclosure chevron for tappable rows. */
export function Chevron() {
  return <SymbolView name="chevron.right" tintColor={TorqueColors.secondary} size={13} weight="semibold" />;
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: TorqueColors.secondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.one,
  },
  card: {
    backgroundColor: TorqueColors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pill: {
    borderRadius: 100,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  pillUppercase: { letterSpacing: 0.3, textTransform: 'uppercase' },
  iconTile: {
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: TorqueColors.track,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: 2 },
});
