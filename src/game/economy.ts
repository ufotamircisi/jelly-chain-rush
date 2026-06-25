export const STARTING_ENERGY = 100;
export const FREE_ENERGY_CAP = 300;
export const HARD_ENERGY_CAP = 999;
export const SHAKE_ENERGY_COST = 20;
export const LEVEL_COMPLETE_ENERGY_REWARD = 100;

export const MARKET_ENERGY_ITEMS = [
  { energy: 50, cost: 50, labelKey: 'marketEnergySmall' },
  { energy: 100, cost: 90, labelKey: 'marketEnergyMedium' },
  { energy: 250, cost: 200, labelKey: 'marketEnergyLarge' }
] as const;

export const MARKET_SHAKE_ITEMS = [
  { shakes: 1, cost: 100, labelKey: 'marketOneShake' },
  { shakes: 3, cost: 250, labelKey: 'marketThreeShakes' },
  { shakes: 5, cost: 400, labelKey: 'marketFiveShakes' }
] as const;

export const MARKET_DIAMOND_PACKS = [
  { diamonds: 100, priceUsd: 1.99, labelKey: 'marketDiamondPack100' },
  { diamonds: 250, priceUsd: 3.99, labelKey: 'marketDiamondPack250' },
  { diamonds: 500, priceUsd: 5.99, labelKey: 'marketDiamondPack500' },
  { diamonds: 1000, priceUsd: 9.99, labelKey: 'marketDiamondPack1000' },
  { diamonds: 2500, priceUsd: 19.99, labelKey: 'marketDiamondPack2500' },
  { diamonds: 5000, priceUsd: 29.99, labelKey: 'marketDiamondPack5000' },
  { diamonds: 10000, priceUsd: 49.99, labelKey: 'marketDiamondPack10000' }
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
