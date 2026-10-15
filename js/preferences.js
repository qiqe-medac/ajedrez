import { DEFAULT_PIECE_STYLE, PIECE_STYLES } from "./piece-assets.js";

export const PREFERENCES_STORAGE_KEY = "qchess.preferences";

export const DEFAULT_PREFERENCES = Object.freeze({
  boardTheme: "classic",
  showClock: true,
  showControlButtons: true,
  whiteAutoPlay: false,
  blackAutoPlay: false,
  pieceStyle: DEFAULT_PIECE_STYLE,
});

export const BOARD_THEMES = Object.freeze({
  classic: { light: "#e6ddc8", dark: "#718b80" },
  green: { light: "#e8f0d8", dark: "#668b55" },
  blue: { light: "#e2edf5", dark: "#547d9b" },
  gray: { light: "#e5e5e5", dark: "#686d73" },
  wood: { light: "#ead7b5", dark: "#9b5940" },
});

function normalizePreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_PREFERENCES };
  const boardTheme = Object.hasOwn(BOARD_THEMES, value.boardTheme) ? value.boardTheme : DEFAULT_PREFERENCES.boardTheme;
  const showClock = typeof value.showClock === "boolean" ? value.showClock : DEFAULT_PREFERENCES.showClock;
  const showControlButtons = typeof value.showControlButtons === "boolean" ? value.showControlButtons : DEFAULT_PREFERENCES.showControlButtons;
  const whiteAutoPlay = typeof value.whiteAutoPlay === "boolean" ? value.whiteAutoPlay : DEFAULT_PREFERENCES.whiteAutoPlay;
  const blackAutoPlay = typeof value.blackAutoPlay === "boolean" ? value.blackAutoPlay : DEFAULT_PREFERENCES.blackAutoPlay;
  const pieceStyle = Object.hasOwn(PIECE_STYLES, value.pieceStyle) ? value.pieceStyle : DEFAULT_PREFERENCES.pieceStyle;
  return { ...DEFAULT_PREFERENCES, ...value, boardTheme, showClock, showControlButtons, whiteAutoPlay, blackAutoPlay, pieceStyle };
}

export function readPreferences() {
  try {
    return normalizePreferences(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) || "null"));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writePreferences(preferences) {
  const normalized = normalizePreferences(preferences);
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Preferences still apply for this session when storage is unavailable.
  }
  return normalized;
}

export function updatePreference(preferences, key, value) {
  return writePreferences({ ...preferences, [key]: value });
}
