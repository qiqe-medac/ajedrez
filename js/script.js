import { Chess, validateFen } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";
import { BOARD_THEMES, readPreferences, updatePreference } from "./preferences.js";
import { DEFAULT_PIECE_STYLE, PIECE_STYLES, resolvePieceAsset, verifyPieceStyle } from "./piece-assets.js";

const settingsButton = document.querySelector("#settings-button");
const settingsBackdrop = document.querySelector("#settings-dialog");
const settingsModal = settingsBackdrop.querySelector(".settings-modal");
const settingsCloseButton = document.querySelector("#settings-close");
const welcomeHeaderButton = document.querySelector("#welcome-header-button");
const welcomeBackdrop = document.querySelector("#welcome-backdrop");
const welcomeDialog = document.querySelector("#welcome-dialog");
const welcomeCloseButton = document.querySelector("#welcome-close");
const welcomeAcceptButton = document.querySelector("#welcome-accept");
const noticeBackdrop = document.querySelector("#notice-backdrop");
const noticeDialog = document.querySelector("#notice-dialog");
const noticeTitle = document.querySelector("#notice-title");
const noticeMessage = document.querySelector("#notice-message");
const noticeDetails = document.querySelector("#notice-details");
const noticeAcceptButton = document.querySelector("#notice-accept");
const welcomeDismissCheckbox = document.querySelector("#welcome-dismiss");
const welcomeLink = document.querySelector("#welcome-link");
const WELCOME_DISMISSED_KEY = "qchessWelcomeDismissed";
let welcomeOpener = null;
let noticeOpener = null;
const themeOptions = [...document.querySelectorAll(".board-theme-option")];
const showClockSetting = document.querySelector("#show-clock-setting");
const showControlButtonsSetting = document.querySelector("#show-control-buttons-setting");
const controlButtonsElement = document.querySelector(".control-buttons");
const whitePlayerModeButton = document.querySelector("#white-player-mode-button");
const blackPlayerModeButton = document.querySelector("#black-player-mode-button");
const pieceStyleOptions = document.querySelector("#piece-style-options");
const pieceStyleStatus = document.querySelector("#piece-style-status");
let preferences = readPreferences();
let activePieceStyle = preferences.pieceStyle;
let pieceStyleRequestId = 0;
let automaticPlayers = { w: preferences.whiteAutoPlay, b: preferences.blackAutoPlay };
const automaticPlayerGeneration = { w: 0, b: 0 };
let automaticMoveInProgress = false;
let deferredAutomaticMove = null;

function applyBoardTheme(themeName) {
  const theme = BOARD_THEMES[themeName] || BOARD_THEMES.classic;
  document.documentElement.style.setProperty("--board-light-square", theme.light);
  document.documentElement.style.setProperty("--board-dark-square", theme.dark);
  themeOptions.forEach((option) => option.setAttribute("aria-pressed", String(option.dataset.theme === themeName)));
}

function openSettings() {
  settingsBackdrop.hidden = false;
  document.body.classList.add("settings-open");
  settingsCloseButton.focus();
}

function closeSettings() {
  if (settingsBackdrop.hidden) return;
  settingsBackdrop.hidden = true;
  document.body.classList.remove("settings-open");
  settingsButton.focus();
}

function isWelcomeDismissed() {
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function openWelcomeModal(opener = null) {
  if (!welcomeBackdrop.hidden) return;
  welcomeOpener = opener instanceof HTMLElement ? opener : null;
  welcomeDismissCheckbox.checked = isWelcomeDismissed();
  welcomeBackdrop.hidden = false;
  document.body.classList.add("welcome-open");
  welcomeAcceptButton.focus();
}

function closeWelcomeModal() {
  if (welcomeBackdrop.hidden) return;
  if (welcomeDismissCheckbox.checked) {
    try {
      window.localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    } catch {
      // El modal sigue siendo utilizable aunque el navegador bloquee el almacenamiento.
    }
  }
  welcomeBackdrop.hidden = true;
  document.body.classList.remove("welcome-open");
  const focusTarget = welcomeOpener instanceof HTMLElement && welcomeOpener.isConnected ? welcomeOpener : welcomeLink;
  focusTarget.focus();
  welcomeOpener = null;
}

welcomeCloseButton.addEventListener("click", closeWelcomeModal);
welcomeAcceptButton.addEventListener("click", closeWelcomeModal);
welcomeLink.addEventListener("click", (event) => {
  event.preventDefault();
  openWelcomeModal(welcomeLink);
});
welcomeHeaderButton.addEventListener("click", () => openWelcomeModal(welcomeHeaderButton));
welcomeDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeWelcomeModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [welcomeCloseButton, welcomeDismissCheckbox, welcomeAcceptButton];
  if (event.shiftKey && document.activeElement === focusable[0]) {
    event.preventDefault();
    focusable.at(-1).focus();
  } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
    event.preventDefault();
    focusable[0].focus();
  }
});

function openNoticeModal({ title, message, errors = [], warnings = [], opener = document.activeElement }) {
  noticeTitle.textContent = title;
  noticeMessage.textContent = message;
  noticeDetails.replaceChildren();
  [
    ["errors", "Errores", errors],
    ["warnings", "Avisos", warnings],
  ].forEach(([className, headingText, items]) => {
    if (!items.length) return;
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    const list = document.createElement("ul");
    section.className = `notice-detail-section ${className}`;
    heading.textContent = headingText;
    items.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    });
    section.append(heading, list);
    noticeDetails.append(section);
  });
  noticeDialog.setAttribute("aria-describedby", noticeDetails.childElementCount
    ? "notice-message notice-details"
    : "notice-message");
  noticeOpener = opener instanceof HTMLElement ? opener : null;
  noticeBackdrop.hidden = false;
  document.body.classList.add("notice-open");
  noticeAcceptButton.focus();
}

function closeNoticeModal() {
  if (noticeBackdrop.hidden) return;
  noticeBackdrop.hidden = true;
  document.body.classList.remove("notice-open");
  if (noticeOpener?.isConnected) noticeOpener.focus();
  noticeOpener = null;
}

noticeAcceptButton.addEventListener("click", closeNoticeModal);
noticeDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeNoticeModal();
  } else if (event.key === "Tab") {
    event.preventDefault();
    noticeAcceptButton.focus();
  }
});

function applyClockVisibility(showClock) {
  chessClocksElement.hidden = !showClock;
  showClockSetting.checked = showClock;
  if (showClock) updateClockDisplay(true);
}

function applyControlButtonsVisibility(showControlButtons) {
  showControlButtonsSetting.checked = showControlButtons;
  controlButtonsElement.hidden = !showControlButtons;
}

function renderPlayerModeButtons() {
  [["w", whitePlayerModeButton], ["b", blackPlayerModeButton]].forEach(([color, button]) => {
    const side = color === "w" ? "Blancas" : "Negras";
    const mode = automaticPlayers[color] ? "automático" : "modo manual";
    button.querySelector(".player-mode-label").textContent = `${side}: ${mode}`;
    button.setAttribute("aria-label", `${side}: ${mode}`);
    button.setAttribute("aria-pressed", String(automaticPlayers[color]));
  });
}

function togglePlayerMode(color) {
  automaticPlayers[color] = !automaticPlayers[color];
  automaticPlayerGeneration[color] += 1;
  if (deferredAutomaticMove?.job.sideToMove === color) deferredAutomaticMove = null;
  preferences = updatePreference(preferences, color === "w" ? "whiteAutoPlay" : "blackAutoPlay", automaticPlayers[color]);
  renderPlayerModeButtons();
  updateAnalysisControls();
  if (isDesignMode || game.turn() !== color || !automaticPlayers[color]) return;

  const fen = game.fen({ forceEnpassantSquare: true });
  const activeJob = [activeStockfishJob, preparingStockfishJob, pendingAutomaticJob].find((job) =>
    job?.kind === "automatic" && job.id === automaticEvaluation.requestId && job.fen === fen);
  if (activeJob) {
    activeJob.playerGeneration = automaticPlayerGeneration[color];
    return;
  }
  if (automaticEvaluation.fen === fen && automaticEvaluation.status === "ready" && automaticEvaluation.principalVariation) {
    deferredAutomaticMove = {
      job: { kind: "automatic", id: automaticEvaluation.requestId, fen, sideToMove: color, playerGeneration: automaticPlayerGeneration[color] },
      pv: automaticEvaluation.principalVariation,
    };
    maybeApplyDeferredAutomaticMove();
    return;
  }
  scheduleAutomaticEvaluation();
}

function renderPieceStyleOptions(availableStyles = Object.keys(PIECE_STYLES)) {
  pieceStyleOptions.replaceChildren(...availableStyles.map((style) => {
    const option = document.createElement("button");
    const preview = document.createElement("span");
    const name = document.createElement("span");
    option.className = "piece-style-option";
    option.type = "button";
    option.dataset.style = style;
    option.setAttribute("aria-pressed", String(style === activePieceStyle));
    option.setAttribute("aria-label", `Usar estilo de piezas ${PIECE_STYLES[style].label}`);
    preview.className = "piece-style-preview";
    preview.setAttribute("aria-hidden", "true");
    PIECE_STYLES[style].preview.forEach((code) => {
      const image = document.createElement("img");
      image.src = resolvePieceAsset(style, code[0], code[1]);
      image.alt = "";
      preview.append(image);
    });
    name.className = "piece-style-name";
    name.textContent = PIECE_STYLES[style].label;
    option.append(preview, name);
    option.addEventListener("click", () => selectPieceStyle(style));
    return option;
  }));
}

function refreshPieceImages() {
  document.querySelectorAll("[data-piece-color][data-piece-type]").forEach((image) => {
    image.src = resolvePieceAsset(activePieceStyle, image.dataset.pieceColor, image.dataset.pieceType);
  });
  document.querySelectorAll(".piece-style-option").forEach((option) => {
    option.setAttribute("aria-pressed", String(option.dataset.style === activePieceStyle));
  });
  renderPiecePalette();
  updateDesignToolPreview();
}

async function selectPieceStyle(style, persist = true) {
  const requestId = ++pieceStyleRequestId;
  pieceStyleStatus.textContent = "Comprobando las piezas…";
  const available = await verifyPieceStyle(style);
  if (requestId !== pieceStyleRequestId) return false;
  if (!available) {
    pieceStyleStatus.textContent = "No se pudo cargar el estilo completo; se mantiene el actual.";
    return false;
  }
  activePieceStyle = style;
  if (persist) preferences = updatePreference(preferences, "pieceStyle", style);
  refreshPieceImages();
  pieceStyleStatus.textContent = "Estilo aplicado.";
  return true;
}

async function initializePieceStyles() {
  const availableStyles = (await Promise.all(Object.keys(PIECE_STYLES).map(async (style) => [style, await verifyPieceStyle(style)])))
    .filter(([, available]) => available)
    .map(([style]) => style);
  const fallbackStyle = availableStyles.includes(DEFAULT_PIECE_STYLE) ? DEFAULT_PIECE_STYLE : availableStyles[0];
  const storedStyle = availableStyles.includes(preferences.pieceStyle) ? preferences.pieceStyle : fallbackStyle;
  const restoredFallback = storedStyle !== preferences.pieceStyle;
  activePieceStyle = storedStyle;
  if (preferences.pieceStyle !== storedStyle) preferences = updatePreference(preferences, "pieceStyle", storedStyle);
  renderPieceStyleOptions(availableStyles);
  refreshPieceImages();
  if (restoredFallback) pieceStyleStatus.textContent = "Se restauró el estilo predeterminado porque el guardado no está disponible.";
}

