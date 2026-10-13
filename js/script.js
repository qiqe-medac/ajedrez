import { Chess, validateFen } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";

const boardElement = document.querySelector("#chessboard");
const boardFilesTop = document.querySelector(".board-files-top");
const boardFilesBottom = document.querySelector(".board-files-bottom");
const boardRanksLeft = document.querySelector(".board-ranks-left");
const boardRanksRight = document.querySelector(".board-ranks-right");
const designTools = document.querySelector("#design-tools");
const enterDesignButton = document.querySelector("#enter-design-button");
const designColorSelect = document.querySelector("#design-color");
const designTurnSelect = document.querySelector("#design-turn");
const validationLevelSelect = document.querySelector("#validation-level");
const piecePalette = document.querySelector("#piece-palette");
const erasePieceButton = document.querySelector("#erase-piece-button");
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
const rotateBoardButton = document.querySelector("#rotate-board-button");
const whiteControlButton = document.querySelector("#white-control-button");
const blackControlButton = document.querySelector("#black-control-button");
const chessClocksElement = document.querySelector("#chess-clocks");
const files = "abcdefgh";
const pieceNames = { k: "rey", q: "dama", r: "torre", b: "alfil", n: "caballo", p: "peón" };
const pieceColors = { w: "white", b: "black" };
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
let selectedSquare = null;
let legalMoves = [];
let lastMove = null;
let dragState = null;
let suppressClick = false;
let boardFlipped = false;
let controlViewColor = null;
let controlMap = null;
let isDesignMode = false;
let designPosition = null;
let designTurn = "w";
let designTool = { type: "q", color: "w" };
let pendingDesignLoad = null;
const designPieceTypes = ["k", "q", "r", "b", "n", "p"];
const chessClock = {
  elapsed: { w: 0, b: 0 },
  activeColor: null,
  startedAt: null,
  state: "ready",
  intervalId: null,
};
let displayedClockSeconds = { w: null, b: null };

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
  piecePalette.replaceChildren(...designPieceTypes.map((type) => {
    const button = document.createElement("button");
    const image = document.createElement("img");
    const label = document.createElement("span");
    button.className = "palette-piece";
    button.type = "button";
    button.setAttribute("aria-pressed", String(designTool.type === type));
    button.setAttribute("aria-label", `Seleccionar ${pieceNames[type]} ${designColorSelect.value === "w" ? "blanco" : "negro"}`);
    image.src = `pieces/${pieceColors[designColorSelect.value]}-${{ k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" }[type]}.svg`;
    image.alt = "";
    label.textContent = pieceNames[type];
    button.append(image, label);
    button.addEventListener("click", () => {
      designTool = { type, color: designColorSelect.value };
      erasePieceButton.setAttribute("aria-pressed", "false");
      renderPiecePalette();
    });
    return button;
  }));
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
  const type = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" }[piece.type];
  image.className = "piece-image";
  image.src = `pieces/${color}-${type}.svg`;
  image.alt = `${pieceNames[piece.type]} ${color === "white" ? "blanco" : "negro"}`;
  image.draggable = false;
  image.dataset.square = coordinate;
  square.append(image);
}

