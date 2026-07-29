import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TorqueColors } from '@/constants/theme';

export function PrimaryTabHeader({ title }: Readonly<{ title: string }>) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription.remove();
  }, []);
  const canvasRgb = colorScheme === 'dark' ? '0, 0, 0' : '242, 242, 247';
  const headerFade = `linear-gradient(to bottom, rgba(${canvasRgb}, 1) 0%, rgba(${canvasRgb}, 0.85) 14%, rgba(${canvasRgb}, 0.35) 55%, rgba(${canvasRgb}, 0) 100%)`;
  return (
    <View pointerEvents="none" style={[styles.header, { height: insets.top + styles.bar.height + Spacing.three, paddingTop: insets.top }]}>
      {reduceTransparency ? <View style={styles.fallback} /> : <View style={[styles.fade, { experimental_backgroundImage: headerFade }]} />}
      <ThemedText accessibilityRole="header" maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.title}>
        {title}
      </ThemedText>
    </View>
  );
}

export function usePrimaryTabHeaderContentInset() {
  const insets = useSafeAreaInsets();
  return insets.top + styles.bar.height;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, elevation: 10 },
  bar: { height: 44 },
  fallback: { ...StyleSheet.absoluteFill, backgroundColor: TorqueColors.canvas },
  fade: { ...StyleSheet.absoluteFill },
  title: { height: 44, color: TorqueColors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', textAlignVertical: 'center' },
});
