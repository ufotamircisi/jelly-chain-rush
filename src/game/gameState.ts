import { createBoard } from './boardModel';
import { getLevelConfig } from './levels';
import type { GameState, SaveData } from '../types';

export function createGameState(save: SaveData): GameState {
  const definition = getLevelConfig(save.currentLevel);

  return {
    level: save.currentLevel,
    definition,
    score: 0,
    shakesRemaining: save.shakes,
    energy: save.energy,
    diamonds: save.diamonds,
    candyBlasts: {},
    highestMultiplierIndex: 0,
    continued: false,
    adContinueUsedForAttempt: false,
    status: 'playing',
    board: createBoard()
  };
}
