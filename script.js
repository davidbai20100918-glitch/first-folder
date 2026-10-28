"use strict";

/* =========================================================
   基础设置
   ========================================================= */

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const HUMAN = 1; // 玩家：红棋
const AI = 2; // AI：黄棋
const WIN_SCORE = 1_000_000;
const CENTER_FIRST = [3, 2, 4, 1, 5, 0, 6];

const DIFFICULTY_NOTES = {
  easy: "Easy — a relaxed opponent that often plays at random.",
  medium: "Medium — a balanced opponent that blocks your obvious threats.",
  hard: "Hard — a sharp opponent that plans several moves ahead.",
};

const boardEl = document.getElementById("board");
const turnIndicator = document.getElementById("turn-indicator");
const newGameBtn = document.getElementById("new-game");
const startGameBtn = document.getElementById("start-game");
const difficultySelect = document.getElementById("difficulty");
const difficultyNote = document.getElementById("difficulty-note");
const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const boardHint = document.getElementById("board-hint");

let board = createEmptyBoard();
let currentTurn = HUMAN;
let difficulty = difficultySelect.value;
let gameStarted = false;
let gameOver = true;
let lastMove = null;
let winningCells = new Set();
let aiTimeoutId = null;
let gameId = 0;

/* =========================================================
   开始 / 重置一局游戏
   ========================================================= */

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function startGame() {
  // 取消上一局尚未执行的 AI 落子，避免旧计时器影响新棋局。
  cancelAiMove();
  gameId += 1;

  board = createEmptyBoard();
  currentTurn = HUMAN;
  difficulty = difficultySelect.value;
  gameOver = false;
  gameStarted = true;
  lastMove = null;
  winningCells = new Set();

  startScreen.hidden = true;
  gameScreen.hidden = false;

  turnIndicator.classList.remove("is-thinking");
  turnIndicator.textContent = "Your turn";
  boardHint.textContent =
    "Choose a column to drop your disc. First to connect four wins.";

  renderBoard();
}

/* =========================================================
   棋盘渲染与玩家操作
   ========================================================= */

function buildBoardUi() {
  boardEl.innerHTML = "";

  for (let col = 0; col < COLS; col += 1) {
    const column = document.createElement("button");
    column.type = "button";
    column.className = "column";
    column.dataset.col = String(col);
    column.setAttribute("aria-label", `Drop a disc in column ${col + 1}`);

    for (let row = 0; row < ROWS; row += 1) {
      const slot = document.createElement("span");
      slot.className = "slot";
      slot.dataset.row = String(row);
      slot.setAttribute("aria-hidden", "true");

      const disc = document.createElement("span");
      disc.className = "disc";
      slot.appendChild(disc);

      column.appendChild(slot);
    }

    boardEl.appendChild(column);
  }
}

function renderBoard() {
  const isPlayerTurn = gameStarted && !gameOver && currentTurn === HUMAN;
  const columns = boardEl.querySelectorAll(".column");

  columns.forEach((column, col) => {
    const columnFull = !isColumnPlayable(board, col);
    const slots = column.querySelectorAll(".slot");

    slots.forEach((slot, row) => {
      const value = board[row][col];
      const disc = slot.firstElementChild;

      slot.className = "slot";
      disc.className = "disc";

      if (value !== EMPTY) {
        slot.classList.add(value === HUMAN ? "player-1" : "player-2");

        if (lastMove && lastMove.row === row && lastMove.col === col) {
          slot.classList.add("dropped");
        }

        if (winningCells.has(`${row},${col}`)) {
          slot.classList.add("winning");
        }
      }
    });

    // 只有轮到玩家且该列未满时，按钮才可以点击。
    column.disabled = !isPlayerTurn || columnFull;
    column.setAttribute(
      "aria-label",
      columnFull
        ? `Column ${col + 1}, full`
        : `Drop a disc in column ${col + 1}`,
    );
  });

  const boardLabel = !gameStarted
    ? "Connect 4 board, game not started"
    : gameOver
      ? "Connect 4 board, game over"
      : currentTurn === HUMAN
        ? "Connect 4 board, your turn"
        : "Connect 4 board, AI thinking";

  boardEl.setAttribute("aria-label", boardLabel);
  boardEl.setAttribute(
    "aria-busy",
    String(gameStarted && !gameOver && currentTurn === AI),
  );
}

function handleHumanMove(col) {
  if (
    !gameStarted ||
    gameOver ||
    currentTurn !== HUMAN ||
    !isColumnPlayable(board, col)
  ) {
    return;
  }

  const move = dropDisc(board, col, HUMAN);
  if (!move) return;

  lastMove = move;

  const result = findWinningLine(board);
  if (result) {
    finishGame(HUMAN, result.cells);
    return;
  }

  if (isBoardFull(board)) {
    finishGame(null);
    return;
  }

  currentTurn = AI;
  turnIndicator.classList.add("is-thinking");
  turnIndicator.textContent = "AI thinking…";
  boardHint.textContent = "The AI is choosing its move.";
  renderBoard();
  scheduleAiMove();
}

boardEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const column = target.closest(".column");
  if (!column) return;

  handleHumanMove(Number(column.dataset.col));
});

/* =========================================================
   规则判断
   ========================================================= */

function isColumnPlayable(state, col) {
  return col >= 0 && col < COLS && state[0][col] === EMPTY;
}

function dropDisc(state, col, player) {
  if (col < 0 || col >= COLS) return null;

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (state[row][col] === EMPTY) {
      state[row][col] = player;
      return { row, col };
    }
  }

  return null;
}

function isBoardFull(state) {
  return state.every((row) => row.every((cell) => cell !== EMPTY));
}

/**
 * 找出第一组连成四子的棋子。
 * 返回 { winner, cells }，其中 cells 是用于高亮的 [row, col] 数组。
 */
function findWinningLine(state) {
  const directions = [
    [0, 1], // 横向
    [1, 0], // 纵向
    [1, 1], // 右下斜线
    [1, -1], // 左下斜线
  ];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const player = state[row][col];
      if (player === EMPTY) continue;

      for (const [dr, dc] of directions) {
        const cells = [[row, col]];

        for (let step = 1; step < 4; step += 1) {
          const nextRow = row + dr * step;
          const nextCol = col + dc * step;

          if (
            nextRow < 0 ||
            nextRow >= ROWS ||
            nextCol < 0 ||
            nextCol >= COLS ||
            state[nextRow][nextCol] !== player
          ) {
            break;
          }

          cells.push([nextRow, nextCol]);
        }

        if (cells.length === 4) {
          return { winner: player, cells };
        }
      }
    }
  }

  return null;
}

function finishGame(winner, cells = []) {
  gameOver = true;
  winningCells = new Set(cells.map(([row, col]) => `${row},${col}`));

  turnIndicator.classList.remove("is-thinking");

  if (winner === HUMAN) {
    turnIndicator.textContent = "You win!";
    boardHint.textContent =
      "You connected four. Press New Game to play another round.";
  } else if (winner === AI) {
    turnIndicator.textContent = "AI wins!";
    boardHint.textContent =
      "The AI connected four. Press New Game for a rematch.";
  } else {
    turnIndicator.textContent = "Draw game";
    boardHint.textContent =
      "The board is full. Press New Game to try a different strategy.";
  }

  renderBoard();
}

/* =========================================================
   AI 搜索
   ========================================================= */

function copyBoard(state) {
  return state.map((row) => [...row]);
}

function getLegalColumns(state) {
  return CENTER_FIRST.filter((col) => isColumnPlayable(state, col));
}

function findWinningColumn(state, player) {
  for (const col of getLegalColumns(state)) {
    const nextBoard = copyBoard(state);
    dropDisc(nextBoard, col, player);

    const result = findWinningLine(nextBoard);
    if (result && result.winner === player) {
      return col;
    }
  }

  return null;
}

function evaluateWindow(windowValues) {
  let aiCount = 0;
  let humanCount = 0;

  for (const value of windowValues) {
    if (value === AI) aiCount += 1;
    if (value === HUMAN) humanCount += 1;
  }

  // 双方都占有的窗口不可能再连成四子，直接忽略。
  if (aiCount > 0 && humanCount > 0) return 0;

  if (aiCount === 3) return 90;
  if (aiCount === 2) return 12;
  if (aiCount === 1) return 1;

  // 对玩家的三连稍微更重视，让 AI 更积极防守。
  if (humanCount === 3) return -110;
  if (humanCount === 2) return -14;
  if (humanCount === 1) return -1;

  return 0;
}

function evaluateBoard(state) {
  let score = 0;
  const centerCol = Math.floor(COLS / 2);

  // 占据中路通常能创造更多进攻机会。
  for (let row = 0; row < ROWS; row += 1) {
    if (state[row][centerCol] === AI) score += 8;
    if (state[row][centerCol] === HUMAN) score -= 8;
  }

  // 横向窗口
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS - 3; col += 1) {
      score += evaluateWindow([
        state[row][col],
        state[row][col + 1],
        state[row][col + 2],
        state[row][col + 3],
      ]);
    }
  }

  // 纵向窗口
  for (let row = 0; row < ROWS - 3; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      score += evaluateWindow([
        state[row][col],
        state[row + 1][col],
        state[row + 2][col],
        state[row + 3][col],
      ]);
    }
  }

  // 右下斜线窗口
  for (let row = 0; row < ROWS - 3; row += 1) {
    for (let col = 0; col < COLS - 3; col += 1) {
      score += evaluateWindow([
        state[row][col],
        state[row + 1][col + 1],
        state[row + 2][col + 2],
        state[row + 3][col + 3],
      ]);
    }
  }

  // 左下斜线窗口
  for (let row = 3; row < ROWS; row += 1) {
    for (let col = 0; col < COLS - 3; col += 1) {
      score += evaluateWindow([
        state[row][col],
        state[row - 1][col + 1],
        state[row - 2][col + 2],
        state[row - 3][col + 3],
      ]);
    }
  }

  return score;
}

