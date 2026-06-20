import { randomCandyType } from '../data/candies';
import { getMultiplierScoreFactor, MULTIPLIER_VALUES, upgradeMultiplier } from '../data/multipliers';
import { BOARD_COLUMNS, BOARD_ROWS, type BoardCell, type BoardGrid, type BoardPosition, type CandyType } from '../types';

const BASE_CELL_SCORE = 100;

export function createBoard(): BoardGrid {
  return Array.from({ length: BOARD_ROWS }, (_, row) =>
    Array.from({ length: BOARD_COLUMNS }, (_, col) => createCell(row, col))
  );
}

export function regenerateCandies(board: BoardGrid): BoardGrid {
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) => ({
      ...cell,
      row: rowIndex,
      col: colIndex,
      candy: randomCandyType()
    }))
  );
}

export interface CascadeStep {
  matched: BoardPosition[];
  scoreDelta: number;
  candyCounts: Partial<Record<CandyType, number>>;
}

export interface CascadeResult {
  board: BoardGrid;
  scoreDelta: number;
  candyCounts: Partial<Record<CandyType, number>>;
  steps: CascadeStep[];
}

export function findLineMatches(board: BoardGrid): BoardPosition[] {
  const matched = new Map<string, BoardPosition>();

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    let runStart = 0;
    for (let col = 1; col <= BOARD_COLUMNS; col += 1) {
      const current = board[row][col]?.candy;
      const previous = board[row][col - 1]?.candy;
      if (col < BOARD_COLUMNS && current === previous && current !== 'energyStar') {
        continue;
      }

      const runLength = col - runStart;
      if (previous !== 'energyStar' && runLength >= 3) {
        for (let matchCol = runStart; matchCol < col; matchCol += 1) {
          const position = { row, col: matchCol };
          matched.set(positionKey(position), position);
        }
      }
      runStart = col;
    }
  }

  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    let runStart = 0;
    for (let row = 1; row <= BOARD_ROWS; row += 1) {
      const current = board[row]?.[col]?.candy;
      const previous = board[row - 1]?.[col]?.candy;
      if (row < BOARD_ROWS && current === previous && current !== 'energyStar') {
        continue;
      }

      const runLength = row - runStart;
      if (previous !== 'energyStar' && runLength >= 3) {
        for (let matchRow = runStart; matchRow < row; matchRow += 1) {
          const position = { row: matchRow, col };
          matched.set(positionKey(position), position);
        }
      }
      runStart = row;
    }
  }

  return [...matched.values()];
}

export function hasLineMatches(board: BoardGrid): boolean {
  return findLineMatches(board).length > 0;
}

export function swapCandies(board: BoardGrid, first: BoardPosition, second: BoardPosition): BoardGrid {
  const nextBoard = cloneBoard(board);
  const firstCandy = nextBoard[first.row]?.[first.col]?.candy;
  const secondCandy = nextBoard[second.row]?.[second.col]?.candy;
  if (!firstCandy || !secondCandy) {
    return nextBoard;
  }

  nextBoard[first.row][first.col].candy = secondCandy;
  nextBoard[second.row][second.col].candy = firstCandy;
  return nextBoard;
}

export function areAdjacent(first: BoardPosition, second: BoardPosition): boolean {
  return Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1;
}

export function hasValidSwipeMove(board: BoardGrid): boolean {
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      const position = { row, col };
      const candidates = [
        { row: row + 1, col },
        { row, col: col + 1 }
      ].filter((next) => next.row < BOARD_ROWS && next.col < BOARD_COLUMNS);

      for (const candidate of candidates) {
        if (hasLineMatches(swapCandies(board, position, candidate))) {
          return true;
        }
      }
    }
  }

  return false;
}

export function resolveMatchesAndCascades(board: BoardGrid): CascadeResult {
  let nextBoard = cloneBoard(board);
  let scoreDelta = 0;
  const candyCounts: Partial<Record<CandyType, number>> = {};
  const steps: CascadeStep[] = [];

  for (let cascadeIndex = 0; cascadeIndex < 30; cascadeIndex += 1) {
    const matched = findLineMatches(nextBoard);
    if (matched.length === 0) {
      break;
    }

    const step = blastMatchedCells(nextBoard, matched);
    nextBoard = step.board;
    scoreDelta += step.scoreDelta;
    for (const [candy, count] of Object.entries(step.candyCounts) as [CandyType, number][]) {
      candyCounts[candy] = (candyCounts[candy] ?? 0) + count;
    }
    steps.push({
      matched,
      scoreDelta: step.scoreDelta,
      candyCounts: step.candyCounts
    });
  }

  return {
    board: nextBoard,
    scoreDelta,
    candyCounts,
    steps
  };
}

export function calculateScore(groupSize: number, multiplierTotal: number): number {
  const bonus = getGroupBonus(groupSize);
  return Math.round(BASE_CELL_SCORE * groupSize * bonus * Math.max(1, multiplierTotal / groupSize));
}

function blastMatchedCells(board: BoardGrid, matched: BoardPosition[]): { board: BoardGrid; scoreDelta: number; candyCounts: Partial<Record<CandyType, number>> } {
  const removalKeys = new Set(matched.map(positionKey));
  const nextBoard = cloneBoard(board);
  const candyCounts: Partial<Record<CandyType, number>> = {};
  let multiplierTotal = 0;

  for (const position of matched) {
    const cell = nextBoard[position.row][position.col];
    multiplierTotal += getMultiplierScoreFactor(cell.multiplierIndex);
    candyCounts[cell.candy] = (candyCounts[cell.candy] ?? 0) + 1;
    cell.multiplierIndex = upgradeMultiplier(cell.multiplierIndex);
  }

  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    const survivors: CandyType[] = [];

    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      const cell = nextBoard[row][col];
      if (!removalKeys.has(positionKey(cell))) {
        survivors.push(cell.candy);
      }
    }

    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      nextBoard[row][col].candy = survivors.shift() ?? randomCandyType();
    }
  }

  return {
    board: nextBoard,
    scoreDelta: calculateScore(matched.length, multiplierTotal),
    candyCounts
  };
}

export function getHighestMultiplierIndex(board: BoardGrid): number {
  return board.reduce(
    (highest, row) => Math.max(highest, ...row.map((cell) => cell.multiplierIndex)),
    0
  );
}

export function getMultiplierIndexForValue(value: number): number {
  const index = MULTIPLIER_VALUES.findIndex((multiplier) => multiplier === value);
  return index >= 0 ? index : 0;
}

function createCell(row: number, col: number): BoardCell {
  return {
    row,
    col,
    multiplierIndex: 0,
    candy: randomCandyType()
  };
}

function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function getGroupBonus(groupSize: number): number {
  if (groupSize >= 8) return 3;
  if (groupSize >= 7) return 2.5;
  if (groupSize >= 6) return 2;
  if (groupSize >= 5) return 1.5;
  if (groupSize >= 4) return 1.2;
  return 1;
}

function positionKey(position: BoardPosition): string {
  return `${position.row}:${position.col}`;
}
