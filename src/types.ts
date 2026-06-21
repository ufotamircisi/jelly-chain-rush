export const BOARD_COLUMNS = 7;
export const BOARD_ROWS = 7;
export const SHAKES_PER_LEVEL = 5;

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

export type GoalType = 'score' | 'candy' | 'multiplier';

export interface LevelGoal {
  type: GoalType;
  target: number;
  candy?: CandyType;
}

export interface LevelDefinition {
  level: number;
  targetScore: number;
  goals: LevelGoal[];
}

export interface PlayerStats {
  levelsCompleted: number;
  totalBlasts: number;
  highestMultiplierEver: number;
}

export interface DailyLoginState {
  streak: number;
  lastClaimDate: string;
}

export interface SaveData {
  currentLevel: number;
  highestUnlockedLevel: number;
  energy: number;
  diamonds: number;
  superChests: number;
  chests: number;
  completedBuildingIds: number[];
  buildingClaimDates: Record<string, string>;
  dailyLogin: DailyLoginState;
  stats: PlayerStats;
  language: LocaleCode;
  soundEnabled: boolean;
}

export type LevelStatus = 'playing' | 'won' | 'failed';

export interface GameState {
  level: number;
  definition: LevelDefinition;
  score: number;
  shakesRemaining: number;
  energy: number;
  diamonds: number;
  candyBlasts: Partial<Record<CandyType, number>>;
  highestMultiplierIndex: number;
  continued: boolean;
  status: LevelStatus;
  board: BoardGrid;
}

export interface BuildingDefinition {
  id: number;
  nameKey: string;
  energy: number;
  diamonds: number;
}

export interface RewardSummary {
  stars: number;
  levelEnergy: number;
  starEnergy: number;
  starDiamonds: number;
  multiplierLabel: string;
  multiplierEnergy: number;
  multiplierDiamonds: number;
  superChest: boolean;
  totalEnergy: number;
  totalDiamonds: number;
  actualEnergyGained: number;
  energyCapped: boolean;
}
