import { createBoard } from './boardModel';
import { getLevelConfig } from './levels';
import { SHAKES_PER_LEVEL, type GameState, type SaveData } from '../types';

export function createGameState(save: SaveData): GameState {
  const definition = getLevelConfig(save.currentLevel);

  return {
    level: save.currentLevel,
    definition,
    score: 0,
    shakesRemaining: SHAKES_PER_LEVEL,
    energy: save.energy,
    diamonds: save.diamonds,
    candyBlasts: {},
    highestMultiplierIndex: 0,
    continued: false,
    status: 'playing',
    board: createBoard()
  };
}
