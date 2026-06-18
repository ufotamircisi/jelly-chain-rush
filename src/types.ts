export const BOARD_COLUMNS = 7;
export const BOARD_ROWS = 7;
export const SHAKE_COST_ENERGY = 10;
export const MAX_SHAKES = 10;

export type LocaleCode = 'en' | 'tr' | 'es' | 'pt' | 'fr' | 'de' | 'it' | 'id' | 'vi' | 'nl' | 'pl';

export type CandyType =
  | 'greenGummy'
  | 'purpleJelly'
  | 'redHeart'
  | 'yellowStar'
  | 'blueRound'
  | 'orangeBean'
  | 'energyStar';

export interface BoardPosition {
  row: number;
  col: number;
}

export interface BoardCell extends BoardPosition {
  multiplierIndex: number;
  candy: CandyType;
}

export type BoardGrid = BoardCell[][];

export type ScreenKey = 'play' | 'island' | 'market';

export interface SaveData {
  currentLevel: number;
  energy: number;
  diamonds: number;
  language: LocaleCode;
}

export interface GameState {
  level: number;
  goalScore: number;
  score: number;
  shakesRemaining: number;
  energy: number;
  diamonds: number;
  board: BoardGrid;
}

export interface BuildingDefinition {
  id: number;
  nameKey: string;
  energy: number;
  diamonds: number;
}
