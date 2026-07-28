import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TorqueColors } from '@/constants/theme';

export type DetailHeaderAction = Readonly<{
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress: () => void;
}>;

export function DetailOverlayHeader({
  title,
  leading,
  trailing,
}: Readonly<{
  title?: string;
  leading: DetailHeaderAction;
  trailing?: DetailHeaderAction;
}>) {
  const insets = useSafeAreaInsets();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription.remove();
  }, []);
  const useGlass = !reduceTransparency && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  return (
    <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
      <HeaderAction action={leading} back={leading.label === 'Back'} useGlass={useGlass} />
      {title ? (
        <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
      ) : (
        <View style={styles.title} />
      )}
      {trailing ? <HeaderAction action={trailing} useGlass={useGlass} /> : <View style={styles.trailingPlaceholder} />}
    </View>
  );
}

function HeaderAction({ action, back = false, useGlass }: Readonly<{ action: DetailHeaderAction; back?: boolean; useGlass: boolean }>) {
  const content = back ? <SymbolView name="chevron.left" tintColor={TorqueColors.text} size={18} weight="semibold" /> : <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      hitSlop={8}
      onPress={action.onPress}
      style={({ pressed }) => [styles.action, !useGlass && styles.fallbackAction, (pressed || action.disabled) && styles.actionPressed]}
    >
      {useGlass ? <GlassView isInteractive style={styles.glass}>{content}</GlassView> : content}
    </Pressable>
  );
}

export const detailHeaderContentInset = Spacing.six + Spacing.three;

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    top: 0,
    left: 0,
    right: 0,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  glass: { minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two + 4 },
  fallbackAction: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two + 4, backgroundColor: TorqueColors.card, borderColor: TorqueColors.divider, borderWidth: StyleSheet.hairlineWidth },
  actionLabel: { color: TorqueColors.primary, fontSize: 16, fontWeight: '600' },
  actionPressed: { opacity: 0.55 },
  title: { flex: 1, color: TorqueColors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  trailingPlaceholder: { width: 44, minHeight: 44 },
});