applyBoardTheme(preferences.boardTheme);
settingsButton.addEventListener("click", openSettings);
settingsCloseButton.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", (event) => {
  if (event.target === settingsBackdrop) closeSettings();
});
settingsModal.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeSettings();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...settingsModal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
themeOptions.forEach((option) => option.addEventListener("click", () => {
  preferences = updatePreference(preferences, "boardTheme", option.dataset.theme);
  applyBoardTheme(preferences.boardTheme);
}));
showClockSetting.addEventListener("change", () => {
  preferences = updatePreference(preferences, "showClock", showClockSetting.checked);
  applyClockVisibility(preferences.showClock);
});
showControlButtonsSetting.addEventListener("change", () => {
  preferences = updatePreference(preferences, "showControlButtons", showControlButtonsSetting.checked);
  applyControlButtonsVisibility(preferences.showControlButtons);
});
whitePlayerModeButton.addEventListener("click", () => togglePlayerMode("w"));
blackPlayerModeButton.addEventListener("click", () => togglePlayerMode("b"));

const boardElement = document.querySelector("#chessboard");
const boardFilesTop = document.querySelector(".board-files-top");
const boardFilesBottom = document.querySelector(".board-files-bottom");
const boardRanksLeft = document.querySelector(".board-ranks-left");
const boardRanksRight = document.querySelector(".board-ranks-right");
const capturedTop = document.querySelector("#captured-top");
const capturedBottom = document.querySelector("#captured-bottom");
const materialBalance = document.querySelector("#material-balance");
const designTools = document.querySelector("#design-tools");
const enterDesignButton = document.querySelector("#enter-design-button");
const designTurnButton = document.querySelector("#design-turn-button");
const validationLevelSelect = document.querySelector("#validation-level");
const piecePalette = document.querySelector("#piece-palette");
const erasePieceButton = document.querySelector("#erase-piece-button");
const designToolPreview = document.querySelector("#design-tool-preview");
const designToolPreviewImage = document.querySelector("#design-tool-preview-image");
const clearBoardButton = document.querySelector("#clear-board-button");
const initialPositionButton = document.querySelector("#initial-position-button");
const validatePositionButton = document.querySelector("#validate-position-button");
const startDesignedGameButton = document.querySelector("#start-designed-game-button");
const designMessage = document.querySelector("#design-message");
const designMessageContent = document.querySelector("#design-message-content");
const savePositionButton = document.querySelector("#save-position-button");
const loadPositionButton = document.querySelector("#load-position-button");
const positionFileInput = document.querySelector("#position-file-input");
const loadInDesignButton = document.querySelector("#load-in-design-button");
const turnLabel = document.querySelector("#turn-label");
const turnIndicator = document.querySelector(".turn-indicator");
const panelNote = document.querySelector(".panel-note");
const resetButton = document.querySelector("#reset-button");
const rotateBoardButtons = [...document.querySelectorAll(".rotate-board-button")];
const whiteControlButton = document.querySelector("#white-control-button");
const blackControlButton = document.querySelector("#black-control-button");
const analyzeButton = document.querySelector("#analyze-button");
const analysisPanel = document.querySelector("#analysis-panel");
const analysisStatus = document.querySelector("#analysis-status");
const analysisVariants = document.querySelector("#analysis-variants");
const acceptAnalysisMoveButton = document.querySelector("#accept-analysis-move");
const cancelAnalysisButton = document.querySelector("#cancel-analysis");
const chessClocksElement = document.querySelector("#chess-clocks");
const evaluationBar = document.querySelector("#evaluation-bar");
const evaluationWhite = document.querySelector("#evaluation-white");
const evaluationBlack = document.querySelector("#evaluation-black");
const evaluationScore = document.querySelector("#evaluation-score");
const evaluationStatus = document.querySelector("#evaluation-status");
const promotionOverlay = document.querySelector("#promotion-overlay");
const promotionDialog = promotionOverlay.querySelector(".promotion-dialog");
const promotionOptionButtons = [...promotionOverlay.querySelectorAll("[data-promotion]")];
const cancelPromotionButton = document.querySelector("#cancel-promotion");
const cancelPromotionTextButton = document.querySelector("#cancel-promotion-text");
const files = "abcdefgh";
const pieceNames = { k: "rey", q: "dama", r: "torre", b: "alfil", n: "caballo", p: "pe\u00f3n" };
const pieceColors = { w: "white", b: "black" };
const capturedPieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const clockViews = {
  w: {
    card: document.querySelector("#white-clock"),
    time: document.querySelector("#white-clock-time"),
    status: document.querySelector("#white-clock-status"),
  },
  b: {
    card: document.querySelector("#black-clock"),
    time: document.querySelector("#black-clock-time"),
    status: document.querySelector("#black-clock-status"),
  },
};

let game = new Chess();
let gameOverNotified = false;
let captureHistoryComplete = true;
let selectedSquare = null;
let legalMoves = [];
let lastMove = null;
let pendingPromotion = null;
let dragState = null;
let suppressClick = false;
let boardFlipped = false;
let controlViewColor = null;
let controlMap = null;
let moveAnimationState = null;
let isDesignMode = false;
let designPosition = null;
let designTurn = "w";
let designTool = { type: "q", color: "w" };
let designEraseMode = false;
let designToolPointer = null;
let designToolPreviewFrame = null;
let designToolPreviewSize = 40;
let pendingDesignLoad = null;
const designPieceTypes = ["k", "q", "r", "b", "n", "p"];
const STOCKFISH_SEARCH_DEPTH = 12;
const STOCKFISH_SEARCH_TIMEOUT = 45000;
const STOCKFISH_WORKER_URL = new URL("../engine/stockfish-18-lite-single.js", import.meta.url);
const chessClock = {
  elapsed: { w: 0, b: 0 },
  activeColor: null,
  startedAt: null,
  state: "ready",
  intervalId: null,
};
let displayedClockSeconds = { w: null, b: null };
let stockfishWorker = null;
let stockfishReadyPromise = null;
let stockfishHandshake = null;
let stockfishReadyWaiter = null;
let stockfishSearchInProgress = false;
let stockfishSearchTimer = null;
let analysisState = null;
let activeStockfishJob = null;
let preparingStockfishJob = null;
let stockfishPreparationInProgress = false;
let pendingManualJob = null;
let pendingAutomaticJob = null;
let automaticEvaluationRequestId = 0;
let automaticEvaluation = { fen: null, status: "idle", scoreType: null, score: 0, depth: 0 };

applyClockVisibility(preferences.showClock);
applyControlButtonsVisibility(preferences.showControlButtons);
renderPlayerModeButtons();

function toSquareName(row, column) {
  return `${files[column]}${8 - row}`;
}

function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const pad = (value) => String(value).padStart(2, "0");

  if (totalMinutes >= 60) {
    return `${pad(Math.floor(totalMinutes / 60))}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(totalMinutes)}:${pad(seconds)}`;
}

function updateClockDisplay(force = false) {
  const now = performance.now();

  Object.entries(clockViews).forEach(([color, view]) => {
    const activeElapsed = chessClock.state === "running" && chessClock.activeColor === color
      ? Math.max(0, now - chessClock.startedAt)
      : 0;
    const elapsedMilliseconds = chessClock.elapsed[color] + activeElapsed;
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);

    if (force || displayedClockSeconds[color] !== elapsedSeconds) {
      view.time.textContent = formatElapsedTime(elapsedMilliseconds);
      view.time.dateTime = `PT${elapsedSeconds}S`;
      displayedClockSeconds[color] = elapsedSeconds;
    }

    const isActive = chessClock.state === "running" && chessClock.activeColor === color;
    view.card.classList.toggle("is-active", isActive);
    const status = chessClock.state === "ready"
      ? "Preparado"
      : chessClock.state === "finished"
        ? "Finalizado"
        : isActive
          ? "En juego"
          : "En espera";
    if (view.status.textContent !== status) view.status.textContent = status;
  });
}

function startClock(color, now = performance.now()) {
  if (chessClock.state === "finished") return;
  chessClock.state = "running";
  chessClock.activeColor = color;
  chessClock.startedAt = now;
  if (chessClock.intervalId === null) {
    chessClock.intervalId = window.setInterval(updateClockDisplay, 200);
  }
}

function stopClock(color, now = performance.now()) {
  if (chessClock.state !== "running" || chessClock.activeColor !== color || chessClock.startedAt === null) return;
  chessClock.elapsed[color] += Math.max(0, now - chessClock.startedAt);
  chessClock.activeColor = null;
  chessClock.startedAt = null;
}

function switchClock(moverColor, nextColor) {
  const now = performance.now();
  if (chessClock.state === "ready") startClock(moverColor, now);
  if (chessClock.activeColor !== null) stopClock(chessClock.activeColor, now);

  if (game.isGameOver()) {
    chessClock.state = "finished";
    if (chessClock.intervalId !== null) {
      window.clearInterval(chessClock.intervalId);
      chessClock.intervalId = null;
    }
  } else {
    startClock(nextColor, now);
  }
  updateClockDisplay(true);
}

function resetClocks() {
  if (chessClock.intervalId !== null) {
    window.clearInterval(chessClock.intervalId);
    chessClock.intervalId = null;
  }
  chessClock.elapsed = { w: 0, b: 0 };
  chessClock.activeColor = null;
  chessClock.startedAt = null;
  chessClock.state = "ready";
  displayedClockSeconds = { w: null, b: null };
  updateClockDisplay(true);
}

function getKingSquare(color, position) {
  for (let row = 0; row < position.length; row += 1) {
    for (let column = 0; column < position[row].length; column += 1) {
      const piece = position[row][column];
      if (piece?.type === "k" && piece.color === color) return toSquareName(row, column);
    }
  }
  return null;
}

function calculateControlMap(position, color) {
  const counts = Array.from({ length: 8 }, () => Array(8).fill(0));
  const knightOffsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const kingOffsets = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const diagonalDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const straightDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const isInsideBoard = (row, column) => row >= 0 && row < 8 && column >= 0 && column < 8;

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = position[row][column];
      if (!piece || piece.color !== color) continue;

      const controlledByPiece = new Set();
      const addControl = (targetRow, targetColumn) => {
        if (!isInsideBoard(targetRow, targetColumn)) return;
        const target = `${targetRow},${targetColumn}`;
        if (controlledByPiece.has(target)) return;
        controlledByPiece.add(target);
        counts[targetRow][targetColumn] += 1;
      };

      if (piece.type === "p") {
        const attackRow = row + (color === "w" ? -1 : 1);
        addControl(attackRow, column - 1);
        addControl(attackRow, column + 1);
      } else if (piece.type === "n" || piece.type === "k") {
        const offsets = piece.type === "n" ? knightOffsets : kingOffsets;
        offsets.forEach(([rowOffset, columnOffset]) => addControl(row + rowOffset, column + columnOffset));
      } else {
        const directions = piece.type === "b"
          ? diagonalDirections
          : piece.type === "r"
            ? straightDirections
            : [...diagonalDirections, ...straightDirections];

        directions.forEach(([rowOffset, columnOffset]) => {
          let targetRow = row + rowOffset;
          let targetColumn = column + columnOffset;
          while (isInsideBoard(targetRow, targetColumn)) {
            addControl(targetRow, targetColumn);
            if (position[targetRow][targetColumn]) break;
            targetRow += rowOffset;
            targetColumn += columnOffset;
          }
        });
      }
    }
  }

  return counts;
}

function clonePosition(position) {
  return position.map((row) => row.map((piece) => piece ? { ...piece } : null));
}

function renderPiecePalette() {
  ["w", "b"].forEach((color) => {
    const row = piecePalette.querySelector(`.piece-option-row[data-color="${color}"]`);
    row.replaceChildren(...designPieceTypes.map((type) => {
      const button = document.createElement("button");
      const image = document.createElement("img");
      const label = document.createElement("span");
      button.className = "palette-piece";
      button.type = "button";
      button.setAttribute("aria-pressed", String(designTool.type === type && designTool.color === color && !designEraseMode));
      button.setAttribute("aria-label", `Seleccionar ${pieceNames[type]} ${color === "w" ? "blanco" : "negro"}`);
      image.dataset.pieceColor = color;
      image.dataset.pieceType = type;
      image.src = resolvePieceAsset(activePieceStyle, color, type);
      image.alt = "";
      label.textContent = pieceNames[type];
      button.append(image, label);
      button.addEventListener("click", () => {
        designTool = { type, color };
        designEraseMode = false;
        erasePieceButton.setAttribute("aria-pressed", "false");
        renderPiecePalette();
        updateDesignToolPreview();
      });
      return button;
    }));
  });
}

