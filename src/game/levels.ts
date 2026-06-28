import type { CandyType, GameState, LevelDefinition, LevelGoal } from '../types';

const CANDY_GOAL_ORDER: CandyType[] = ['purpleJelly', 'greenGummy', 'redHeart', 'yellowStar', 'blueRound', 'orangeBean'];
const MULTIPLIER_VALUES = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000];
const MULTIPLIER_TARGETS = MULTIPLIER_VALUES.slice(1);

// Timed levels occur every 5 levels (5, 10, 15, 20, 25, …)
export function isTimedLevel(level: number): boolean {
  return level % 5 === 0;
}

// Candy target caps for timed levels — achievable within 60 s
const TIMED_CANDY_CAPS = [35, 40, 45] as const;

export function getLevelConfig(levelNumber: number): LevelDefinition {
  const level = Math.max(1, Math.floor(levelNumber));
  const timed = isTimedLevel(level);
  const targetScore = timed ? getTimedTargetScore(level) : getTargetScore(level);
  const goals: LevelGoal[] = [{ type: 'score', target: targetScore }];

  for (let index = 0; index < getCandyGoalCount(level); index += 1) {
    const rawTarget = getCandyTarget(level, index);
    goals.push({
      type: 'candy',
      candy: getGoalCandy(level, index),
      target: timed ? Math.min(rawTarget, TIMED_CANDY_CAPS[index] ?? 45) : rawTarget
    });
  }

  if (shouldUseMultiplierGoal(level)) {
    goals.push({ type: 'multiplier', target: getMultiplierTarget(level) });
  }

  return { level, targetScore, goals };
}

export function generateLevel(level: number): LevelDefinition {
  return getLevelConfig(level);
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
  return MULTIPLIER_VALUES[state.highestMultiplierIndex] ?? 0;
}

function getTimedTargetScore(level: number): number {
  const hardCap = level <= 50
    ? 15000 + Math.floor((level - 5) / 5) * 20000
    : 175000 + Math.floor((level - 50) / 5) * 15000;
  return Math.min(Math.round(getTargetScore(level) * 0.5 / 1000) * 1000, hardCap);
}

function getTargetScore(level: number): number {
  if (level <= 5) {
    return [0, 9000, 14000, 21000, 30000, 42000][level];
  }

  if (level <= 15) {
    return roundToThousand(42000 + (level - 5) * 9000 + (level - 5) ** 2 * 650);
  }

  if (level <= 30) {
    return roundToThousand(145000 + (level - 15) * 13500 + (level - 15) ** 2 * 900);
  }

  return roundToThousand(550000 + (level - 30) * 22000 + Math.sqrt(level - 30) * 45000);
}

function getCandyGoalCount(level: number): number {
  if (level <= 9) return 1;
  if (level <= 24) return 2;
  return 3;
}

function getGoalCandy(level: number, goalIndex: number): CandyType {
  const offset = Math.floor((level - 1) / 2) + goalIndex * 2;
  return CANDY_GOAL_ORDER[offset % CANDY_GOAL_ORDER.length];
}

function getCandyTarget(level: number, goalIndex: number): number {
  if (level <= 5) return 6 + level * 3 + goalIndex * 2;
  if (level <= 15) return 22 + (level - 6) * 3 + goalIndex * 5;
  if (level <= 30) return 54 + (level - 16) * 4 + goalIndex * 8;
  return Math.min(190, 110 + Math.floor((level - 31) * 2.4) + goalIndex * 14);
}

function shouldUseMultiplierGoal(level: number): boolean {
  if (level < 8) return false;
  if (level <= 15) return level % 4 === 0;
  if (level <= 30) return level % 3 === 0;
  return level % 2 === 0;
}

function getMultiplierTarget(level: number): number {
  if (level <= 12) return 16;
  if (level <= 18) return 32;
  if (level <= 24) return 64;
  if (level <= 30) return 128;

  const index = Math.min(MULTIPLIER_TARGETS.length - 1, 6 + Math.floor((level - 31) / 12));
  return MULTIPLIER_TARGETS[index];
}

function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}
