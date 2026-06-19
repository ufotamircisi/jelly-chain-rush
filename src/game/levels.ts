import type { CandyType, GameState, LevelDefinition, LevelGoal } from '../types';

const CANDY_GOAL_ORDER: CandyType[] = ['purpleJelly', 'greenGummy', 'redHeart', 'yellowStar', 'blueRound', 'orangeBean'];
const MULTIPLIER_TARGETS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1000];

export function generateLevel(level: number): LevelDefinition {
  const targetScore = getTargetScore(level);
  const goals: LevelGoal[] = [{ type: 'score', target: targetScore }];

  if (level === 1) {
    return { level, targetScore, goals };
  }

  if (level === 2) {
    goals.push({ type: 'candy', candy: 'purpleJelly', target: 10 });
    return { level, targetScore, goals };
  }

  if (level >= 3 && level % 2 === 0) {
    goals.push({ type: 'candy', candy: CANDY_GOAL_ORDER[level % CANDY_GOAL_ORDER.length], target: getCandyTarget(level) });
  }

  if (level >= 5 && (level % 5 === 0 || level % 3 === 0)) {
    goals.push({ type: 'multiplier', target: getMultiplierTarget(level) });
  }

  return { level, targetScore, goals };
}

export function areGoalsComplete(state: GameState): boolean {
  return state.definition.goals.every((goal) => getGoalProgress(state, goal) >= goal.target);
}

export function getGoalProgress(state: GameState, goal: LevelGoal): number {
  if (goal.type === 'score') {
    return state.score;
  }

  if (goal.type === 'candy' && goal.candy) {
    return state.candyBlasts[goal.candy] ?? 0;
  }

  return getHighestMultiplierValue(state);
}

export function getHighestMultiplierValue(state: GameState): number {
  const values = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000];
  return values[state.highestMultiplierIndex] ?? 0;
}

function getTargetScore(level: number): number {
  if (level === 1) return 10000;
  if (level === 2) return 15000;
  if (level === 5) return 40000;
  if (level === 10) return 100000;
  return Math.round((9000 + level * level * 850 + level * 3500) / 1000) * 1000;
}

function getCandyTarget(level: number): number {
  return Math.min(90, 8 + level * 4);
}

function getMultiplierTarget(level: number): number {
  if (level <= 5) return 16;
  if (level <= 10) return 64;
  const index = Math.min(MULTIPLIER_TARGETS.length - 1, Math.floor(level / 5) + 3);
  return MULTIPLIER_TARGETS[index];
}