function renderDesignTurnButton() {
  const side = designTurn === "w" ? "blancas" : "negras";
  designTurnButton.textContent = `Juegan ${side}`;
  designTurnButton.setAttribute("aria-pressed", String(designTurn === "b"));
  designTurnButton.setAttribute("aria-label", `Cambiar turno. Actualmente juegan ${side}`);
}

function toggleDesignTurn() {
  designTurn = designTurn === "w" ? "b" : "w";
  renderDesignTurnButton();
  hideDesignMessage();
  renderBoard();
}

function positionDesignToolPreview() {
  if (!designToolPointer || designToolPreview.hidden) return;
  const offset = designToolPreviewSize / 2;
  designToolPreview.style.transform = `translate3d(${designToolPointer.x - offset}px, ${designToolPointer.y - offset}px, 0)`;
}

function updateDesignToolPreview() {
  const isEraser = isDesignMode && designEraseMode;
  const hasTool = isDesignMode && (designTool.type !== null || designEraseMode);
  document.body.classList.toggle("design-placement-active", hasTool && !isEraser);
  document.body.classList.toggle("design-erase-active", isEraser);
  designToolPreview.classList.toggle("is-eraser", isEraser);
  designToolPreview.hidden = !hasTool || Boolean(dragState?.design) || !designToolPointer;

  if (!hasTool) return;
  if (!isEraser) {
    designToolPreviewImage.dataset.pieceColor = designTool.color;
    designToolPreviewImage.dataset.pieceType = designTool.type;
    designToolPreviewImage.src = resolvePieceAsset(activePieceStyle, designTool.color, designTool.type);
  }

  const square = boardElement.querySelector(".square");
  designToolPreviewSize = square ? square.getBoundingClientRect().width * 0.68 : 40;
  designToolPreview.style.setProperty("--design-tool-size", `${designToolPreviewSize}px`);
  if (designToolPreviewFrame !== null) cancelAnimationFrame(designToolPreviewFrame);
  designToolPreviewFrame = requestAnimationFrame(() => {
    designToolPreviewFrame = null;
    positionDesignToolPreview();
  });
}

function trackDesignToolPointer(event) {
  if (!isDesignMode || (designTool.type === null && !designEraseMode)) return;
  designToolPointer = { x: event.clientX, y: event.clientY };
  if (designToolPreview.hidden && !dragState?.design) {
    updateDesignToolPreview();
  } else if (designToolPreviewFrame === null) {
    designToolPreviewFrame = requestAnimationFrame(() => {
      designToolPreviewFrame = null;
      positionDesignToolPreview();
    });
  }
}

function cancelDesignTool() {
  if (!isDesignMode || (designTool.type === null && !designEraseMode)) return;
  designTool = { type: null, color: designTool.color };
  designEraseMode = false;
  erasePieceButton.setAttribute("aria-pressed", "false");
  piecePalette.querySelectorAll(".palette-piece").forEach((button) => button.setAttribute("aria-pressed", "false"));
  updateDesignToolPreview();
}

function handleDesignToolKeydown(event) {
  if (event.key !== "Escape" || !settingsBackdrop.hidden || !welcomeBackdrop.hidden || !isDesignMode
    || (designTool.type === null && !designEraseMode)) return;
  event.preventDefault();
  cancelDesignTool();
}

function showDesignMessage(title, errors = [], warnings = [], success = false, offerDesignLoad = false) {
  const heading = document.createElement("strong");
  heading.textContent = title;
  const content = document.createDocumentFragment();
  content.append(heading);
  for (const [className, label, messages] of [["message-errors", "Errores", errors], ["message-warnings", "Avisos", warnings]]) {
    if (!messages.length) continue;
    const section = document.createElement("div");
    const subheading = document.createElement("strong");
    const list = document.createElement("ul");
    section.className = className;
    subheading.textContent = label;
    messages.forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      list.append(item);
    });
    section.append(subheading, list);
    content.append(section);
  }
  designMessage.classList.toggle("is-success", success);
  loadInDesignButton.hidden = !offerDesignLoad;
  designMessageContent.replaceChildren(content);
  designMessage.hidden = false;
}

function hideDesignMessage() {
  designMessage.hidden = true;
  loadInDesignButton.hidden = true;
  pendingDesignLoad = null;
  designMessageContent.replaceChildren();
}

function getGameMessage() {
  if (game.isCheckmate()) return `Jaque mate. Ganan las ${game.turn() === "w" ? "negras" : "blancas"}.`;
  if (game.isStalemate()) return "Tablas por ahogado.";
  if (game.isDraw()) return "La partida ha terminado en tablas.";
  if (game.isCheck()) return `Jaque a las ${game.turn() === "w" ? "blancas" : "negras"}.`;
  return "Selecciona una pieza de tu turno para ver sus movimientos legales.";
}

function renderPiece(piece, square, coordinate) {
  if (!piece) return;

  const image = document.createElement("img");
  const color = pieceColors[piece.color];
  image.className = "piece-image";
  image.dataset.pieceColor = piece.color;
  image.dataset.pieceType = piece.type;
  image.src = resolvePieceAsset(activePieceStyle, piece.color, piece.type);
  image.alt = `${pieceNames[piece.type]} ${color === "white" ? "blanco" : "negro"}`;
  image.draggable = false;
  image.dataset.square = coordinate;
  square.append(image);
}

function renderCapturedMaterial() {
  if (isDesignMode) {
    capturedTop.hidden = true;
    capturedBottom.hidden = true;
    materialBalance.hidden = true;
    return;
  }

  const captures = { w: [], b: [] };
  const totals = { w: 0, b: 0 };
  game.history({ verbose: true }).forEach((move) => {
    if (!move.captured || !Object.hasOwn(capturedPieceValues, move.captured)) return;
    const capturedColor = move.color === "w" ? "b" : "w";
    captures[move.color].push({ color: capturedColor, type: move.captured });
    totals[move.color] += capturedPieceValues[move.captured];
  });

  const renderCollection = (container, playerColor) => {
    const pieces = captures[playerColor];
    const capturedTotal = totals[playerColor];
    const playerName = playerColor === "w" ? "blancas" : "negras";
    const historyDescription = captureHistoryComplete ? "en esta partida" : "desde la posición cargada; el historial anterior es desconocido";
    const pieceList = document.createElement("span");
    pieceList.className = "captured-piece-list";
    pieceList.setAttribute("aria-hidden", "true");
    pieces.forEach(({ color, type }) => {
      const image = document.createElement("img");
      image.className = "captured-piece";
      image.dataset.pieceColor = color;
      image.dataset.pieceType = type;
      image.src = resolvePieceAsset(activePieceStyle, color, type);
      image.alt = "";
      image.draggable = false;
      pieceList.append(image);
    });
    const value = document.createElement("span");
    value.className = "captured-value";
    value.textContent = captureHistoryComplete ? `+${capturedTotal}` : pieces.length ? `+${capturedTotal}*` : "—";
    value.setAttribute("aria-hidden", "true");
    container.replaceChildren(pieceList, value);
    container.hidden = false;
    container.setAttribute("aria-label", `Capturas de las ${playerName}: ${pieces.length} piezas, valor ${capturedTotal}, ${historyDescription}.`);
    container.title = `Capturas de las ${playerName}: ${value.textContent}${captureHistoryComplete ? "" : "; total previo desconocido"}`;
  };

  renderCollection(capturedTop, boardFlipped ? "w" : "b");
  renderCollection(capturedBottom, boardFlipped ? "b" : "w");

  if (!captureHistoryComplete) {
    materialBalance.textContent = "Material: historial previo desconocido";
  } else {
    const difference = totals.w - totals.b;
    materialBalance.textContent = difference === 0
      ? "Material igualado"
      : `Material: +${Math.abs(difference)} ${difference > 0 ? "blancas" : "negras"}`;
  }
  materialBalance.hidden = false;
}

function createMoveAnimationSprite(from, to) {
  const sourceImage = boardElement.querySelector(`[data-square="${from}"] .piece-image`);
  const destinationSquare = boardElement.querySelector(`[data-square="${to}"]`);
  if (!sourceImage || !destinationSquare) return null;

  const sourceRect = sourceImage.getBoundingClientRect();
  const destinationRect = destinationSquare.getBoundingClientRect();
  const sprite = sourceImage.cloneNode(false);
  sprite.className = "move-animation-piece";
  sprite.alt = "";
  sprite.setAttribute("aria-hidden", "true");
  sprite.draggable = false;
  sprite.style.left = `${sourceRect.left}px`;
  sprite.style.top = `${sourceRect.top}px`;
  sprite.style.width = `${sourceRect.width}px`;
  sprite.style.height = `${sourceRect.height}px`;

  return {
    element: sprite,
    fromX: sourceRect.left + sourceRect.width / 2,
    fromY: sourceRect.top + sourceRect.height / 2,
    toX: destinationRect.left + destinationRect.width / 2,
    toY: destinationRect.top + destinationRect.height / 2,
    destination: to,
  };
}

function createMoveAnimationSprites(move, from, to) {
  const motions = [{ from, to }];
  if (move.flags?.includes("k") || move.flags?.includes("q")) {
    const rank = from[1];
    const kingSide = move.flags.includes("k");
    motions.push({ from: `${kingSide ? "h" : "a"}${rank}`, to: `${kingSide ? "f" : "d"}${rank}` });
  }
  return motions.map((motion) => createMoveAnimationSprite(motion.from, motion.to)).filter(Boolean);
}

function finishMoveAnimation(state) {
  if (moveAnimationState !== state) return;
  state.sprites.forEach(({ element }) => element.remove());
  moveAnimationState = null;
  document.body.classList.remove("move-animation-active");
  updateAnalysisControls();
  renderBoard();
  maybeApplyDeferredAutomaticMove();
}

function cancelMoveAnimation(render = true) {
  const state = moveAnimationState;
  if (!state) return;
  moveAnimationState = null;
  if (state.frame !== null) cancelAnimationFrame(state.frame);
  state.animations.forEach((animation) => animation.cancel());
  state.sprites.forEach(({ element }) => element.remove());
  document.body.classList.remove("move-animation-active");
  updateAnalysisControls();
  if (render) renderBoard();
}

function startMoveAnimation(sprites) {
  if (!sprites.length || typeof Element.prototype.animate !== "function") return false;
  const state = { sprites, destinations: new Set(sprites.map(({ destination }) => destination)), animations: [], frame: null };
  moveAnimationState = state;
  document.body.classList.add("move-animation-active");
  sprites.forEach(({ element }) => document.body.append(element));
  updateAnalysisControls();
  state.frame = requestAnimationFrame(() => {
    state.frame = null;
    if (moveAnimationState !== state) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 300;
    state.animations = sprites.map(({ element, fromX, fromY, toX, toY }) => element.animate([
      { transform: "translate3d(0, 0, 0)" },
      { transform: `translate3d(${toX - fromX}px, ${toY - fromY}px, 0)` },
    ], { duration, easing: "ease-in-out", fill: "forwards" }));
    Promise.all(state.animations.map((animation) => animation.finished.catch(() => null)))
      .then(() => finishMoveAnimation(state));
  });
  return true;
}

