import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";

const boardElement = document.querySelector("#chessboard");
const boardFilesTop = document.querySelector(".board-files-top");
const boardFilesBottom = document.querySelector(".board-files-bottom");
const boardRanksLeft = document.querySelector(".board-ranks-left");
const boardRanksRight = document.querySelector(".board-ranks-right");
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

const game = new Chess();
let selectedSquare = null;
let legalMoves = [];
let lastMove = null;
let dragState = null;
let suppressClick = false;
let boardFlipped = false;
let controlViewColor = null;
let controlMap = null;
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
  const position = game.board();
  controlMap = controlViewColor ? calculateControlMap(position, controlViewColor) : null;
  const checkSquare = game.isCheck() ? getKingSquare(game.turn(), position) : null;
  const legalDestinations = new Map(legalMoves.map((move) => [move.to, move]));
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
      if (coordinate === lastMove?.from || coordinate === lastMove?.to) classes.push("last-move");
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

  const isWhiteTurn = game.turn() === "w";
  turnLabel.textContent = isWhiteTurn ? "Blancas" : "Negras";
  turnIndicator.classList.toggle("black-to-move", !isWhiteTurn);
  whiteControlButton.setAttribute("aria-pressed", String(controlViewColor === "w"));
  blackControlButton.setAttribute("aria-pressed", String(controlViewColor === "b"));
  whiteControlButton.classList.toggle("is-active", controlViewColor === "w");
  blackControlButton.classList.toggle("is-active", controlViewColor === "b");
  panelNote.textContent = getGameMessage();
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
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") updateClockDisplay(true);
});
updateClockDisplay(true);
renderBoard();
