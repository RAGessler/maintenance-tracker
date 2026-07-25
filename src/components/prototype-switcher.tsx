import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export type PrototypeVariant = 'A' | 'B' | 'C';

const variants: PrototypeVariant[] = ['A', 'B', 'C'];
const names: Record<PrototypeVariant, string> = {
  A: 'Vehicle workspace',
  B: 'Command center',
  C: 'Journey hub',
};

type Props = {
  current: PrototypeVariant;
};

// THROWAWAY: shared development-only control for comparing the three IA directions.
export function PrototypeSwitcher({ current }: Props) {
  const router = useRouter();
  const cycle = useCallback(
    (direction: -1 | 1) => {
      const currentIndex = variants.indexOf(current);
      const next = variants[(currentIndex + direction + variants.length) % variants.length];
      router.setParams({ variant: next });
    },
    [current, router],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (event.key === 'ArrowLeft') cycle(-1);
      if (event.key === 'ArrowRight') cycle(1);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycle]);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <View accessibilityLabel="Prototype variant switcher" style={styles.shell}>
      <Pressable
        accessibilityLabel="Previous prototype variant"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => cycle(-1)}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>←</Text>
      </Pressable>
      <View style={styles.label}>
        <Text style={styles.kicker}>PROTOTYPE</Text>
        <Text style={styles.name}>{current} · {names[current]}</Text>
      </View>
      <Pressable
        accessibilityLabel="Next prototype variant"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => cycle(1)}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Text style={styles.arrowText}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    zIndex: 100,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    padding: 6,
    backgroundColor: '#181714',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#302e29',
  },
  arrowText: { color: '#fff', fontSize: 22, lineHeight: 24 },
  label: { minWidth: 154, paddingHorizontal: 12, alignItems: 'center' },
  kicker: { color: '#bcb6aa', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  name: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 2 },
  pressed: { opacity: 0.65 },
});
