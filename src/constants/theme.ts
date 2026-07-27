/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { DynamicColorIOS, Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

function semanticColor(light: string, dark: string) {
  return Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : light;
}

export const TorqueColors = {
  canvas: semanticColor('#F2F2F7', '#000000'),
  card: semanticColor('#FFFFFF', '#1C1C1E'),
  primary: semanticColor('#007AFF', '#0A84FF'),
  primarySurface: semanticColor('rgba(0, 122, 255, 0.12)', 'rgba(10, 132, 255, 0.22)'),
  secondary: semanticColor('#8E8E93', '#98989D'),
  divider: semanticColor('rgba(60, 60, 67, 0.12)', 'rgba(84, 84, 88, 0.65)'),
  text: semanticColor('#1C1C1E', '#FFFFFF'),
  error: semanticColor('#FF3B30', '#FF453A'),
  accentSurface: semanticColor('#E5F1FF', '#102A43'),
  secondarySurface: semanticColor('#F2F2F7', '#2C2C2E'),
  // Severity + accent palette from the TorqueLog Alpha design.
  danger: semanticColor('#D70015', '#FF453A'),
  dangerSurface: semanticColor('rgba(255, 59, 48, 0.12)', 'rgba(255, 69, 58, 0.22)'),
  dangerDot: semanticColor('#FF3B30', '#FF453A'),
  warning: semanticColor('#C93400', '#FF9F0A'),
  warningSurface: semanticColor('rgba(255, 149, 0, 0.14)', 'rgba(255, 159, 10, 0.22)'),
  warningDot: semanticColor('#FF9500', '#FF9F0A'),
  success: semanticColor('#248A3D', '#30D158'),
  successSurface: semanticColor('rgba(52, 199, 89, 0.12)', 'rgba(48, 209, 88, 0.20)'),
  successDot: semanticColor('#34C759', '#30D158'),
  trip: semanticColor('#5856D6', '#5E5CE6'),
  tripSurface: semanticColor('rgba(88, 86, 214, 0.12)', 'rgba(94, 92, 230, 0.24)'),
  neutralSurface: semanticColor('rgba(120, 120, 128, 0.14)', 'rgba(120, 120, 128, 0.28)'),
  neutralDot: semanticColor('#C7C7CC', '#48484A'),
  track: semanticColor('rgba(120, 120, 128, 0.16)', 'rgba(120, 120, 128, 0.32)'),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
