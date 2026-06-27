export const STARTING_ENERGY = 300;
export const FREE_ENERGY_CAP = 300;
export const HARD_ENERGY_CAP = 999;
export const SHAKE_ENERGY_COST = 20;
export const RESTART_COST = 100;
export const LEVEL_COMPLETE_ENERGY_REWARD = 100;

export const REGEN_INTERVAL_MS = 15 * 60 * 1000;
export const REGEN_ENERGY_AMOUNT = 20;
export const REGEN_ENERGY_CAP = 100;
export const REGEN_START_THRESHOLD = 10;
const MAX_REGEN_TICKS = 24;

export function applyOfflineRegen(
  energy: number,
  shakes: number,
  lastRegenAt: string
): { energy: number; shakes: number; lastRegenAt: string; energyGained: number; shakesGained: number } {
  // Regen only activates when energy first drops to REGEN_START_THRESHOLD or below.
  // While lastRegenAt is empty and energy is above threshold, regen has not yet started.
  if (energy > REGEN_START_THRESHOLD && !lastRegenAt) {
    return { energy, shakes, lastRegenAt, energyGained: 0, shakesGained: 0 };
  }
  // Once energy reaches the cap, stop regen and clear the timer.
  if (energy >= REGEN_ENERGY_CAP) {
    return { energy, shakes, lastRegenAt: '', energyGained: 0, shakesGained: 0 };
  }

  const now = Date.now();
  const lastMs = lastRegenAt ? new Date(lastRegenAt).getTime() : 0;

  if (!lastMs || !Number.isFinite(lastMs) || lastMs > now) {
    return { energy, shakes, lastRegenAt: new Date(now).toISOString(), energyGained: 0, shakesGained: 0 };
  }

  const ticks = Math.min(Math.floor((now - lastMs) / REGEN_INTERVAL_MS), MAX_REGEN_TICKS);
  if (ticks === 0) return { energy, shakes, lastRegenAt, energyGained: 0, shakesGained: 0 };

  let e = energy;
  let eg = 0;

  for (let i = 0; i < ticks; i++) {
    if (e < REGEN_ENERGY_CAP) {
      const gain = Math.min(REGEN_ENERGY_AMOUNT, REGEN_ENERGY_CAP - e);
      e += gain;
      eg += gain;
    }
  }

  return {
    energy: e,
    shakes,
    lastRegenAt: new Date(lastMs + ticks * REGEN_INTERVAL_MS).toISOString(),
    energyGained: eg,
    shakesGained: 0
  };
}

export function getRegenMsUntilNext(lastRegenAt: string): number {
  if (!lastRegenAt) return REGEN_INTERVAL_MS;
  const lastMs = new Date(lastRegenAt).getTime();
  if (!Number.isFinite(lastMs)) return REGEN_INTERVAL_MS;
  return Math.max(0, lastMs + REGEN_INTERVAL_MS - Date.now());
}

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
