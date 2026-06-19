import { createBoard } from './boardModel';
import { generateLevel } from './levels';
import { MAX_SHAKES, type GameState, type SaveData } from '../types';

export function createGameState(save: SaveData): GameState {
  const definition = generateLevel(save.currentLevel);

  return {
    level: save.currentLevel,
    definition,
    score: 0,
    shakesRemaining: MAX_SHAKES,
    energy: save.energy,
    diamonds: save.diamonds,
    candyBlasts: {},
    highestMultiplierIndex: 0,
    continued: false,
    status: 'playing',
    board: createBoard()
  };
}
