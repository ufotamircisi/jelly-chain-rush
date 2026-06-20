export const STARTING_ENERGY = 100;
export const FREE_ENERGY_CAP = 300;
export const HARD_ENERGY_CAP = 999;
export const SHAKE_ENERGY_COST = 10;
export const LEVEL_COMPLETE_ENERGY_REWARD = 100;

export const MARKET_ENERGY_ITEMS = [
  { energy: 50, cost: 50, labelKey: 'marketEnergySmall' },
  { energy: 100, cost: 90, labelKey: 'marketEnergyMedium' },
  { energy: 250, cost: 200, labelKey: 'marketEnergyLarge' }
] as const;

export const MARKET_SHAKE_ITEMS = [
  { shakes: 1, cost: 100, labelKey: 'marketOneShake' },
  { shakes: 5, cost: 300, labelKey: 'marketFiveShakes' },
  { shakes: 10, cost: 600, labelKey: 'marketTenShakes' }
] as const;

export function applyFreeEnergy(currentEnergy: number, rewardEnergy: number): { energy: number; gained: number; capped: boolean } {
  if (currentEnergy >= FREE_ENERGY_CAP) {
    return { energy: currentEnergy, gained: 0, capped: rewardEnergy > 0 };
  }

  const nextEnergy = Math.min(FREE_ENERGY_CAP, currentEnergy + rewardEnergy);
  return {
    energy: nextEnergy,
    gained: nextEnergy - currentEnergy,
    capped: rewardEnergy > 0 && nextEnergy - currentEnergy < rewardEnergy
  };
}

export function applyMarketEnergy(currentEnergy: number, purchasedEnergy: number): { energy: number; gained: number; capped: boolean } {
  if (currentEnergy >= HARD_ENERGY_CAP) {
    return { energy: currentEnergy, gained: 0, capped: purchasedEnergy > 0 };
  }

  const nextEnergy = Math.min(HARD_ENERGY_CAP, currentEnergy + purchasedEnergy);
  return {
    energy: nextEnergy,
    gained: nextEnergy - currentEnergy,
    capped: purchasedEnergy > 0 && nextEnergy - currentEnergy < purchasedEnergy
  };
}
