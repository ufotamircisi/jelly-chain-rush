import { applyMarketEnergy } from '../game/economy';
import { saveData } from '../save/saveData';
import type { SaveData } from '../types';

export const FORCED_AD_INTERVAL = 5;
export const REWARDED_AD_INTERVAL = 10;
export const REWARDED_BONUS_ENERGY = 50;
export const REWARDED_BONUS_DIAMONDS = 50;
export const CONTINUE_AD_ENERGY_REWARD = 20;

export interface AdFlowPlan {
  completedLevel: number;
  showForcedBreak: boolean;
  showRewardedOffer: boolean;
}

export function createAdFlowPlan(save: SaveData, completedLevel: number, wasAlreadyCompleted: boolean): AdFlowPlan {
  // TODO: Skip forced breaks and banner placement here when a future Remove Ads purchase sets adsRemoved === true.
  const firstCompletion = !wasAlreadyCompleted;
  return {
    completedLevel,
    showForcedBreak:
      firstCompletion
      && completedLevel % FORCED_AD_INTERVAL === 0
      && !save.shownForcedAdMilestones.includes(completedLevel),
    showRewardedOffer:
      completedLevel % REWARDED_AD_INTERVAL === 0
      && !save.claimedRewardedMilestones.includes(completedLevel)
  };
}

export function markForcedBreakShown(save: SaveData, completedLevel: number): SaveData {
  if (save.shownForcedAdMilestones.includes(completedLevel)) return save;
  save.shownForcedAdMilestones = [...save.shownForcedAdMilestones, completedLevel].sort((a, b) => a - b);
  saveData(save);
  return save;
}

export function claimRewardedMilestone(save: SaveData, completedLevel: number): { save: SaveData; gainedEnergy: number; capped: boolean; claimed: boolean } {
  if (save.claimedRewardedMilestones.includes(completedLevel)) {
    return { save, gainedEnergy: 0, capped: false, claimed: false };
  }

  // TODO: Replace this immediate success path with a real rewarded ad completion callback.
  const energyResult = applyMarketEnergy(save.energy, REWARDED_BONUS_ENERGY);
  save.energy = energyResult.energy;
  save.diamonds += REWARDED_BONUS_DIAMONDS;
  save.claimedRewardedMilestones = [...save.claimedRewardedMilestones, completedLevel].sort((a, b) => a - b);
  saveData(save);
  return { save, gainedEnergy: energyResult.gained, capped: energyResult.capped, claimed: true };
}
