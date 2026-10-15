export const DEFAULT_PIECE_STYLE = "maestro";

export const PIECE_STYLES = Object.freeze({
  maestro: { label: "Maestro", preview: ["wK", "bK", "wN", "bN"] },
  fantasy: { label: "Fantasy", preview: ["wK", "bK", "wN", "bN"] },
  chessnut: { label: "Chessnut", preview: ["wK", "bK", "wN", "bN"] },
});

const legacyPieceNames = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };
const legacyColors = { w: "white", b: "black" };

export function resolvePieceAsset(style, color, type) {
  const styleName = Object.hasOwn(PIECE_STYLES, style) ? style : DEFAULT_PIECE_STYLE;
  const normalizedColor = color === "w" || color === "white" ? "w" : "b";
  const normalizedType = String(type).toUpperCase();
  if (!Object.hasOwn(legacyPieceNames, normalizedType)) return "";

  if (styleName === "maestro") {
    return new URL(`../pieces/${legacyColors[normalizedColor]}-${legacyPieceNames[normalizedType]}.svg`, import.meta.url).href;
  }
  return new URL(`../assets/pieces/${styleName}/${normalizedColor}${normalizedType}.svg`, import.meta.url).href;
}

export async function verifyPieceStyle(style) {
  if (!Object.hasOwn(PIECE_STYLES, style)) return false;
  const imagePaths = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"];
  const results = await Promise.all(imagePaths.map((code) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
    image.src = resolvePieceAsset(style, code[0], code[1]);
  })));
  return results.every(Boolean);
}
