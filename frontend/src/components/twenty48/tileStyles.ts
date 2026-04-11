import { TextStyle, ViewStyle } from "react-native";
import { Colors } from "../../theme/ThemeContext";

export interface TileVisual {
  container: ViewStyle;
  text: TextStyle;
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getTileFontSize(value: number): number {
  if (value < 100) return 28;
  if (value < 1000) return 22;
  if (value < 10000) return 18;
  return 14;
}

export function getTileVisual(value: number, colors: Colors): TileVisual {
  const glow = (color: string, radius: number): ViewStyle => ({
    shadowColor: color,
    shadowOpacity: 0.9,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 0 },
    elevation: radius,
  });

  switch (value) {
    case 2:
      return {
        container: { backgroundColor: colors.surfaceAlt },
        text: { color: colors.text },
      };
    case 4:
      return {
        container: {
          backgroundColor: colors.surfaceHigh,
          borderTopWidth: 1.5,
          borderTopColor: colors.accent,
        },
        text: { color: colors.text },
      };
    case 8:
      return {
        container: {
          backgroundColor: withAlpha(colors.accent, 0.1),
          borderWidth: 1,
          borderColor: colors.accent,
          ...glow(colors.accent, 4),
        },
        text: { color: colors.accent },
      };
    case 16:
      return {
        container: {
          backgroundColor: withAlpha(colors.accentBright, 0.2),
          borderWidth: 1.5,
          borderColor: colors.accent,
          ...glow(colors.accent, 6),
        },
        text: { color: colors.accent },
      };
    case 32:
      return {
        container: {
          backgroundColor: withAlpha(colors.secondary, 0.2),
          borderWidth: 1.5,
          borderColor: colors.secondary,
          ...glow(colors.secondary, 6),
        },
        text: { color: colors.secondary },
      };
    case 64:
      return {
        container: {
          backgroundColor: withAlpha(colors.secondary, 0.3),
          borderWidth: 2,
          borderColor: colors.secondary,
          ...glow(colors.secondary, 10),
        },
        text: { color: colors.secondary },
      };
    case 128:
      return {
        container: {
          backgroundColor: withAlpha(colors.tertiary, 0.15),
          borderWidth: 1.5,
          borderColor: colors.tertiary,
          ...glow(colors.tertiary, 5),
        },
        text: { color: colors.tertiary },
      };
    case 256:
      return {
        container: {
          backgroundColor: withAlpha(colors.tertiary, 0.2),
          borderWidth: 2,
          borderColor: colors.tertiary,
          ...glow(colors.tertiary, 8),
        },
        text: { color: colors.tertiary },
      };
    case 512:
      return {
        container: {
          backgroundColor: withAlpha(colors.tertiary, 0.28),
          borderWidth: 2,
          borderColor: colors.tertiary,
          ...glow(colors.tertiary, 11),
        },
        text: { color: colors.tertiary },
      };
    case 1024:
      return {
        container: {
          backgroundColor: withAlpha(colors.tertiary, 0.36),
          borderWidth: 2.5,
          borderColor: colors.tertiary,
          ...glow(colors.tertiary, 14),
        },
        text: { color: colors.tertiary },
      };
    case 2048:
      return {
        container: {
          backgroundColor: colors.accent,
          borderWidth: 2.5,
          borderColor: colors.secondary,
          ...glow(colors.secondary, 16),
        },
        text: { color: colors.textOnAccent },
      };
    default:
      return {
        container: {
          backgroundColor: withAlpha(colors.tertiary, 0.4),
          borderWidth: 2.5,
          borderColor: colors.tertiary,
          ...glow(colors.tertiary, 14),
        },
        text: { color: colors.tertiary },
      };
  }
}