function renderBoard() {
  const position = isDesignMode ? designPosition : game.board();
  controlMap = controlViewColor ? calculateControlMap(position, controlViewColor) : null;
  const checkSquare = !isDesignMode && game.isCheck() ? getKingSquare(game.turn(), position) : null;
  const legalDestinations = new Map((isDesignMode ? [] : legalMoves).map((move) => [move.to, move]));
  boardElement.classList.toggle("flipped", boardFlipped);
  chessClocksElement.classList.toggle("flipped", boardFlipped);
  renderCoordinates();
  boardElement.replaceChildren();

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const coordinate = toSquareName(row, column);
      const piece = position[row][column];
      const controlCount = controlMap?.[row][column] ?? 0;
      const square = document.createElement("div");
      const classes = ["square", (row + column) % 2 === 0 ? "light" : "dark"];
      if (controlCount > 0) classes.push(`control-level-${Math.min(controlCount, 4)}`);
      if (coordinate === selectedSquare) classes.push("selected");
      if (!isDesignMode && (coordinate === lastMove?.from || coordinate === lastMove?.to)) classes.push("last-move");
      if (coordinate === checkSquare) classes.push("in-check");
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

function makeMove(from, to) {
  try {
    const moverColor = game.turn();
    const move = game.move({ from, to, promotion: "q" });
    switchClock(moverColor, game.turn());
    lastMove = { from: move.from, to: move.to };
    clearSelection();
    renderBoard();
    return true;
  } catch {
    return false;
  }
}

function handleSquareClick(coordinate) {
  if (isDesignMode) {
    handleDesignSquareClick(coordinate);
    return;
  }
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
  if (designTool.type === null) {
    designPosition[row][file] = null;
  } else {
    designPosition[row][file] = { type: designTool.type, color: designColorSelect.value };
  }
  hideDesignMessage();
  renderBoard();
}

function enterDesignMode() {
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
  designTurnSelect.value = designTurn;
  designTool = { type: "q", color: designColorSelect.value };
  erasePieceButton.setAttribute("aria-pressed", "false");
  isDesignMode = true;
  designTools.hidden = false;
  enterDesignButton.hidden = true;
  document.body.classList.add("design-mode");
  hideDesignMessage();
  renderPiecePalette();
  renderBoard();
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
  if (result.errors.length) {
    showDesignMessage("La posición no se puede iniciar. Puedes corregirla sin perder las piezas.", result.errors, result.warnings);
    return result;
  }
  const checkedSide = result.whiteInCheck ? "blancas" : result.blackInCheck ? "negras" : null;
  const status = `Posición válida. Juegan ${designTurn === "w" ? "blancas" : "negras"}${checkedSide ? ` y están en jaque las ${checkedSide}` : ""}.`;
  showDesignMessage(status, [], result.warnings, true);
  return result;
}
function startDesignedGame() {
  const result = validateAndShowPosition();
  if (!result.candidate) return;
  game = result.candidate;
  isDesignMode = false;
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
  game = candidate;
  resetClocks();
  clearSelection();
  lastMove = null;
  dragState?.ghost?.remove();
  dragState = null;
  suppressClick = false;
  renderBoard();
}

function loadFenFile(file) {
  pendingDesignLoad = null;
  return file.text().then((contents) => {
    const parsed = parseFenText(contents);
    if (isDesignMode) {
      designPosition = clonePosition(parsed.position);
      designTurn = parsed.turn;
      designTurnSelect.value = parsed.turn;
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
  designTurnSelect.value = pending.turn;
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
    return;
  }
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
      const toRow = 8 - Number(destination[1]);
      const toColumn = files.indexOf(destination[0]);
      designPosition[toRow][toColumn] = designPosition[fromRow][fromColumn];
      designPosition[fromRow][fromColumn] = null;
      hideDesignMessage();
    }
    renderBoard();
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
}

function resetGame() {
  if (isDesignMode) {
    designPosition = clonePosition(new Chess().board());
    designTurn = "w";
    designTurnSelect.value = "w";
    hideDesignMessage();
    renderBoard();
    return;
  }
  game.reset();
  resetClocks();
  clearSelection();
  lastMove = null;
  dragState?.ghost?.remove();
  dragState = null;
  suppressClick = false;
  controlViewColor = null;
  controlMap = null;
  renderBoard();
}

function rotateBoard() {
  boardFlipped = !boardFlipped;
  rotateBoardButton.setAttribute("aria-pressed", String(boardFlipped));
  renderBoard();
}

function toggleControlView(color) {
  controlViewColor = controlViewColor === color ? null : color;
  renderBoard();
}

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
rotateBoardButton.addEventListener("click", rotateBoard);
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
designColorSelect.addEventListener("change", renderPiecePalette);
designTurnSelect.addEventListener("change", () => {
  designTurn = designTurnSelect.value;
  hideDesignMessage();
  renderBoard();
});
erasePieceButton.addEventListener("click", () => {
  designTool = { type: null, color: designColorSelect.value };
  erasePieceButton.setAttribute("aria-pressed", "true");
  piecePalette.querySelectorAll(".palette-piece").forEach((button) => button.setAttribute("aria-pressed", "false"));
});
clearBoardButton.addEventListener("click", () => {
  designPosition = Array.from({ length: 8 }, () => Array(8).fill(null));
  hideDesignMessage();
  renderBoard();
});
initialPositionButton.addEventListener("click", () => {
  designPosition = clonePosition(new Chess().board());
  designTurn = "w";
  designTurnSelect.value = "w";
  hideDesignMessage();
  renderBoard();
});
validatePositionButton.addEventListener("click", validateAndShowPosition);
startDesignedGameButton.addEventListener("click", startDesignedGame);
document.querySelector("#close-design-message").addEventListener("click", hideDesignMessage);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") updateClockDisplay(true);
});
updateClockDisplay(true);
renderBoard();
