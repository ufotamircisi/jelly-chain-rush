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
  boardAfter: BoardGrid;
  scoreDelta: number;
  candyCounts: Partial<Record<CandyType, number>>;
  candyPositions: Partial<Record<CandyType, BoardPosition[]>>;
  largestGroupSize: number;
  highestMultiplierIndex: number;
}

export interface CascadeResult {
  board: BoardGrid;
  scoreDelta: number;
  candyCounts: Partial<Record<CandyType, number>>;
  steps: CascadeStep[];
}

export interface MultiplierUpgradeResult {
  board: BoardGrid;
  upgraded: BoardPosition[];
}

export function findLineMatches(board: BoardGrid): BoardPosition[] {
  const matched = new Map<string, BoardPosition>();
  for (const group of findMatchGroups(board)) {
    for (const position of group) {
      matched.set(positionKey(position), position);
    }
  }

  return [...matched.values()];
}

export function findLineMatchGroups(board: BoardGrid): BoardPosition[][] {
  return findMatchGroups(board);
}

export function findMatchGroups(board: BoardGrid): BoardPosition[][] {
  const groups: BoardPosition[][] = [];
  const visited = new Set<string>();

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLUMNS; col += 1) {
      const position = { row, col };
      const key = positionKey(position);
      if (visited.has(key)) continue;

      const group = collectConnectedCandyGroup(board, position, visited);
      if (group.length >= 3) {
        groups.push(group);
      }
    }
  }

  return groups;
}

export function hasLineMatches(board: BoardGrid): boolean {
  return findMatchGroups(board).length > 0;
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
    const groups = findMatchGroups(nextBoard);
    if (groups.length === 0) {
      break;
    }

    const step = blastMatchedCells(nextBoard, groups);
    nextBoard = step.board;
    scoreDelta += step.scoreDelta;
    for (const [candy, count] of Object.entries(step.candyCounts) as [CandyType, number][]) {
      candyCounts[candy] = (candyCounts[candy] ?? 0) + count;
    }
    steps.push({
      matched: step.matched,
      boardAfter: cloneBoard(nextBoard),
      scoreDelta: step.scoreDelta,
      candyCounts: step.candyCounts,
      candyPositions: step.candyPositions,
      largestGroupSize: step.largestGroupSize,
      highestMultiplierIndex: step.highestMultiplierIndex
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

export function applyComboMultiplierUpgrade(board: BoardGrid, steps: CascadeStep[]): MultiplierUpgradeResult {
  if (steps.length < 2) {
    return { board, upgraded: [] };
  }

  const upgradeKeys = new Set<string>();
  const waveKeys = steps.map((step) => new Set(step.matched.map(positionKey)));

  steps.forEach((step, waveIndex) => {
    for (const position of step.matched) {
      if (hasOrthogonalContactInOtherWave(position, waveKeys, waveIndex)) {
        upgradeKeys.add(positionKey(position));
      }
    }
  });

  if (upgradeKeys.size === 0) {
    return { board, upgraded: [] };
  }

  const nextBoard = cloneBoard(board);
  const upgraded: BoardPosition[] = [];
  for (const key of upgradeKeys) {
    const [row, col] = key.split(':').map(Number);
    const cell = nextBoard[row]?.[col];
    if (!cell) continue;
    const nextMultiplierIndex = upgradeMultiplier(cell.multiplierIndex);
    if (nextMultiplierIndex === cell.multiplierIndex) continue;
    cell.multiplierIndex = nextMultiplierIndex;
    upgraded.push({ row, col });
  }

  return { board: nextBoard, upgraded };
}

function blastMatchedCells(
  board: BoardGrid,
  groups: BoardPosition[][]
): {
  board: BoardGrid;
  matched: BoardPosition[];
  scoreDelta: number;
  candyCounts: Partial<Record<CandyType, number>>;
  candyPositions: Partial<Record<CandyType, BoardPosition[]>>;
  largestGroupSize: number;
  highestMultiplierIndex: number;
} {
  const matched = uniquePositions(groups.flat());
  const removalKeys = new Set(matched.map(positionKey));
  const nextBoard = cloneBoard(board);
  const candyCounts: Partial<Record<CandyType, number>> = {};
  const candyPositions: Partial<Record<CandyType, BoardPosition[]>> = {};
  let scoreDelta = 0;
  let highestMultiplierIndex = 0;

  for (const position of matched) {
    const cell = nextBoard[position.row][position.col];
    candyCounts[cell.candy] = (candyCounts[cell.candy] ?? 0) + 1;
    (candyPositions[cell.candy] ??= []).push(position);
    highestMultiplierIndex = Math.max(highestMultiplierIndex, cell.multiplierIndex);
  }

  for (const group of groups) {
    const multiplierTotal = group.reduce((total, position) => {
      const sourceCell = board[position.row][position.col];
      return total + getMultiplierScoreFactor(sourceCell.multiplierIndex);
    }, 0);
    scoreDelta += calculateScore(group.length, multiplierTotal);
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
    matched,
    scoreDelta,
    candyCounts,
    candyPositions,
    largestGroupSize: Math.max(...groups.map((group) => group.length)),
    highestMultiplierIndex
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

function uniquePositions(positions: BoardPosition[]): BoardPosition[] {
  const matched = new Map<string, BoardPosition>();
  for (const position of positions) {
    matched.set(positionKey(position), position);
  }
  return [...matched.values()];
}

function collectConnectedCandyGroup(board: BoardGrid, start: BoardPosition, visited: Set<string>): BoardPosition[] {
  const candy = board[start.row]?.[start.col]?.candy;
  if (!candy || candy === 'energyStar') {
    visited.add(positionKey(start));
    return [];
  }

  const group: BoardPosition[] = [];
  const pending: BoardPosition[] = [start];
  visited.add(positionKey(start));

  while (pending.length > 0) {
    const position = pending.pop()!;
    group.push(position);

    for (const neighbor of getOrthogonalNeighbors(position)) {
      if (!isInsideBoard(neighbor)) continue;
      const key = positionKey(neighbor);
      if (visited.has(key)) continue;
      if (board[neighbor.row][neighbor.col].candy !== candy) continue;

      visited.add(key);
      pending.push(neighbor);
    }
  }

  return group;
}

function getOrthogonalNeighbors(position: BoardPosition): BoardPosition[] {
  return [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 }
  ];
}

function isInsideBoard(position: BoardPosition): boolean {
  return position.row >= 0 && position.row < BOARD_ROWS && position.col >= 0 && position.col < BOARD_COLUMNS;
}

function hasOrthogonalContactInOtherWave(
  position: BoardPosition,
  waveKeys: Set<string>[],
  currentWaveIndex: number
): boolean {
  return getOrthogonalNeighbors(position).some((neighbor) => {
    if (!isInsideBoard(neighbor)) return false;
    const key = positionKey(neighbor);
    return waveKeys.some((keys, waveIndex) => waveIndex !== currentWaveIndex && keys.has(key));
  });
}

function getGroupBonus(groupSize: number): number {
  if (groupSize >= 7) return 4;
  if (groupSize >= 6) return 3;
  if (groupSize >= 5) return 2;
  if (groupSize >= 4) return 1.4;
  return 1;
}

function positionKey(position: BoardPosition): string {
  return `${position.row}:${position.col}`;
}
