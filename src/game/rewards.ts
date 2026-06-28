import { getMultiplierLabel } from '../data/multipliers';
import { LEVEL_COMPLETE_ENERGY_REWARD } from './economy';
import type { GameState, RewardSummary } from '../types';

export function calculateRewardSummary(state: GameState): RewardSummary {
  const stars = calculateStars(state);
  const starEnergy = getStarEnergyCumulative(stars);
  const multiplierReward = getMultiplierReward(state.highestMultiplierIndex);
  const totalEnergy = LEVEL_COMPLETE_ENERGY_REWARD + multiplierReward.energy + starEnergy;

  return {
    stars,
    levelEnergy: LEVEL_COMPLETE_ENERGY_REWARD,
    starEnergy,
    multiplierLabel: getMultiplierLabel(state.highestMultiplierIndex) || 'x0',
    multiplierEnergy: multiplierReward.energy,
    multiplierDiamonds: multiplierReward.diamonds,
    superChest: multiplierReward.superChest,
    totalEnergy,
    totalDiamonds: multiplierReward.diamonds,
    actualEnergyGained: totalEnergy,
    energyCapped: false
  };
}

// 1 star: completed; 2 stars: final multiplier ≥ x64; 3 stars: final multiplier ≥ x128
function calculateStars(state: GameState): number {
  if (state.highestMultiplierIndex >= 7) return 3; // x128
  if (state.highestMultiplierIndex >= 6) return 2; // x64
  return 1;
}

// Cumulative energy for star tier (not incremental — incremental is computed in triggerLevelWin)
export function getStarEnergyCumulative(stars: number): number {
  if (stars >= 3) return 20;
  if (stars >= 2) return 10;
  return 0;
}

function getMultiplierReward(multiplierIndex: number): { energy: number; diamonds: number; superChest: boolean } {
  if (multiplierIndex >= 10) return { energy: 100, diamonds: 100, superChest: true };
  if (multiplierIndex >= 9) return { energy: 50, diamonds: 50, superChest: false };
  if (multiplierIndex >= 8) return { energy: 20, diamonds: 20, superChest: false };
  if (multiplierIndex >= 7) return { energy: 10, diamonds: 10, superChest: false };
  return { energy: 0, diamonds: 0, superChest: false };
}
