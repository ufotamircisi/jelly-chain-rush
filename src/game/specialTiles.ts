import type { BoardGrid, CandyType, SaveData } from '../types';

export const ENERGY_STAR_THRESHOLD = 4;
export const COLOR_BOMB_THRESHOLD = 4;
export const ENERGY_STAR_REWARD = 50;
export const COLOR_BOMB_REWARD_ENERGY = 50;
export const COLOR_BOMB_REWARD_DIAMONDS = 25;
export const COLOR_BOMB_REWARD_SHAKES = 1;

const ENERGY_STAR_DISCOVERY_LEVEL = 4;
const COLOR_BOMB_DISCOVERY_LEVEL = 8;
const ENERGY_STAR_PITY_INTERVAL = 15;
const COLOR_BOMB_PITY_INTERVAL = 25;

const NORMAL_CANDY_TYPES: CandyType[] = [
  'greenGummy', 'purpleJelly', 'redHeart', 'yellowStar', 'blueRound', 'orangeBean'
];

function randomNormal(): CandyType {
  return NORMAL_CANDY_TYPES[Math.floor(Math.random() * NORMAL_CANDY_TYPES.length)];
}

export function countCandyOnBoard(board: BoardGrid, type: CandyType): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.candy === type) count++;
    }
  }
  return count;
}

export function consumeCandyFromBoard(board: BoardGrid, type: CandyType): BoardGrid {
  return board.map((row) =>
    row.map((cell) => (cell.candy === type ? { ...cell, candy: randomNormal() } : { ...cell }))
  );
}

export function shouldInjectEnergyStar(save: SaveData, level: number): boolean {
  if (save.completedLevels.includes(level)) return false;
  if (!save.energyStarDiscovered) return level === ENERGY_STAR_DISCOVERY_LEVEL;
  return save.energyStarLevelsSince >= ENERGY_STAR_PITY_INTERVAL;
}

export function shouldInjectColorBomb(save: SaveData, level: number): boolean {
  if (save.completedLevels.includes(level)) return false;
  if (!save.colorBombDiscovered) return level === COLOR_BOMB_DISCOVERY_LEVEL;
  return save.colorBombLevelsSince >= COLOR_BOMB_PITY_INTERVAL;
}

export function injectSpecialTilesIntoBoard(
  board: BoardGrid,
  energyStarCount: number,
  colorBombCount: number
): BoardGrid {
  if (energyStarCount === 0 && colorBombCount === 0) return board;
  const next = board.map((row) => row.map((cell) => ({ ...cell })));

  const energyStarPositions = [
    { row: 1, col: 1 },
    { row: 1, col: 5 },
    { row: 4, col: 1 },
    { row: 4, col: 5 }
  ];

  for (let i = 0; i < energyStarCount && i < energyStarPositions.length; i++) {
    const pos = energyStarPositions[i];
    next[pos.row][pos.col].candy = 'energyStar';
  }

  const colorBombPositions = [
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 4, col: 2 },
    { row: 4, col: 4 }
  ];

  for (let i = 0; i < colorBombCount && i < colorBombPositions.length; i++) {
    const pos = colorBombPositions[i];
    next[pos.row][pos.col].candy = 'colorBomb';
  }

  return next;
}

export function onEnergyStarEventFired(save: SaveData, level: number): void {
  save.energyStarDiscovered = true;
  save.energyStarLevelsSince = 0;
  save.energyStarClaimedLevel = level;
}

export function onColorBombEventFired(save: SaveData, level: number): void {
  save.colorBombDiscovered = true;
  save.colorBombLevelsSince = 0;
  save.colorBombClaimedLevel = level;
}

export function onFirstTimeLevelCompleted(save: SaveData): void {
  save.energyStarLevelsSince++;
  save.colorBombLevelsSince++;
}