function renderBoard() {
  refreshAnalysisPositionState();
  const position = isDesignMode ? designPosition : game.board();
  const analysisMove = analysisState?.selectedMove;
  controlMap = controlViewColor ? calculateControlMap(position, controlViewColor) : null;
  const checkSquare = !isDesignMode && game.isCheck() ? getKingSquare(game.turn(), position) : null;
  const legalDestinations = new Map((isDesignMode ? [] : legalMoves).map((move) => [move.to, move]));
  boardElement.classList.toggle("flipped", boardFlipped);
  chessClocksElement.classList.toggle("flipped", boardFlipped);
  renderAutomaticEvaluation();
  renderCoordinates();
  renderCapturedMaterial();
  boardElement.replaceChildren();

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const coordinate = toSquareName(row, column);
      const piece = position[row][column];
      const controlCount = controlMap?.[row][column] ?? 0;
      const square = document.createElement("div");
      const classes = ["square", (row + column) % 2 === 0 ? "light" : "dark"];
      if (moveAnimationState?.destinations.has(coordinate)) classes.push("move-animation-destination");
      if (controlCount > 0) classes.push(`control-level-${Math.min(controlCount, 4)}`);
      if (coordinate === selectedSquare) classes.push("selected");
      if (!isDesignMode && (coordinate === lastMove?.from || coordinate === lastMove?.to)) classes.push("last-move");
      if (coordinate === checkSquare) classes.push("in-check");
      if (coordinate === analysisMove?.from) classes.push("analysis-from");
      if (coordinate === analysisMove?.to) classes.push("analysis-to");
      if (legalDestinations.has(coordinate)) {
        classes.push(legalDestinations.get(coordinate).captured ? "legal-capture" : "legal-destination");
      }

      square.className = classes.join(" ");
      square.dataset.square = coordinate;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `${coordinate}${piece ? `, ${pieceNames[piece.type]} ${piece.color === "w" ? "blanco" : "negro"}` : ""}`);

      if (controlCount > 0) {
        const countLabel = document.createElement("span");
        countLabel.className = "control-count";
        countLabel.setAttribute("aria-hidden", "true");
        countLabel.textContent = String(controlCount);
        square.append(countLabel);
      }

      renderPiece(piece, square, coordinate);
      if (dragState?.moved && dragState.from === coordinate) square.classList.add("drag-origin");
      boardElement.append(square);
    }
  }

  const isWhiteTurn = (isDesignMode ? designTurn : game.turn()) === "w";
  turnLabel.textContent = isWhiteTurn ? "Blancas" : "Negras";
  turnIndicator.classList.toggle("black-to-move", !isWhiteTurn);
  turnCardDesignState(isDesignMode);
  whiteControlButton.setAttribute("aria-pressed", String(controlViewColor === "w"));
  blackControlButton.setAttribute("aria-pressed", String(controlViewColor === "b"));
  whiteControlButton.classList.toggle("is-active", controlViewColor === "w");
  blackControlButton.classList.toggle("is-active", controlViewColor === "b");
  panelNote.textContent = isDesignMode ? "Modo Diseño activo. Selecciona una pieza y una casilla para editar la posición." : getGameMessage();
  updatePromotionSelectorPosition();
  updateAnalysisControls();
}

function turnCardDesignState(active) {
  turnLabel.closest(".turn-card")?.classList.toggle("design-turn-card", active);
}

function renderCoordinates() {
  const displayedFiles = boardFlipped ? [...files].reverse() : [...files];
  const displayedRanks = boardFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  [boardFilesTop, boardFilesBottom].forEach((container) => {
    container.replaceChildren(...displayedFiles.map((file) => {
      const label = document.createElement("span");
      label.textContent = file.toUpperCase();
      return label;
    }));
  });
  [boardRanksLeft, boardRanksRight].forEach((container) => {
    container.replaceChildren(...displayedRanks.map((rank) => {
      const label = document.createElement("span");
      label.textContent = String(rank);
      return label;
    }));
  });
}

function clearSelection() {
  selectedSquare = null;
  legalMoves = [];
}

function suppressGeneratedClick() {
  suppressClick = true;
  window.setTimeout(() => { suppressClick = false; }, 500);
}

function selectPiece(square) {
  const piece = game.get(square);
  if (!piece || piece.color !== game.turn() || game.isGameOver()) {
    clearSelection();
    renderBoard();
    return;
  }

  if (selectedSquare === square) {
    clearSelection();
  } else {
    selectedSquare = square;
    legalMoves = game.moves({ square, verbose: true });
  }
  renderBoard();
}

function updatePromotionSelectorPosition() {
  if (!pendingPromotion || promotionOverlay.hidden) return;
  const destinationSquare = boardElement.querySelector(`[data-square="${pendingPromotion.to}"]`);
  if (!destinationSquare) return;
  const squareRect = destinationSquare.getBoundingClientRect();
  const dialogRect = promotionDialog.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - dialogRect.width - 8,
    squareRect.left + squareRect.width / 2 - dialogRect.width / 2));
  const top = Math.max(8, Math.min(window.innerHeight - dialogRect.height - 8,
    squareRect.top + squareRect.height / 2 - dialogRect.height / 2));
  promotionDialog.style.left = `${left}px`;
  promotionDialog.style.top = `${top}px`;
}

function closePromotionSelector(restoreFocus = false) {
  pendingPromotion = null;
  promotionOverlay.hidden = true;
  if (restoreFocus) {
    boardElement.tabIndex = -1;
    boardElement.focus();
  }
}

function openPromotionSelector(from, to, promotionMoves) {
  const options = new Set(promotionMoves.map((move) => move.promotion));
  if (!["q", "r", "b", "n"].every((piece) => options.has(piece))) return false;
  pendingPromotion = { from, to, color: game.turn() };
  promotionOptionButtons.forEach((button) => {
    const image = button.querySelector("img");
    const piece = button.dataset.promotion;
    image.dataset.pieceColor = pendingPromotion.color;
    image.dataset.pieceType = piece;
    image.src = resolvePieceAsset(activePieceStyle, pendingPromotion.color, piece);
    image.alt = `${pieceNames[piece]} ${pieceColors[pendingPromotion.color] === "white" ? "blanca" : "negra"}`;
  });
  promotionOverlay.hidden = false;
  updatePromotionSelectorPosition();
  promotionOptionButtons[0].focus();
  return true;
}

function makeMove(from, to, promotion = null) {
  if (isDesignMode || moveAnimationState || pendingPromotion || (automaticPlayers[game.turn()] && !automaticMoveInProgress)) return false;
  const destinationMoves = game.moves({ square: from, verbose: true }).filter((move) => move.to === to);
  if (!destinationMoves.length) return false;
  if (destinationMoves.some((move) => move.promotion) && promotion === null) {
    return openPromotionSelector(from, to, destinationMoves.filter((move) => move.promotion));
  }
  const legalMove = destinationMoves.find((move) => (move.promotion ?? null) === promotion);
  if (!legalMove) return false;
  const sprites = createMoveAnimationSprites(legalMove, from, to);

  try {
    const moverColor = game.turn();
    const move = game.move({ from, to, ...(promotion ? { promotion } : {}) });
    if (!move) return false;
    const gameFinished = game.isGameOver();
    switchClock(moverColor, game.turn());
    lastMove = { from: move.from, to: move.to };
    clearSelection();
    startMoveAnimation(sprites);
    renderBoard();
    scheduleAutomaticEvaluation();
    if (gameFinished) showGameFinishedModal();
    return true;
  } catch {
    sprites.forEach(({ element }) => element.remove());
    return false;
  }
}

function invalidateFinishedGameWork() {
  automaticEvaluationRequestId += 1;
  automaticPlayerGeneration.w += 1;
  automaticPlayerGeneration.b += 1;
  pendingAutomaticJob = null;
  pendingManualJob = null;
  deferredAutomaticMove = null;
  analysisState = null;
  analysisPanel.hidden = true;
  clearAnalysisVariants();
  updateAnalysisControls();
}

function getGameFinishedNotice() {
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "negras" : "blancas";
    return {
      title: "Partida finalizada",
      message: `¡Jaque mate! Las ${winner} han ganado.`,
    };
  }
  if (game.isStalemate()) {
    const sideToMove = game.turn() === "w" ? "blancas" : "negras";
    return {
      title: "Partida finalizada",
      message: `Partida finalizada en tablas por ahogado. A las ${sideToMove} les tocaba mover, no tienen movimientos legales y su rey no está en jaque.`,
    };
  }
  if (game.isInsufficientMaterial()) {
    return {
      title: "Partida finalizada",
      message: "Partida finalizada en tablas por material insuficiente para forzar un jaque mate.",
    };
  }
  if (game.isThreefoldRepetition()) {
    return {
      title: "Partida finalizada",
      message: "Partida finalizada en tablas por repetición de posición.",
    };
  }
  if (game.isDrawByFiftyMoves()) {
    return {
      title: "Partida finalizada",
      message: "Partida finalizada en tablas por la regla de los cincuenta movimientos, sin capturas ni movimientos de peón.",
    };
  }
  return {
    title: "Partida finalizada",
    message: game.isDraw()
      ? "Partida finalizada en tablas por otra condición de tablas reconocida por el motor de ajedrez."
      : "La partida ha terminado según las reglas del motor de ajedrez.",
  };
}

function showGameFinishedModal() {
  if (gameOverNotified || !game.isGameOver()) return;
  gameOverNotified = true;
  invalidateFinishedGameWork();
  boardElement.tabIndex = -1;
  openNoticeModal({ ...getGameFinishedNotice(), opener: boardElement });
}

function handleSquareClick(coordinate) {
  if (moveAnimationState) return;
  if (isDesignMode) {
    handleDesignSquareClick(coordinate);
    return;
  }
  if (automaticPlayers[game.turn()]) return;
  const clickedPiece = game.get(coordinate);
  if (selectedSquare && coordinate === selectedSquare) {
    clearSelection();
    renderBoard();
    return;
  }

  const legalMove = legalMoves.find((move) => move.to === coordinate);
  if (selectedSquare && legalMove) {
    makeMove(selectedSquare, coordinate);
    return;
  }

  if (clickedPiece?.color === game.turn()) {
    selectPiece(coordinate);
  }
}

function handleDesignSquareClick(coordinate) {
  const file = files.indexOf(coordinate[0]);
  const row = 8 - Number(coordinate[1]);
  if (designEraseMode) {
    if (!designPosition[row][file]) return;
    designPosition[row][file] = null;
  } else if (designTool.type !== null) {
    const changed = placeDesignPiece(coordinate, designTool);
    if (!changed) return;
  } else {
    return;
  }
  hideDesignMessage();
  renderBoard();
  updateDesignToolPreview();
}

function placeDesignPiece(coordinate, piece) {
  const row = 8 - Number(coordinate[1]);
  const column = files.indexOf(coordinate[0]);
  let changed = false;

  if (piece.type === "k") {
    for (let boardRow = 0; boardRow < 8; boardRow += 1) {
      for (let boardColumn = 0; boardColumn < 8; boardColumn += 1) {
        const existing = designPosition[boardRow][boardColumn];
        if (existing?.type === "k" && existing.color === piece.color
          && (boardRow !== row || boardColumn !== column)) {
          designPosition[boardRow][boardColumn] = null;
          changed = true;
        }
      }
    }
  }

  const current = designPosition[row][column];
  if (current?.type === piece.type && current.color === piece.color) return changed;
  designPosition[row][column] = { type: piece.type, color: piece.color };
  return true;
}

function enterDesignMode() {
  closePromotionSelector();
  cancelMoveAnimation(false);
  if (chessClock.state === "running" && chessClock.activeColor) stopClock(chessClock.activeColor);
  chessClock.state = "ready";
  chessClock.activeColor = null;
  chessClock.startedAt = null;
  updateClockDisplay(true);
  dragState?.ghost?.remove();
  dragState = null;
  clearSelection();
  designPosition = clonePosition(game.board());
  designTurn = game.turn();
  renderDesignTurnButton();
  designTool = { type: null, color: "w" };
  designEraseMode = false;
  erasePieceButton.setAttribute("aria-pressed", "false");
  isDesignMode = true;
  cancelAutomaticEvaluationForDesign();
  designTools.hidden = false;
  enterDesignButton.hidden = true;
  document.body.classList.add("design-mode");
  hideDesignMessage();
  renderPiecePalette();
  renderBoard();
  updateDesignToolPreview();
}