function minimax(state, depth, alpha, beta, maximizingPlayer) {
  const result = findWinningLine(state);

  if (result) {
    // 加上剩余深度，让 AI 选择更快的胜利、更慢的失败。
    return result.winner === AI ? WIN_SCORE + depth : -WIN_SCORE - depth;
  }

  if (isBoardFull(state)) return 0;
  if (depth === 0) return evaluateBoard(state);

  const legalColumns = getLegalColumns(state);
  if (legalColumns.length === 0) return 0;

  if (maximizingPlayer) {
    let bestScore = -Infinity;

    for (const col of legalColumns) {
      const nextBoard = copyBoard(state);
      dropDisc(nextBoard, col, AI);

      const score = minimax(nextBoard, depth - 1, alpha, beta, false);
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, bestScore);

      if (beta <= alpha) break;
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const col of legalColumns) {
    const nextBoard = copyBoard(state);
    dropDisc(nextBoard, col, HUMAN);

    const score = minimax(nextBoard, depth - 1, alpha, beta, true);
    bestScore = Math.min(bestScore, score);
    beta = Math.min(beta, bestScore);

    if (beta <= alpha) break;
  }

  return bestScore;
}

function findBestMove(searchDepth) {
  const legalColumns = getLegalColumns(board);

  if (legalColumns.length === 0) return null;

  let bestScore = -Infinity;
  let bestColumn = legalColumns[0];

  for (const col of legalColumns) {
    const nextBoard = copyBoard(board);
    dropDisc(nextBoard, col, AI);

    const score = minimax(nextBoard, searchDepth - 1, -Infinity, Infinity, false);

    if (score > bestScore) {
      bestScore = score;
      bestColumn = col;
    }
  }

  return bestColumn;
}

function chooseAiColumn() {
  const legalColumns = getLegalColumns(board);
  if (legalColumns.length === 0) return null;

  const winningMove = findWinningColumn(board, AI);

  // Easy：大部分时间随机走棋，只偶尔抓住胜利或阻挡玩家。
  if (difficulty === "easy") {
    if (winningMove !== null && Math.random() < 0.5) {
      return winningMove;
    }

    const blockMove = findWinningColumn(board, HUMAN);
    if (blockMove !== null && Math.random() < 0.5) {
      return blockMove;
    }

    return legalColumns[Math.floor(Math.random() * legalColumns.length)];
  }

  // Medium / Hard 永远不会错过直接取胜或阻挡玩家四连的机会。
  if (winningMove !== null) return winningMove;

  const blockMove = findWinningColumn(board, HUMAN);
  if (blockMove !== null) return blockMove;

  // Hard 看得更远，因此更难被简单的双威胁击败。
  const searchDepth = difficulty === "hard" ? 5 : 3;
  return findBestMove(searchDepth);
}

function scheduleAiMove() {
  cancelAiMove();

  const scheduleGameId = gameId;

  aiTimeoutId = window.setTimeout(() => {
    aiTimeoutId = null;

    // 如果期间重新开始了游戏，就忽略这次旧的 AI 行动。
    if (
      !gameStarted ||
      gameOver ||
      currentTurn !== AI ||
      scheduleGameId !== gameId
    ) {
      return;
    }

    makeAiMove();
  }, 420);
}

function cancelAiMove() {
  if (aiTimeoutId !== null) {
    window.clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }
}

function makeAiMove() {
  if (!gameStarted || gameOver || currentTurn !== AI) return;

  let col = chooseAiColumn();

  // 防御性兜底：AI 不应选择无效列，但万一状态异常也能继续游戏。
  if (col === null || !isColumnPlayable(board, col)) {
    const fallbackColumns = getLegalColumns(board);

    if (fallbackColumns.length === 0) {
      finishGame(null);
      return;
    }

    col = fallbackColumns[0];
  }

  const move = dropDisc(board, col, AI);
  if (!move) return;

  lastMove = move;

  const result = findWinningLine(board);
  if (result) {
    finishGame(AI, result.cells);
    return;
  }

  if (isBoardFull(board)) {
    finishGame(null);
    return;
  }

  currentTurn = HUMAN;
  turnIndicator.classList.remove("is-thinking");
  turnIndicator.textContent = "Your turn";
  boardHint.textContent =
    "Choose a column to drop your disc. First to connect four wins.";
  renderBoard();
}

/* =========================================================
   界面事件
   ========================================================= */

function updateDifficultyNote() {
  difficultyNote.textContent =
    DIFFICULTY_NOTES[difficulty] ?? DIFFICULTY_NOTES.medium;
}

newGameBtn.addEventListener("click", startGame);
startGameBtn.addEventListener("click", startGame);

difficultySelect.addEventListener("change", (event) => {
  difficulty = event.target.value;
  updateDifficultyNote();

  if (!gameStarted) {
    turnIndicator.textContent = "Ready to play";
  }
});

/* =========================================================
   初始化
   ========================================================= */

buildBoardUi();
updateDifficultyNote();
renderBoard();
