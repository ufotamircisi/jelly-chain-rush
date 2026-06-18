import { createBoard } from './boardModel';
import { MAX_SHAKES, type GameState, type SaveData } from '../types';

export function createGameState(save: SaveData): GameState {
  return {
    level: save.currentLevel,
    goalScore: 120000,
    score: 0,
    shakesRemaining: MAX_SHAKES,
    energy: save.energy,
    diamonds: save.diamonds,
    board: createBoard()
  };
}