function positionToFen(position, turn) {
  const rows = position.map((row) => {
    let fenRow = "";
    let emptyCount = 0;
    row.forEach((piece) => {
      if (!piece) {
        emptyCount += 1;
      } else {
        if (emptyCount) fenRow += emptyCount;
        emptyCount = 0;
        fenRow += piece.color === "w" ? piece.type.toUpperCase() : piece.type;
      }
    });
    if (emptyCount) fenRow += emptyCount;
    return fenRow;
  });
  return `${rows.join("/")} ${turn} - - 0 1`;
}

function parseFenText(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("El archivo está vacío.");
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 6) throw new Error("El FEN debe contener exactamente seis campos.");
  const [placement, turn, castling, enPassant, halfmoveText, fullmoveText] = fields;
  if (turn !== "w" && turn !== "b") throw new Error("El campo de turno debe ser «w» o «b».");
  if (castling !== "-") {
    if (!/^[KQkq]+$/.test(castling) || new Set(castling).size !== castling.length) {
      throw new Error("El campo de derechos de enroque no tiene un formato válido.");
    }
    const order = "KQkq";
    if ([...castling].some((right, index) => index > 0 && order.indexOf(castling[index - 1]) >= order.indexOf(right))) {
      throw new Error("Los derechos de enroque deben aparecer en el orden KQkq.");
    }
  }
  if (enPassant !== "-" && !/^[a-h][36]$/.test(enPassant)) {
    throw new Error("La casilla de captura al paso no tiene un formato válido.");
  }
  if (!/^[0-9]+$/.test(halfmoveText) || !Number.isSafeInteger(Number(halfmoveText))) {
    throw new Error("El contador de medias jugadas debe ser un entero no negativo.");
  }
  if (!/^[0-9]+$/.test(fullmoveText) || Number(fullmoveText) < 1 || !Number.isSafeInteger(Number(fullmoveText))) {
    throw new Error("El número de jugada completa debe ser un entero positivo.");
  }

  const rows = placement.split("/");
  if (rows.length !== 8) throw new Error("La disposición del tablero debe contener ocho filas.");
  const position = rows.map((fenRow) => {
    const row = [];
    let previousWasDigit = false;
    for (const symbol of fenRow) {
      if (/^[1-8]$/.test(symbol)) {
        if (previousWasDigit) throw new Error("La disposición contiene números consecutivos en una fila.");
        row.push(...Array(Number(symbol)).fill(null));
        previousWasDigit = true;
      } else if (/^[prnbqkPRNBQK]$/.test(symbol)) {
        row.push({ type: symbol.toLowerCase(), color: symbol === symbol.toUpperCase() ? "w" : "b" });
        previousWasDigit = false;
      } else {
        throw new Error(`La disposición contiene un símbolo no válido: «${symbol}».`);
      }
    }
    if (row.length !== 8) throw new Error("Cada fila FEN debe representar exactamente ocho casillas.");
    return row;
  });
  const fen = fields.join(" ");
  return { position, turn, fen, validation: validateFen(fen) };
}
function validatePosition(position, turn, fenText = null, imported = false) {
  const errors = [];
  const warnings = [];
  const kings = { w: 0, b: 0 };
  let pieceCount = 0;
  position.forEach((row, rowIndex) => row.forEach((piece) => {
    if (!piece) return;
    pieceCount += 1;
    if (piece.type === "k") kings[piece.color] += 1;
    if (piece.type === "p" && (rowIndex === 0 || rowIndex === 7)) {
      warnings.push("Hay un peón en la primera o última fila; la biblioteca puede no admitir esta posición.");
    }
  }));
  if (kings.w !== 1) errors.push(`Debe haber exactamente un rey blanco; se encontraron ${kings.w}.`);
  if (kings.b !== 1) errors.push(`Debe haber exactamente un rey negro; se encontraron ${kings.b}.`);
  if (errors.length) return { errors, warnings, candidate: null };
  if (pieceCount > 32) warnings.push(`La posición tiene ${pieceCount} piezas, más de las 32 iniciales.`);

  const whiteKing = getKingSquare("w", position);
  const blackKing = getKingSquare("b", position);
  const whiteKingRow = 8 - Number(whiteKing[1]);
  const whiteKingColumn = files.indexOf(whiteKing[0]);
  const blackKingRow = 8 - Number(blackKing[1]);
  const blackKingColumn = files.indexOf(blackKing[0]);
  const whiteAttacks = calculateControlMap(position, "w");
  const blackAttacks = calculateControlMap(position, "b");
  const whiteInCheck = blackAttacks[whiteKingRow][whiteKingColumn] > 0;
  const blackInCheck = whiteAttacks[blackKingRow][blackKingColumn] > 0;
  if (whiteInCheck && blackInCheck) errors.push("Los dos reyes están en jaque simultáneamente.");
  if (whiteInCheck && turn !== "w") errors.push("El rey blanco está en jaque, pero juegan negras; el último movimiento habría dejado al rey propio en jaque.");
  if (blackInCheck && turn !== "b") errors.push("El rey negro está en jaque, pero juegan blancas; el último movimiento habría dejado al rey propio en jaque.");

  if (imported && fenText) {
    const fenFields = fenText.split(/\s+/);
    const castling = fenFields[2];
    const pieceAt = (square) => position[8 - Number(square[1])][files.indexOf(square[0])];
    const castlingRequirements = [
      ["K", "e1", "h1", "w"], ["Q", "e1", "a1", "w"],
      ["k", "e8", "h8", "b"], ["q", "e8", "a8", "b"],
    ];
    const impossibleRights = castlingRequirements.filter(([right, kingSquare, rookSquare, color]) =>
      castling.includes(right)
      && (pieceAt(kingSquare)?.type !== "k" || pieceAt(kingSquare)?.color !== color
        || pieceAt(rookSquare)?.type !== "r" || pieceAt(rookSquare)?.color !== color));
    if (impossibleRights.length) {
      const message = `Los derechos de enroque ${impossibleRights.map(([right]) => right).join(", ")} no coinciden con el rey y la torre en sus casillas iniciales.`;
      if (validationLevelSelect.value === "strict") errors.push(message);
      else warnings.push(message);
    }

    const enPassant = fenFields[3];
    if (enPassant !== "-") {
      const targetRow = 8 - Number(enPassant[1]);
      const targetColumn = files.indexOf(enPassant[0]);
      const pawnRow = targetRow + (turn === "b" ? -1 : 1);
      const originRow = targetRow + (turn === "b" ? 1 : -1);
      const previousMover = turn === "b" ? "w" : "b";
      const coherent = !position[targetRow][targetColumn]
        && position[pawnRow]?.[targetColumn]?.type === "p"
        && position[pawnRow][targetColumn]?.color === previousMover
        && !position[originRow][targetColumn];
      if (!coherent) {
        const message = "La casilla de captura al paso no coincide con un peón que acaba de avanzar dos casillas.";
        if (validationLevelSelect.value === "strict") errors.push(message);
        else warnings.push(message);
      }
    }
  }

  if (validationLevelSelect.value === "strict") {
    warnings.push(imported
      ? "El FEN proporciona los derechos y contadores declarados, pero no el historial de jugadas; no es posible demostrar que la posición se alcanzó legalmente."
      : "El editor no conserva historial, derechos de enroque ni captura al paso. Se iniciará sin esos derechos y no es posible demostrar que la posición sea alcanzable desde la posición inicial.");
  }
  if (errors.length) return { errors, warnings, candidate: null };

  try {
    const candidate = new Chess();
    candidate.load(fenText ?? positionToFen(position, turn));
    if (candidate.isCheckmate()) errors.push("La posición es jaque mate. No se puede iniciar como una partida activa.");
    else if (candidate.isStalemate()) errors.push("La posición es tablas por ahogado. No se puede iniciar como una partida activa.");
    else if (candidate.moves().length === 0) errors.push("El bando que juega no tiene movimientos legales para continuar.");
    return { errors, warnings, candidate: errors.length ? null : candidate, whiteInCheck, blackInCheck };
  } catch (error) {
    errors.push(`La biblioteca de ajedrez no puede cargar esta posición: ${error.message}`);
    return { errors, warnings, candidate: null };
  }
}

function validateAndShowPosition() {
  const result = validatePosition(designPosition, designTurn);
  showPositionValidationResult(result, validatePositionButton);
  return result;
}

function showPositionValidationResult(result, opener) {
  if (result.errors.length) {
    openNoticeModal({
      title: "Posición no válida",
      message: "No se puede iniciar esta posición como una partida activa. Corrige las piezas indicadas y vuelve a validarla con «Validar posición».",
      errors: result.errors,
      warnings: result.warnings,
      opener,
    });
    return;
  }
  const checkedSide = result.whiteInCheck ? "blancas" : result.blackInCheck ? "negras" : null;
  const checkNotice = checkedSide ? ` El rey de las ${checkedSide} está en jaque.` : "";
  openNoticeModal({
    title: "Posición válida",
    message: `La posición ha superado las comprobaciones y el motor la acepta como una partida activa. Juegan ${designTurn === "w" ? "blancas" : "negras"}.${checkNotice} Cuando quieras continuar, pulsa «Iniciar partida».`,
    warnings: result.warnings,
    opener,
  });
}
function startDesignedGame() {
  const result = validatePosition(designPosition, designTurn);
  if (!result.candidate) {
    showPositionValidationResult(result, startDesignedGameButton);
    return;
  }
  game = result.candidate;
  gameOverNotified = false;
  captureHistoryComplete = false;
  isDesignMode = false;
  designTool = { type: null, color: designTool.color };
  designEraseMode = false;
  erasePieceButton.setAttribute("aria-pressed", "false");
  piecePalette.querySelectorAll(".palette-piece").forEach((button) => button.setAttribute("aria-pressed", "false"));
  designPosition = null;
  designTools.hidden = true;
  enterDesignButton.hidden = false;
  document.body.classList.remove("design-mode");
  resetClocks();
  clearSelection();
  lastMove = null;
  dragState?.ghost?.remove();
  dragState = null;
  suppressClick = false;
  renderBoard();
  updateDesignToolPreview();
  scheduleAutomaticEvaluation();
  showGameFinishedModal();
}

