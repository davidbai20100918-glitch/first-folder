const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const HUMAN = 1;
const AI = 2;

let board = [];
let currentTurn = HUMAN;
let scores = { player: 0, ai: 0, draws: 0 };
let difficulty = 'medium';
let gameOver = false;

const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const drawScoreEl = document.getElementById('draw-score');
const newGameBtn = document.getElementById('new-game');
const difficultySelect = document.getElementById('difficulty');

function initializeBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
  currentTurn = HUMAN;
  gameOver = false;
  renderBoard();
  updateStatus();
  updateScores();
}

function updateScores() {
  playerScoreEl.textContent = scores.player;
  aiScoreEl.textContent = scores.ai;
  drawScoreEl.textContent = scores.draws;
}

function updateStatus() {
  if (gameOver) {
    turnIndicator.textContent = 'Game over';
    return;
  }

  turnIndicator.textContent = currentTurn === HUMAN ? 'Your turn' : 'AI thinking...';
}

function renderBoard() {
  boardEl.innerHTML = '';

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}`);
      cell.classList.toggle('locked', board[row][col] !== EMPTY);

      if (board[row][col] === HUMAN) {
        cell.classList.add('player-1');
      } else if (board[row][col] === AI) {
        cell.classList.add('player-2');
      }

      cell.addEventListener('click', () => handleHumanMove(col));
      boardEl.appendChild(cell);
    }
  }
}

function isColumnPlayable(col) {
  return board[0][col] === EMPTY;
}

function dropDisc(col, player) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === EMPTY) {
      board[row][col] = player;
      return { row, col };
    }
  }
  return null;
}

function getWinner() {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const current = board[row][col];
      if (current === EMPTY) continue;

      for (const [dr, dc] of directions) {
        let count = 1;

        for (let step = 1; step < 4; step++) {
          const nextRow = row + dr * step;
          const nextCol = col + dc * step;

          if (
            nextRow >= 0 &&
            nextRow < ROWS &&
            nextCol >= 0 &&
            nextCol < COLS &&
            board[nextRow][nextCol] === current
          ) {
            count += 1;
          } else {
            break;
          }
        }

        if (count >= 4) {
          return current;
        }
      }
    }
  }

  return null;
}

function isBoardFull() {
  return board.every((row) => row.every((cell) => cell !== EMPTY));
}

function endGame(winner) {
  gameOver = true;

  if (winner === HUMAN) {
    scores.player += 1;
    turnIndicator.textContent = 'You win!';
  } else if (winner === AI) {
    scores.ai += 1;
    turnIndicator.textContent = 'AI wins!';
  } else {
    scores.draws += 1;
    turnIndicator.textContent = 'Draw game';
  }

  updateScores();
  renderBoard();
}

function handleHumanMove(col) {
  if (gameOver || currentTurn !== HUMAN || !isColumnPlayable(col)) {
    return;
  }

  const move = dropDisc(col, HUMAN);
  if (!move) return;

  renderBoard();

  const winner = getWinner();
  if (winner) {
    endGame(winner);
    return;
  }

  if (isBoardFull()) {
    endGame(null);
    return;
  }

  currentTurn = AI;
  updateStatus();
  renderBoard();

  setTimeout(() => {
    makeAiMove();
  }, 300);
}

function getImmediateWinningMove(player) {
  for (let col = 0; col < COLS; col++) {
    if (!isColumnPlayable(col)) continue;

    const tempBoard = copyBoard(board);
    const row = dropDiscToBoard(tempBoard, col, player);
    if (!row) continue;

    if (hasConnectFour(tempBoard, player)) {
      return col;
    }
  }

  return null;
}

function copyBoard(currentBoard) {
  return currentBoard.map((row) => [...row]);
}

function dropDiscToBoard(targetBoard, col, player) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (targetBoard[row][col] === EMPTY) {
      targetBoard[row][col] = player;
      return row;
    }
  }
  return null;
}

function hasConnectFour(targetBoard, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (targetBoard[row][col] !== player) continue;

      for (const [dr, dc] of directions) {
        let count = 1;
        for (let step = 1; step < 4; step++) {
          const nextRow = row + dr * step;
          const nextCol = col + dc * step;
          if (
            nextRow >= 0 &&
            nextRow < ROWS &&
            nextCol >= 0 &&
            nextCol < COLS &&
            targetBoard[nextRow][nextCol] === player
          ) {
            count += 1;
          } else {
            break;
          }
        }

        if (count >= 4) return true;
      }
    }
  }

  return false;
}

function evaluateWindow(windowValues, player) {
  const opponent = player === HUMAN ? AI : HUMAN;
  let score = 0;

  if (windowValues.filter((value) => value === player).length === 4) {
    score += 100000;
  } else if (
    windowValues.filter((value) => value === player).length === 3 &&
    windowValues.filter((value) => value === EMPTY).length === 1
  ) {
    score += 120;
  } else if (
    windowValues.filter((value) => value === player).length === 2 &&
    windowValues.filter((value) => value === EMPTY).length === 2
  ) {
    score += 12;
  }

  if (
    windowValues.filter((value) => value === opponent).length === 3 &&
    windowValues.filter((value) => value === EMPTY).length === 1
  ) {
    score -= 140;
  }

  return score;
}

function scorePosition(boardState, player) {
  let score = 0;

  const centerArray = boardState.map((row) => row[COLS / 2 | 0]);
  score += centerArray.filter((cell) => cell === player).length * 6;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const window = [
        boardState[row][col],
        boardState[row][col + 1],
        boardState[row][col + 2],
        boardState[row][col + 3],
      ];
      score += evaluateWindow(window, player);
    }
  }

  for (let row = 0; row < ROWS - 3; row++) {
    for (let col = 0; col < COLS; col++) {
      const window = [
        boardState[row][col],
        boardState[row + 1][col],
        boardState[row + 2][col],
        boardState[row + 3][col],
      ];
      score += evaluateWindow(window, player);
    }
  }

  for (let row = 0; row < ROWS - 3; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const window = [
        boardState[row][col],
        boardState[row + 1][col + 1],
        boardState[row + 2][col + 2],
        boardState[row + 3][col + 3],
      ];
      score += evaluateWindow(window, player);
    }
  }

  for (let row = 3; row < ROWS; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const window = [
        boardState[row][col],
        boardState[row - 1][col + 1],
        boardState[row - 2][col + 2],
        boardState[row - 3][col + 3],
      ];
      score += evaluateWindow(window, player);
    }
  }

  return score;
}

function minimax(boardState, depth, alpha, beta, maximizingPlayer) {
  const winner = getWinnerFromBoard(boardState);

  if (winner === AI) return 100000 + depth;
  if (winner === HUMAN) return -100000 - depth;
  if (isBoardFullForState(boardState)) return 0;
  if (depth === 0) return scorePosition(boardState, AI) - scorePosition(boardState, HUMAN);

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (let col = 0; col < COLS; col++) {
      if (!isColumnPlayableInState(boardState, col)) continue;

      const tempBoard = copyBoard(boardState);
      dropDiscToBoard(tempBoard, col, AI);
      const evaluation = minimax(tempBoard, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (let col = 0; col < COLS; col++) {
    if (!isColumnPlayableInState(boardState, col)) continue;

    const tempBoard = copyBoard(boardState);
    dropDiscToBoard(tempBoard, col, HUMAN);
    const evaluation = minimax(tempBoard, depth - 1, alpha, beta, true);
    minEval = Math.min(minEval, evaluation);
    beta = Math.min(beta, evaluation);
    if (beta <= alpha) break;
  }
  return minEval;
}

function getWinnerFromBoard(boardState) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const current = boardState[row][col];
      if (current === EMPTY) continue;

      for (const [dr, dc] of directions) {
        let count = 1;
        for (let step = 1; step < 4; step++) {
          const nextRow = row + dr * step;
          const nextCol = col + dc * step;

          if (
            nextRow >= 0 &&
            nextRow < ROWS &&
            nextCol >= 0 &&
            nextCol < COLS &&
            boardState[nextRow][nextCol] === current
          ) {
            count += 1;
          } else {
            break;
          }
        }

        if (count >= 4) return current;
      }
    }
  }

  return null;
}

function isBoardFullForState(boardState) {
  return boardState.every((row) => row.every((cell) => cell !== EMPTY));
}

function isColumnPlayableInState(boardState, col) {
  return boardState[0][col] === EMPTY;
}

function chooseAiColumn() {
  const immediateHumanWin = getImmediateWinningMove(HUMAN);
  if (immediateHumanWin !== null) {
    const humanCanWinNext = getImmediateWinningMove(HUMAN);
    if (humanCanWinNext !== null) {
      return humanCanWinNext;
    }
  }

  const aiWinningMove = getImmediateWinningMove(AI);
  if (aiWinningMove !== null) {
    return aiWinningMove;
  }

  const blockMove = getImmediateWinningMove(HUMAN);
  if (blockMove !== null) {
    return blockMove;
  }

  const preferredCols = difficulty === 'easy'
    ? [3, 2, 4, 1, 5, 0, 6]
    : difficulty === 'medium'
      ? [3, 2, 4, 1, 5, 0, 6]
      : [3, 2, 4, 1, 5, 0, 6];

  const moves = [];

  for (const col of preferredCols) {
    if (!isColumnPlayable(col)) continue;

    const tempBoard = copyBoard(board);
    dropDiscToBoard(tempBoard, col, AI);
    const score = minimax(tempBoard, difficulty === 'easy' ? 2 : difficulty === 'medium' ? 4 : 6, -Infinity, Infinity, false);
    moves.push({ col, score });
  }

  if (moves.length === 0) {
    return 3;
  }

  if (difficulty === 'easy') {
    const randomChance = Math.random();
    if (randomChance < 0.35) {
      return moves[Math.floor(Math.random() * moves.length)].col;
    }
  }

  moves.sort((a, b) => b.score - a.score);
  return moves[0].col;
}

function makeAiMove() {
  if (gameOver) return;

  const aiCol = chooseAiColumn();
  const move = dropDisc(aiCol, AI);
  if (!move) return;

  const winner = getWinner();
  renderBoard();

  if (winner === AI) {
    endGame(winner);
    return;
  }

  if (isBoardFull()) {
    endGame(null);
    return;
  }

  currentTurn = HUMAN;
  updateStatus();
  renderBoard();
}

newGameBtn.addEventListener('click', initializeBoard);

difficultySelect.addEventListener('change', (event) => {
  difficulty = event.target.value;
  if (!gameOver && currentTurn === AI) {
    setTimeout(() => makeAiMove(), 150);
  }
});

initializeBoard();
