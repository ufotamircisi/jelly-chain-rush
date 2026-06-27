import { getMultiplierLabel } from '../data/multipliers';
import { LEVEL_COMPLETE_ENERGY_REWARD } from './economy';
import type { GameState, RewardSummary } from '../types';

export function calculateRewardSummary(state: GameState): RewardSummary {
  const stars = calculateStars(state);
  const starDiamonds = getStarDiamondsCumulative(stars);
  const multiplierReward = getMultiplierReward(state.highestMultiplierIndex);

  return {
    stars,
    levelEnergy: LEVEL_COMPLETE_ENERGY_REWARD,
    starEnergy: 0,
    starDiamonds,
    multiplierLabel: getMultiplierLabel(state.highestMultiplierIndex) || 'x0',
    multiplierEnergy: multiplierReward.energy,
    multiplierDiamonds: multiplierReward.diamonds,
    superChest: multiplierReward.superChest,
    totalEnergy: LEVEL_COMPLETE_ENERGY_REWARD + multiplierReward.energy,
    totalDiamonds: multiplierReward.diamonds,
    actualEnergyGained: LEVEL_COMPLETE_ENERGY_REWARD + multiplierReward.energy,
    energyCapped: false
  };
}

// 1 star: completed; 2 stars: final multiplier ≥ x64; 3 stars: final multiplier ≥ x128
function calculateStars(state: GameState): number {
  if (state.highestMultiplierIndex >= 7) return 3; // x128
  if (state.highestMultiplierIndex >= 6) return 2; // x64
  return 1;
}

// Cumulative diamonds for star tier (not incremental — incremental is computed in triggerLevelWin)
export function getStarDiamondsCumulative(stars: number): number {
  if (stars >= 3) return 15; // 5 + 10
  if (stars >= 2) return 5;
  return 0;
}

function getStarReward(stars: number): { energy: number; diamonds: number } {
  return { energy: 0, diamonds: getStarDiamondsCumulative(stars) };
}

function getMultiplierReward(multiplierIndex: number): { energy: number; diamonds: number; superChest: boolean } {
  if (multiplierIndex >= 10) return { energy: 100, diamonds: 100, superChest: true };
  if (multiplierIndex >= 9) return { energy: 50, diamonds: 50, superChest: false };
  if (multiplierIndex >= 8) return { energy: 20, diamonds: 20, superChest: false };
  if (multiplierIndex >= 7) return { energy: 10, diamonds: 10, superChest: false };
  return { energy: 0, diamonds: 0, superChest: false };
}
