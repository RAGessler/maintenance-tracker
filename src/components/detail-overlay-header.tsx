import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
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
  return (
    <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
      <HeaderAction action={leading} back={leading.label === 'Back'} />
      {title ? (
        <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
      ) : (
        <View style={styles.title} />
      )}
      {trailing ? <HeaderAction action={trailing} /> : <View style={styles.trailingPlaceholder} />}
    </View>
  );
}

function HeaderAction({ action, back = false }: Readonly<{ action: DetailHeaderAction; back?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      hitSlop={8}
      onPress={action.onPress}
      style={({ pressed }) => [styles.action, (pressed || action.disabled) && styles.actionPressed]}
    >
      {back ? <SymbolView name="chevron.left" tintColor={TorqueColors.text} size={18} weight="semibold" /> : <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>}
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
  action: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.two + 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TorqueColors.card,
    borderColor: TorqueColors.divider,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { color: TorqueColors.primary, fontSize: 16, fontWeight: '600' },
  actionPressed: { opacity: 0.55 },
  title: { flex: 1, color: TorqueColors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  trailingPlaceholder: { width: 44, minHeight: 44 },
});