function saveCurrentPosition() {
  const fen = isDesignMode ? positionToFen(designPosition, designTurn) : game.fen({ forceEnpassantSquare: true });
  if (isDesignMode) {
    const validation = validateFen(fen);
    if (!validation.ok) {
      showDesignMessage("No se puede guardar esta posición como FEN válido.", [validation.error]);
      return;
    }
  }

  const blob = new Blob([`${fen}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "posicion_ajedrez.fen";
  downloadLink.hidden = true;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showDesignMessage("Se ha preparado la descarga posicion_ajedrez.fen con los seis campos FEN.", [], [], true);
}

function clearGameForImportedPosition(candidate) {
  closePromotionSelector();
  cancelMoveAnimation(false);
  game = candidate;
  gameOverNotified = false;
  captureHistoryComplete = false;
  resetClocks();
  clearSelection();
  lastMove = null;
  dragState?.ghost?.remove();
  dragState = null;
  suppressClick = false;
  renderBoard();
  scheduleAutomaticEvaluation();
  showGameFinishedModal();
}

function loadFenFile(file) {
  pendingDesignLoad = null;
  return file.text().then((contents) => {
    const parsed = parseFenText(contents);
    if (isDesignMode) {
      designPosition = clonePosition(parsed.position);
      designTurn = parsed.turn;
      renderDesignTurnButton();
      hideDesignMessage();
      renderBoard();
      const warnings = parsed.validation.ok ? [] : [parsed.validation.error];
      showDesignMessage("FEN cargado en Modo Diseño. Se restauran las piezas y el turno; los metadatos de partida no se conservan al editar. Valida antes de iniciar.", [], warnings, true);
      return;
    }

    const result = validatePosition(parsed.position, parsed.turn, parsed.fen, true);
    if (result.errors.length) {
      pendingDesignLoad = parsed;
      showDesignMessage("El FEN está bien formado, pero la posición no puede iniciar una partida activa.", result.errors, result.warnings, false, true);
      return;
    }

    clearGameForImportedPosition(result.candidate);
    showDesignMessage("Posición cargada desde el archivo FEN.", [], result.warnings, true);
  });
}

function loadPendingPositionIntoDesign() {
  if (!pendingDesignLoad) return;
  const pending = pendingDesignLoad;
  if (!isDesignMode) enterDesignMode();
  designPosition = clonePosition(pending.position);
  designTurn = pending.turn;
  renderDesignTurnButton();
  renderBoard();
  showDesignMessage("La posición FEN se ha cargado en Modo Diseño para que puedas corregirla.");
}
function createDragGhost(image, pointerEvent) {
  const ghost = image.cloneNode(false);
  const size = Math.max(image.getBoundingClientRect().width, image.getBoundingClientRect().height);
  ghost.className = "drag-ghost";
  ghost.style.setProperty("--drag-size", `${size}px`);
  ghost.style.left = `${pointerEvent.clientX - size / 2}px`;
  ghost.style.top = `${pointerEvent.clientY - size / 2}px`;
  document.body.append(ghost);
  return ghost;
}

function onPointerDown(event) {
  if (moveAnimationState && !isDesignMode) return;
  const squareElement = event.target.closest(".square");
  const image = squareElement?.querySelector(".piece-image");
  const square = squareElement?.dataset.square;
  if (isDesignMode) {
    if (!square || !designPosition[8 - Number(square[1])][files.indexOf(square[0])]) return;
    dragState = {
      from: square,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      image,
      ghost: null,
      design: true,
    };
    boardElement.setPointerCapture(event.pointerId);
    updateDesignToolPreview();
    return;
  }
  if (automaticPlayers[game.turn()]) return;
  const piece = square ? game.get(square) : null;
  if (!piece || piece.color !== game.turn() || game.isGameOver()) return;

  dragState = {
    from: square,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    image,
    ghost: null,
  };
  boardElement.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  if (!dragState.moved && distance < 6) return;

  if (!dragState.moved) {
    dragState.moved = true;
    dragState.ghost = createDragGhost(dragState.image, event);
    dragState.image.closest(".square").classList.add("drag-origin");
  }
  const size = Number.parseFloat(dragState.ghost.style.getPropertyValue("--drag-size"));
  dragState.ghost.style.left = `${event.clientX - size / 2}px`;
  dragState.ghost.style.top = `${event.clientY - size / 2}px`;
}

function onPointerUp(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const drag = dragState;
  dragState = null;
  drag.ghost?.remove();
  if (drag.design) {
    if (!drag.moved) {
      suppressGeneratedClick();
      handleDesignSquareClick(drag.from);
      return;
    }
    suppressGeneratedClick();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".square");
    const destination = target?.dataset.square;
    if (destination && destination !== drag.from) {
      const fromRow = 8 - Number(drag.from[1]);
      const fromColumn = files.indexOf(drag.from[0]);
      const draggedPiece = designPosition[fromRow][fromColumn];
      designPosition[fromRow][fromColumn] = null;
      if (draggedPiece) {
        placeDesignPiece(destination, draggedPiece);
        hideDesignMessage();
      }
    }
    renderBoard();
    updateDesignToolPreview();
    return;
  }
  if (!drag.moved) {
    suppressGeneratedClick();
    handleSquareClick(drag.from);
    return;
  }

  suppressGeneratedClick();
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".square");
  const destination = target?.dataset.square;
  const legalMove = destination && game.moves({ square: drag.from, verbose: true }).some((move) => move.to === destination);
  if (legalMove) {
    makeMove(drag.from, destination);
  } else {
    renderBoard();
  }
}

function onPointerCancel(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState.ghost?.remove();
  dragState = null;
  renderBoard();
  updateDesignToolPreview();
}

function resetGame() {
  closePromotionSelector();
  cancelMoveAnimation(false);
  if (isDesignMode) {
    designPosition = clonePosition(new Chess().board());
    designTurn = "w";
    renderDesignTurnButton();
    hideDesignMessage();
    renderBoard();
    return;
  }
  game.reset();
  gameOverNotified = false;
  captureHistoryComplete = true;
  resetClocks();
  clearSelection();
  lastMove = null;
  dragState?.ghost?.remove();
  dragState = null;
  suppressClick = false;
  controlViewColor = null;
  controlMap = null;
  renderBoard();
  scheduleAutomaticEvaluation();
}

function rotateBoard() {
  cancelMoveAnimation(false);
  boardFlipped = !boardFlipped;
  rotateBoardButtons.forEach((button) => button.setAttribute("aria-pressed", String(boardFlipped)));
  renderBoard();
  maybeApplyDeferredAutomaticMove();
}

function toggleControlView(color) {
  controlViewColor = controlViewColor === color ? null : color;
  renderBoard();
}

function currentPositionFen() {
  return isDesignMode
    ? positionToFen(designPosition, designTurn)
    : game.fen({ forceEnpassantSquare: true });
}

function getWhiteCentipawnScore(evaluation) {
  if (typeof evaluation.whiteScore === "number") return evaluation.whiteScore;
  return evaluation.sideToMove === "w" ? evaluation.score : -evaluation.score;
}

function renderAutomaticEvaluation() {
  const evaluation = automaticEvaluation;
  evaluationBar.classList.toggle("flipped", boardFlipped);

  let whiteShare = 50;
  let scoreText = "—";
  let statusText = "Esperando análisis";
  if (evaluation.status === "searching") {
    statusText = evaluation.depth > 0 ? `Analizando · profundidad ${evaluation.depth}` : "Analizando posición…";
    if (evaluation.scoreType) {
      const whiteScore = getWhiteCentipawnScore(evaluation);
      if (evaluation.scoreType === "mate") {
        whiteShare = whiteScore > 0 ? 98 : whiteScore < 0 ? 2 : 50;
        scoreText = `${whiteScore > 0 ? "+" : whiteScore < 0 ? "−" : ""}M${Math.abs(evaluation.score)}`;
      } else {
        whiteShare = 50 + 48 * Math.tanh(whiteScore / 600);
        scoreText = `${whiteScore > 0 ? "+" : whiteScore < 0 ? "−" : ""}${(whiteScore / 100).toFixed(1)}`;
      }
    } else {
      scoreText = "…";
    }
  } else if (evaluation.status === "ready") {
    const whiteScore = getWhiteCentipawnScore(evaluation);
    if (evaluation.scoreType === "mate") {
      whiteShare = whiteScore > 0 ? 98 : whiteScore < 0 ? 2 : 50;
      scoreText = `${whiteScore > 0 ? "+" : whiteScore < 0 ? "−" : ""}M${Math.abs(evaluation.score)}`;
    } else {
      whiteShare = 50 + 48 * Math.tanh(whiteScore / 600);
      scoreText = `${whiteScore > 0 ? "+" : whiteScore < 0 ? "−" : ""}${(whiteScore / 100).toFixed(1)}`;
    }
    statusText = `Análisis completado · profundidad ${evaluation.depth}`;
  } else if (evaluation.status === "checkmate") {
    whiteShare = evaluation.whiteScore > 0 ? 98 : 2;
    scoreText = `${evaluation.whiteScore > 0 ? "+" : "−"}M0`;
    statusText = `Jaque mate · ganan las ${evaluation.whiteScore > 0 ? "blancas" : "negras"}`;
  } else if (evaluation.status === "draw") {
    scoreText = "0.0";
    statusText = "Tablas";
  } else if (evaluation.status === "error") {
    statusText = evaluation.errorMessage || "Stockfish no está disponible";
  } else if (evaluation.status === "design") {
    statusText = "El análisis se reanuda al iniciar la partida";
  }

  whiteShare = Math.max(2, Math.min(98, whiteShare));
  evaluationWhite.style.height = `${whiteShare}%`;
  evaluationBlack.style.height = `${100 - whiteShare}%`;
  evaluationScore.textContent = scoreText;
  evaluationStatus.textContent = statusText;
  const topAdvantage = boardFlipped ? "negras" : "blancas";
  const bottomAdvantage = boardFlipped ? "blancas" : "negras";
  evaluationBar.setAttribute("aria-label", `Evaluación: ${scoreText}. ${statusText}. La barra muestra la ventaja de las ${topAdvantage} arriba y de las ${bottomAdvantage} abajo.`);
}

function setAnalysisStatus(message) {
  analysisStatus.textContent = message;
}

function updateAnalysisControls() {
  analyzeButton.disabled = analysisState?.status === "loading" || analysisState?.status === "searching";
  const automaticTurn = !isDesignMode && automaticPlayers[game.turn()];
  acceptAnalysisMoveButton.disabled = moveAnimationState !== null || automaticTurn || analysisState?.status !== "ready";
}

function clearAnalysisVariants() {
  analysisVariants.replaceChildren();
  acceptAnalysisMoveButton.disabled = true;
}

function closeAnalysisPanel() {
  pendingManualJob = null;
  if (activeStockfishJob?.kind === "manual") stopActiveStockfishSearch();
  analysisState = null;
  analysisPanel.hidden = true;
  clearAnalysisVariants();
  updateAnalysisControls();
  renderBoard();
}

function markAnalysisStale() {
  if (!analysisState || analysisState.status === "stale") return;
  const staleState = analysisState;
  analysisState.status = "stale";
  analysisState.variants = [];
  analysisState.selectedMove = null;
  clearAnalysisVariants();
  setAnalysisStatus("La posición cambió. Vuelve a analizar antes de aceptar una jugada.");
  if (pendingManualJob?.state === staleState) pendingManualJob = null;
  if (activeStockfishJob?.kind === "manual" && activeStockfishJob.state === staleState) stopActiveStockfishSearch();
  updateAnalysisControls();
}

function refreshAnalysisPositionState() {
  if (!analysisState || !analysisState.snapshotFen || analysisState.status === "stale") return;
  if (analysisState.inDesignMode !== isDesignMode || analysisState.snapshotFen !== currentPositionFen()) {
    markAnalysisStale();
  }
}

function handleStockfishFailure(message) {
  if (stockfishSearchTimer !== null) {
    window.clearTimeout(stockfishSearchTimer);
    stockfishSearchTimer = null;
  }
  const error = new Error(message);
  const worker = stockfishWorker;
  const failedJob = activeStockfishJob || preparingStockfishJob;
  stockfishWorker = null;
  stockfishReadyPromise = null;
  stockfishSearchInProgress = false;
  activeStockfishJob = null;
  pendingManualJob = null;
  pendingAutomaticJob = null;
  deferredAutomaticMove = null;
  if (stockfishHandshake) {
    window.clearTimeout(stockfishHandshake.timer);
    const { reject } = stockfishHandshake;
    stockfishHandshake = null;
    reject(error);
  }
  if (stockfishReadyWaiter) {
    window.clearTimeout(stockfishReadyWaiter.timer);
    const { reject } = stockfishReadyWaiter;
    stockfishReadyWaiter = null;
    reject(error);
  }
  worker?.terminate();
  if (analysisState) {
    analysisState.status = "error";
    analysisState.variants = [];
    analysisState.selectedMove = null;
    clearAnalysisVariants();
    setAnalysisStatus(`No se pudo usar Stockfish: ${message}`);
  }
  if (failedJob?.kind === "automatic" || automaticEvaluation.status === "searching") {
    automaticEvaluation.status = "error";
    renderAutomaticEvaluation();
  }
  updateAnalysisControls();
  renderBoard();
}

function ensureStockfishReady() {
  if (stockfishReadyPromise) return stockfishReadyPromise;

  stockfishReadyPromise = new Promise((resolve, reject) => {
    try {
      stockfishWorker = new Worker(STOCKFISH_WORKER_URL, { name: "stockfish-analysis" });
    } catch (error) {
      stockfishReadyPromise = null;
      reject(error);
      return;
    }

    stockfishWorker.addEventListener("message", (event) => handleStockfishMessage(String(event.data)));
    stockfishWorker.addEventListener("error", (event) => {
      event.preventDefault();
      handleStockfishFailure(event.message || "El Worker del motor ha fallado.");
    });
    stockfishWorker.addEventListener("messageerror", () => handleStockfishFailure("El motor envió una respuesta que no se pudo leer."));
    stockfishHandshake = {
      stage: "uci",
      resolve,
      reject,
      timer: window.setTimeout(() => handleStockfishFailure("Stockfish tardó demasiado en inicializarse."), 30000),
    };
    stockfishWorker.postMessage("uci");
  });

  return stockfishReadyPromise;
}

function waitForStockfishReady() {
  return new Promise((resolve, reject) => {
    if (!stockfishWorker || stockfishReadyWaiter) {
      reject(new Error("El motor no está disponible para iniciar una búsqueda."));
      return;
    }
    stockfishReadyWaiter = {
      resolve,
      reject,
      timer: window.setTimeout(() => handleStockfishFailure("Stockfish no respondió a tiempo."), 15000),
    };
    stockfishWorker.postMessage("isready");
  });
}

function isAutomaticJobPositionCurrent(job) {
  return !isDesignMode && automaticEvaluation.requestId === job.id
    && game.fen({ forceEnpassantSquare: true }) === job.fen;
}

function isAutomaticPlayerJobCurrent(job) {
  return isAutomaticJobPositionCurrent(job)
    && automaticPlayers[job.sideToMove]
    && game.turn() === job.sideToMove
    && automaticPlayerGeneration[job.sideToMove] === job.playerGeneration
    && !game.isGameOver();
}

function showAutomaticMoveError(message) {
  automaticEvaluation = { ...automaticEvaluation, status: "error", errorMessage: message };
  renderAutomaticEvaluation();
}

function maybeApplyDeferredAutomaticMove() {
  const pending = deferredAutomaticMove;
  if (!pending) return;
  const { job, pv } = pending;
  if (!isAutomaticPlayerJobCurrent(job)) {
    deferredAutomaticMove = null;
    return;
  }
  if (moveAnimationState || pendingManualJob || pendingAutomaticJob || stockfishPreparationInProgress
    || stockfishSearchInProgress || activeStockfishJob || preparingStockfishJob
    || ["loading", "searching"].includes(analysisState?.status)) return;
  if (!pv) {
    deferredAutomaticMove = null;
    showAutomaticMoveError("Stockfish no devolvió una jugada principal.");
    return;
  }

  let move;
  try {
    move = parseUciMove(pv.split(/\s+/)[0]);
  } catch (error) {
    deferredAutomaticMove = null;
    showAutomaticMoveError(error.message || "Stockfish devolvió una jugada no reconocida.");
    return;
  }
  const legalMove = game.moves({ verbose: true }).find((candidate) =>
    candidate.from === move.from && candidate.to === move.to && (candidate.promotion ?? null) === (move.promotion ?? null));
  if (!legalMove) {
    deferredAutomaticMove = null;
    showAutomaticMoveError("La jugada principal de Stockfish no es legal en la posición actual.");
    return;
  }

  deferredAutomaticMove = null;
  automaticMoveInProgress = true;
  let moved = false;
  try {
    moved = makeMove(move.from, move.to, move.promotion ?? null);
  } finally {
    automaticMoveInProgress = false;
  }
  if (!moved) showAutomaticMoveError("No se pudo aplicar la jugada automática.");
}

function isStockfishJobCurrent(job) {
  if (job.kind === "automatic") return isAutomaticJobPositionCurrent(job) && !pendingManualJob;
  return analysisState === job.state && ["loading", "searching"].includes(job.state.status)
    && job.state.inDesignMode === isDesignMode && currentPositionFen() === job.fen;
}

function stopActiveStockfishSearch() {
  if (!stockfishSearchInProgress || !stockfishWorker) return;
  try {
    stockfishWorker.postMessage("stop");
  } catch {
    handleStockfishFailure("No se pudo detener el análisis anterior.");
  }
}

function queueStockfishJob(job) {
  if (job.kind === "manual") {
    if (preparingStockfishJob?.kind === "automatic" && isAutomaticJobPositionCurrent(preparingStockfishJob)) {
      pendingAutomaticJob = preparingStockfishJob;
    }
    pendingManualJob = job;
    if (activeStockfishJob?.kind === "automatic" && isAutomaticJobPositionCurrent(activeStockfishJob)) {
      pendingAutomaticJob = pendingAutomaticJob || activeStockfishJob;
      stopActiveStockfishSearch();
    }
  } else {
    pendingAutomaticJob = job;
    if (activeStockfishJob && activeStockfishJob.fen !== job.fen) stopActiveStockfishSearch();
  }
  void pumpStockfishQueue();
}

async function pumpStockfishQueue() {
  if (stockfishPreparationInProgress || stockfishSearchInProgress) return;
  const job = pendingManualJob || pendingAutomaticJob;
  if (!job) return;
  if (job.kind === "manual") pendingManualJob = null;
  else pendingAutomaticJob = null;
  if (!isStockfishJobCurrent(job)) {
    void pumpStockfishQueue();
    return;
  }

  stockfishPreparationInProgress = true;
  preparingStockfishJob = job;
  updateAnalysisControls();
  try {
    await ensureStockfishReady();
    if (!isStockfishJobCurrent(job)) return;
    stockfishWorker.postMessage(`setoption name MultiPV value ${job.kind === "manual" ? job.state.expectedLines : 1}`);
    await waitForStockfishReady();
    if (!isStockfishJobCurrent(job)) return;

    activeStockfishJob = job;
    stockfishSearchInProgress = true;
    if (job.kind === "manual") {
      job.state.status = "searching";
      setAnalysisStatus("Analizando posición…");
    } else {
      automaticEvaluation.status = "searching";
      renderAutomaticEvaluation();
    }
    updateAnalysisControls();
    stockfishWorker.postMessage(`position fen ${job.fen}`);
    stockfishWorker.postMessage(`go depth ${job.kind === "manual" ? STOCKFISH_SEARCH_DEPTH : 10}`);
    stockfishSearchTimer = window.setTimeout(
      () => handleStockfishFailure("El motor superó el tiempo máximo de análisis."),
      job.kind === "manual" ? STOCKFISH_SEARCH_TIMEOUT : 25000,
    );
  } catch (error) {
    if (isStockfishJobCurrent(job)) {
      if (job.kind === "manual") {
        job.state.status = "error";
        setAnalysisStatus(error.message || "No se pudo analizar esta posición.");
        clearAnalysisVariants();
      } else {
        automaticEvaluation.status = "error";
        renderAutomaticEvaluation();
      }
    }
  } finally {
    stockfishPreparationInProgress = false;
    preparingStockfishJob = null;
    updateAnalysisControls();
    if (!stockfishSearchInProgress) {
      void pumpStockfishQueue();
      maybeApplyDeferredAutomaticMove();
    }
  }
}

function scheduleAutomaticEvaluation() {
  if (isDesignMode) return;
  deferredAutomaticMove = null;
  const fen = game.fen({ forceEnpassantSquare: true });
  const requestId = ++automaticEvaluationRequestId;
  pendingAutomaticJob = null;

  if (game.isCheckmate()) {
    const whiteWon = game.turn() === "b";
    automaticEvaluation = { fen, requestId, status: "checkmate", whiteScore: whiteWon ? 1 : -1 };
    if (activeStockfishJob) stopActiveStockfishSearch();
    renderAutomaticEvaluation();
    return;
  }
  if (game.isDraw() || game.isStalemate() || game.isGameOver()) {
    automaticEvaluation = { fen, requestId, status: "draw", scoreType: "cp", score: 0, sideToMove: game.turn(), depth: 0 };
    if (activeStockfishJob) stopActiveStockfishSearch();
    renderAutomaticEvaluation();
    return;
  }

  automaticEvaluation = { fen, requestId, status: "searching", scoreType: null, score: 0, sideToMove: game.turn(), depth: 0 };
  renderAutomaticEvaluation();
  const sideToMove = game.turn();
  queueStockfishJob({ kind: "automatic", id: requestId, fen, sideToMove, playerGeneration: automaticPlayerGeneration[sideToMove] });
}

function cancelAutomaticEvaluationForDesign() {
  automaticEvaluationRequestId += 1;
  pendingAutomaticJob = null;
  deferredAutomaticMove = null;
  if (activeStockfishJob?.kind === "automatic") stopActiveStockfishSearch();
  automaticEvaluation = { fen: null, status: "design", scoreType: null, score: 0, depth: 0 };
  renderAutomaticEvaluation();
}

function parseStockfishInfo(line) {
  if (!line.startsWith("info ") || /\b(?:lowerbound|upperbound)\b/.test(line)) return;
  const depth = Number(line.match(/\bdepth (\d+)\b/)?.[1]);
  const multipv = Number(line.match(/\bmultipv (\d+)\b/)?.[1] ?? 1);
  const score = line.match(/\bscore (cp|mate) (-?\d+)\b/);
  const pv = line.match(/\bpv (.+)$/);
  const job = activeStockfishJob;
  if (!depth || !score || !job) return;
  if (job.kind === "automatic") {
    if (!isAutomaticJobPositionCurrent(job) || depth < automaticEvaluation.depth) return;
    automaticEvaluation = {
      ...automaticEvaluation,
      status: "searching",
      scoreType: score[1],
      score: Number(score[2]),
      sideToMove: job.sideToMove,
      depth,
      ...(multipv === 1 && pv ? { principalVariation: pv[1].trim() } : {}),
    };
    renderAutomaticEvaluation();
    return;
  }
  if (!pv || analysisState !== job.state || job.state.status !== "searching") return;
  const previous = job.state.lines.get(multipv);
  if (!previous || depth >= previous.depth) {
    job.state.lines.set(multipv, {
      depth,
      scoreType: score[1],
      score: Number(score[2]),
      pv: pv[1].trim(),
    });
  }
}

function handleStockfishMessage(line) {
  if (line === "uciok" && stockfishHandshake?.stage === "uci") {
    stockfishHandshake.stage = "ready";
    stockfishWorker.postMessage("setoption name Threads value 1");
    stockfishWorker.postMessage("isready");
    return;
  }
  if (line === "readyok") {
    if (stockfishHandshake?.stage === "ready") {
      window.clearTimeout(stockfishHandshake.timer);
      const { resolve } = stockfishHandshake;
      stockfishHandshake = null;
      resolve();
      updateAnalysisControls();
    } else if (stockfishReadyWaiter) {
      window.clearTimeout(stockfishReadyWaiter.timer);
      const { resolve } = stockfishReadyWaiter;
      stockfishReadyWaiter = null;
      resolve();
      updateAnalysisControls();
    }
    return;
  }
  if (line.startsWith("info ")) {
    parseStockfishInfo(line);
    return;
  }
  if (line.startsWith("bestmove ")) finishStockfishSearch();
}

function parseUciMove(uciMove) {
  const match = uciMove.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
  if (!match) throw new Error("Stockfish devolvió una jugada con formato no reconocido.");
  return { from: match[1], to: match[2], ...(match[3] ? { promotion: match[3] } : {}) };
}

function convertPrincipalVariationToSan(fen, pv) {
  const position = new Chess(fen);
  const moves = [];
  for (const uciMove of pv.split(/\s+/).slice(0, 12)) {
    const move = position.move(parseUciMove(uciMove));
    if (!move) throw new Error("La variante devuelta por Stockfish no es legal en esta posición.");
    moves.push(move);
  }
  if (!moves.length) throw new Error("Stockfish no devolvió una secuencia de jugadas.");

  const fields = fen.split(/\s+/);
  let turn = fields[1];
  let moveNumber = Number(fields[5]) || 1;
  const sanMoves = moves.map((move, index) => {
    if (turn === "w") {
      turn = "b";
      return `${moveNumber}. ${move.san}`;
    }
    const prefix = index === 0 ? `${moveNumber}... ` : "";
    turn = "w";
    moveNumber += 1;
    return `${prefix}${move.san}`;
  });

  return { firstMove: parseUciMove(pv.split(/\s+/)[0]), sanLine: sanMoves.join(" ") };
}

function formatStockfishScore(line, rootColor) {
  const whiteScore = rootColor === "w" ? line.score : -line.score;
  const sign = whiteScore > 0 ? "+" : whiteScore < 0 ? "−" : "";
  if (line.scoreType === "mate") {
    const side = whiteScore > 0 ? "blancas" : "negras";
    return `${sign}M${Math.abs(whiteScore)} · mate para ${side}`;
  }
  const advantage = whiteScore === 0 ? "igualdad" : `ventaja ${whiteScore > 0 ? "blancas" : "negras"}`;
  return `${sign}${(whiteScore / 100).toFixed(2)} · ${advantage}`;
}

function selectAnalysisVariant(rank) {
  if (!analysisState || analysisState.status !== "ready") return;
  const variant = analysisState.variants.find((item) => item.rank === rank);
  if (!variant) return;
  analysisState.selectedRank = rank;
  analysisState.selectedMove = variant.firstMove;
  renderAnalysisVariants();
  renderBoard();
}

function renderAnalysisVariants() {
  if (!analysisState) return;
  analysisVariants.replaceChildren(...analysisState.variants.map((variant) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const title = document.createElement("span");
    const line = document.createElement("span");
    button.type = "button";
    button.className = `reset-button analysis-variant${variant.rank === analysisState.selectedRank ? " is-selected" : ""}`;
    button.setAttribute("aria-pressed", String(variant.rank === analysisState.selectedRank));
    button.addEventListener("click", () => selectAnalysisVariant(variant.rank));
    title.className = "analysis-variant-title";
    title.textContent = `Variante ${variant.rank} · ${variant.evaluation}`;
    line.className = "analysis-variant-line";
    line.textContent = variant.sanLine;
    button.append(title, line);
    item.append(button);
    return item;
  }));
  updateAnalysisControls();
}

function finishStockfishSearch() {
  stockfishSearchInProgress = false;
  if (stockfishSearchTimer !== null) {
    window.clearTimeout(stockfishSearchTimer);
    stockfishSearchTimer = null;
  }
  const job = activeStockfishJob;
  activeStockfishJob = null;
  if (job?.kind === "automatic" && isAutomaticJobPositionCurrent(job)) {
    automaticEvaluation.status = automaticEvaluation.depth > 0 ? "ready" : "error";
    if (isAutomaticPlayerJobCurrent(job)) {
      deferredAutomaticMove = { job, pv: automaticEvaluation.principalVariation };
    }
    renderAutomaticEvaluation();
  } else if (job?.kind === "manual") {
    finishManualStockfishSearch();
  }
  updateAnalysisControls();
  void pumpStockfishQueue();
  maybeApplyDeferredAutomaticMove();
}

function finishManualStockfishSearch() {
  stockfishSearchInProgress = false;
  if (stockfishSearchTimer !== null) {
    window.clearTimeout(stockfishSearchTimer);
    stockfishSearchTimer = null;
  }
  if (!analysisState || analysisState.status !== "searching") {
    updateAnalysisControls();
    return;
  }
  if (analysisState.snapshotFen !== currentPositionFen() || analysisState.inDesignMode !== isDesignMode) {
    markAnalysisStale();
    updateAnalysisControls();
    return;
  }

  const lines = [...analysisState.lines.entries()]
    .filter(([, line]) => line.depth >= STOCKFISH_SEARCH_DEPTH)
    .sort(([rankA], [rankB]) => rankA - rankB);
  if (lines.length < analysisState.expectedLines) {
    analysisState.status = "error";
    setAnalysisStatus("El motor no terminó todas las variantes solicitadas. Inténtalo de nuevo.");
    clearAnalysisVariants();
    updateAnalysisControls();
    return;
  }

  try {
    analysisState.variants = lines.map(([rank, line]) => {
      const variation = convertPrincipalVariationToSan(analysisState.snapshotFen, line.pv);
      return {
        rank,
        ...variation,
        firstSan: variation.sanLine.split(/\s+/).slice(0, 2).join(" "),
        sanLine: variation.sanLine,
        evaluation: formatStockfishScore(line, analysisState.sideToMove),
      };
    });
    analysisState.status = "ready";
    analysisState.selectedRank = analysisState.variants[0].rank;
    analysisState.selectedMove = analysisState.variants[0].firstMove;
    setAnalysisStatus(`Análisis completo a profundidad ${STOCKFISH_SEARCH_DEPTH}. Selecciona una variante.`);
    renderAnalysisVariants();
    renderBoard();
  } catch (error) {
    analysisState.status = "error";
    analysisState.variants = [];
    analysisState.selectedMove = null;
    clearAnalysisVariants();
    setAnalysisStatus(`No se pudo interpretar la respuesta del motor: ${error.message}`);
    renderBoard();
  }
  updateAnalysisControls();
}

function analyzeCurrentPosition() {
  if (analysisState?.status === "loading" || analysisState?.status === "searching") return;
  const fen = currentPositionFen();
  analysisState = {
    snapshotFen: fen,
    inDesignMode: isDesignMode,
    sideToMove: fen.split(/\s+/)[1],
    status: "loading",
    lines: new Map(),
    variants: [],
    selectedMove: null,
  };
  analysisPanel.hidden = false;
  clearAnalysisVariants();
  setAnalysisStatus("Preparando motor…");
  updateAnalysisControls();

  try {
    const validation = validateFen(fen);
    if (!validation.ok) throw new Error(`La posición FEN no es válida: ${validation.error}`);
    const position = new Chess(fen);
    const legalMoves = position.moves({ verbose: true });
    if (!legalMoves.length) throw new Error("La posición no tiene jugadas legales que analizar.");
    analysisState.expectedLines = Math.min(3, legalMoves.length);
    queueStockfishJob({ kind: "manual", fen, state: analysisState });
  } catch (error) {
    if (!analysisState || analysisState.status === "stale") return;
    analysisState.status = "error";
    clearAnalysisVariants();
    setAnalysisStatus(error.message || "No se pudo analizar esta posición.");
    updateAnalysisControls();
  }
}

function acceptSelectedAnalysisMove() {
  if (moveAnimationState) return;
  if (!isDesignMode && automaticPlayers[game.turn()]) return;
  if (!analysisState || analysisState.status !== "ready") return;
  if (analysisState.inDesignMode !== isDesignMode || analysisState.snapshotFen !== currentPositionFen()) {
    markAnalysisStale();
    return;
  }
  const variant = analysisState.variants.find((item) => item.rank === analysisState.selectedRank);
  if (!variant) return;
  const move = variant.firstMove;
  const moveOptions = { from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) };

  if (isDesignMode) {
    try {
      const candidate = new Chess(analysisState.snapshotFen);
      if (!candidate.move(moveOptions)) throw new Error("La jugada ya no es legal en esta posición.");
      const nextPosition = clonePosition(candidate.board());
      const nextTurn = candidate.turn();
      closeAnalysisPanel();
      designPosition = nextPosition;
      designTurn = nextTurn;
      renderDesignTurnButton();
      hideDesignMessage();
      renderBoard();
    } catch (error) {
      analysisState.status = "error";
      setAnalysisStatus(error.message);
      updateAnalysisControls();
    }
    return;
  }

  const legalMove = game.moves({ verbose: true }).find((candidate) =>
    candidate.from === move.from && candidate.to === move.to && (candidate.promotion ?? null) === (move.promotion ?? null));
  if (!legalMove) {
    markAnalysisStale();
    return;
  }
  closeAnalysisPanel();
  makeMove(move.from, move.to, move.promotion ?? null);
}

analyzeButton.addEventListener("click", analyzeCurrentPosition);
acceptAnalysisMoveButton.addEventListener("click", acceptSelectedAnalysisMove);
cancelAnalysisButton.addEventListener("click", closeAnalysisPanel);
promotionOptionButtons.forEach((button) => button.addEventListener("click", () => {
  if (!pendingPromotion) return;
  const { from, to } = pendingPromotion;
  const promotion = button.dataset.promotion;
  closePromotionSelector();
  makeMove(from, to, promotion);
}));
cancelPromotionButton.addEventListener("click", () => closePromotionSelector(true));
cancelPromotionTextButton.addEventListener("click", () => closePromotionSelector(true));
promotionOverlay.addEventListener("click", (event) => {
  if (event.target === promotionOverlay) closePromotionSelector(true);
});
promotionOverlay.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closePromotionSelector(true);
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...promotionDialog.querySelectorAll("button")];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

boardElement.addEventListener("click", (event) => {
  if (suppressClick && event.detail > 0) {
    suppressClick = false;
    return;
  }
  const square = event.target.closest(".square");
  if (square) handleSquareClick(square.dataset.square);
});
boardElement.addEventListener("pointerdown", onPointerDown);
boardElement.addEventListener("pointermove", onPointerMove);
boardElement.addEventListener("pointerup", onPointerUp);
boardElement.addEventListener("pointercancel", onPointerCancel);
resetButton.addEventListener("click", resetGame);
rotateBoardButtons.forEach((button) => button.addEventListener("click", rotateBoard));
whiteControlButton.addEventListener("click", () => toggleControlView("w"));
blackControlButton.addEventListener("click", () => toggleControlView("b"));
enterDesignButton.addEventListener("click", enterDesignMode);
savePositionButton.addEventListener("click", saveCurrentPosition);
loadPositionButton.addEventListener("click", () => positionFileInput.click());
positionFileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  loadFenFile(file)
    .catch((error) => showDesignMessage("No se pudo leer el archivo FEN.", [error.message]))
    .finally(() => { positionFileInput.value = ""; });
});
loadInDesignButton.addEventListener("click", loadPendingPositionIntoDesign);
designTurnButton.addEventListener("click", toggleDesignTurn);
erasePieceButton.addEventListener("click", () => {
  designTool = { type: null, color: designTool.color };
  designEraseMode = true;
  erasePieceButton.setAttribute("aria-pressed", "true");
  piecePalette.querySelectorAll(".palette-piece").forEach((button) => button.setAttribute("aria-pressed", "false"));
  updateDesignToolPreview();
});
clearBoardButton.addEventListener("click", () => {
  cancelDesignTool();
  designPosition = Array.from({ length: 8 }, () => Array(8).fill(null));
  hideDesignMessage();
  renderBoard();
});
initialPositionButton.addEventListener("click", () => {
  cancelDesignTool();
  designPosition = clonePosition(new Chess().board());
  designTurn = "w";
  renderDesignTurnButton();
  hideDesignMessage();
  renderBoard();
});
validatePositionButton.addEventListener("click", validateAndShowPosition);
startDesignedGameButton.addEventListener("click", startDesignedGame);
document.querySelector("#close-design-message").addEventListener("click", hideDesignMessage);
document.addEventListener("keydown", handleDesignToolKeydown, true);
document.addEventListener("pointermove", trackDesignToolPointer, { passive: true });
document.addEventListener("pointerdown", trackDesignToolPointer, { passive: true });
window.addEventListener("resize", () => {
  cancelMoveAnimation();
  updateDesignToolPreview();
  updatePromotionSelectorPosition();
  maybeApplyDeferredAutomaticMove();
});
window.addEventListener("scroll", () => {
  cancelMoveAnimation();
  updatePromotionSelectorPosition();
}, { capture: true, passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") updateClockDisplay(true);
});
updateClockDisplay(true);
await initializePieceStyles();
renderBoard();
scheduleAutomaticEvaluation();
if (!isWelcomeDismissed()) openWelcomeModal();
