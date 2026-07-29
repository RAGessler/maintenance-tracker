import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TorqueColors } from '@/constants/theme';

export function PrimaryTabHeader({ title }: Readonly<{ title: string }>) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.header, { height: insets.top + styles.bar.height, paddingTop: insets.top }]}> 
      <View style={styles.fallback} />
      <ThemedText accessibilityRole="header" maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
    </View>
  );
}

export function usePrimaryTabHeaderContentInset() {
  const insets = useSafeAreaInsets();
  return insets.top + styles.bar.height - Spacing.two;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, elevation: 10 },
  bar: { height: 44 },
  fallback: { ...StyleSheet.absoluteFill, backgroundColor: TorqueColors.canvas },
  title: { height: 44, color: TorqueColors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', textAlignVertical: 'center' },
});
