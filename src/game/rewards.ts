import { getMultiplierLabel } from '../data/multipliers';
import { LEVEL_COMPLETE_ENERGY_REWARD } from './economy';
import type { GameState, RewardSummary } from '../types';

export function calculateRewardSummary(state: GameState): RewardSummary {
  const stars = calculateStars(state);
  const starReward = getStarReward(stars);
  const multiplierReward = getMultiplierReward(state.highestMultiplierIndex);

  return {
    stars,
    levelEnergy: LEVEL_COMPLETE_ENERGY_REWARD,
    starEnergy: starReward.energy,
    starDiamonds: 0,
    multiplierLabel: getMultiplierLabel(state.highestMultiplierIndex) || 'x0',
    multiplierEnergy: multiplierReward.energy,
    multiplierDiamonds: multiplierReward.diamonds,
    superChest: multiplierReward.superChest,
    totalEnergy: LEVEL_COMPLETE_ENERGY_REWARD + starReward.energy + multiplierReward.energy,
    totalDiamonds: multiplierReward.diamonds,
    actualEnergyGained: LEVEL_COMPLETE_ENERGY_REWARD + starReward.energy + multiplierReward.energy,
    energyCapped: false
  };
}

function calculateStars(state: GameState): number {
  if (state.continued || state.shakesRemaining <= 0) return 1;
  if (state.shakesRemaining >= 4) return 3;
  return 2;
}

function getStarReward(stars: number): { energy: number; diamonds: number } {
  if (stars >= 3) return { energy: 20, diamonds: 20 };
  if (stars === 2) return { energy: 10, diamonds: 15 };
  return { energy: 10, diamonds: 10 };
}

function getMultiplierReward(multiplierIndex: number): { energy: number; diamonds: number; superChest: boolean } {
  if (multiplierIndex >= 10) return { energy: 100, diamonds: 100, superChest: true };
  if (multiplierIndex >= 9) return { energy: 50, diamonds: 50, superChest: false };
  if (multiplierIndex >= 8) return { energy: 20, diamonds: 20, superChest: false };
  if (multiplierIndex >= 7) return { energy: 10, diamonds: 10, superChest: false };
  return { energy: 0, diamonds: 0, superChest: false };
}
