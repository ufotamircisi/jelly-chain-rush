import { randomCandyType } from '../data/candies';
import { getMultiplierScoreFactor, upgradeMultiplier } from '../data/multipliers';
import { BOARD_COLUMNS, BOARD_ROWS, type BoardCell, type BoardGrid, type BoardPosition } from '../types';

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

export function findConnectedGroup(board: BoardGrid, start: BoardPosition): BoardPosition[] {
  const startCell = board[start.row]?.[start.col];
  if (!startCell) {
    return [];
  }

  const group: BoardPosition[] = [];
  const seen = new Set<string>();
  const stack: BoardPosition[] = [start];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const key = positionKey(current);
    if (seen.has(key)) {
      continue;
    }

    const cell = board[current.row]?.[current.col];
    if (!cell || cell.candy !== startCell.candy) {
      continue;
    }

    seen.add(key);
    group.push(current);
    for (const neighbor of getNeighbors(current)) {
      stack.push(neighbor);
    }
  }

  return group;
}

export function hasAnyValidGroup(board: BoardGrid): boolean {
  const seen = new Set<string>();

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      const key = positionKey({ row, col });
      if (seen.has(key)) {
        continue;
      }

      const group = findConnectedGroup(board, { row, col });
      for (const position of group) {
        seen.add(positionKey(position));
      }

      if (group.length >= 3) {
        return true;
      }
    }
  }

  return false;
}

export interface BlastResult {
  board: BoardGrid;
  scoreDelta: number;
  group: BoardPosition[];
}

export function blastGroup(board: BoardGrid, group: BoardPosition[]): BlastResult {
  const removalKeys = new Set(group.map(positionKey));
  const nextBoard = board.map((row) => row.map((cell) => ({ ...cell })));
  let multiplierTotal = 0;

  for (const position of group) {
    const cell = nextBoard[position.row][position.col];
    multiplierTotal += getMultiplierScoreFactor(cell.multiplierIndex);
    cell.multiplierIndex = upgradeMultiplier(cell.multiplierIndex);
  }

  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    const survivors: BoardCell[] = [];

    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      const cell = nextBoard[row][col];
      if (!removalKeys.has(positionKey(cell))) {
        survivors.push(cell);
      }
    }

    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      const source = survivors.shift();
      const currentFloor = nextBoard[row][col].multiplierIndex;
      nextBoard[row][col] = {
        row,
        col,
        multiplierIndex: currentFloor,
        candy: source?.candy ?? randomCandyType()
      };
    }
  }

  return {
    board: nextBoard,
    scoreDelta: calculateScore(group.length, multiplierTotal),
    group
  };
}

export function calculateScore(groupSize: number, multiplierTotal: number): number {
  const bonus = getGroupBonus(groupSize);
  return Math.round(BASE_CELL_SCORE * groupSize * bonus * Math.max(1, multiplierTotal / groupSize));
}

function createCell(row: number, col: number): BoardCell {
  return {
    row,
    col,
    multiplierIndex: 0,
    candy: randomCandyType()
  };
}

function getGroupBonus(groupSize: number): number {
  if (groupSize >= 8) return 3;
  if (groupSize >= 7) return 2.5;
  if (groupSize >= 6) return 2;
  if (groupSize >= 5) return 1.5;
  if (groupSize >= 4) return 1.2;
  return 1;
}

function getNeighbors(position: BoardPosition): BoardPosition[] {
  return [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 }
  ].filter((next) => next.row >= 0 && next.row < BOARD_ROWS && next.col >= 0 && next.col < BOARD_COLUMNS);
}

function positionKey(position: BoardPosition): string {
  return `${position.row}:${position.col}`;
}
