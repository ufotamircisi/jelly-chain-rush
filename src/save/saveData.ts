import { detectLocale } from '../locales';
import type { LocaleCode, SaveData } from '../types';

const SAVE_KEY = 'jelly-chain-rush.save.v1';

export function createDefaultSave(): SaveData {
  return {
    currentLevel: 1,
    highestUnlockedLevel: 1,
    energy: 100,
    diamonds: 250,
    superChests: 0,
    chests: 0,
    completedBuildingIds: [1],
    buildingClaimDates: {},
    dailyLogin: {
      streak: 0,
      lastClaimDate: ''
    },
    stats: {
      levelsCompleted: 0,
      totalBlasts: 0,
      highestMultiplierEver: 0
    },
    language: detectLocale()
  };
}

export function loadSave(): SaveData {
  const fallback = createDefaultSave();
  const raw = window.localStorage.getItem(SAVE_KEY);

  if (!raw) {
    saveData(fallback);
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      currentLevel: parsed.currentLevel ?? fallback.currentLevel,
      highestUnlockedLevel: parsed.highestUnlockedLevel ?? parsed.currentLevel ?? fallback.highestUnlockedLevel,
      energy: parsed.energy ?? fallback.energy,
      diamonds: parsed.diamonds ?? fallback.diamonds,
      superChests: parsed.superChests ?? fallback.superChests,
      chests: parsed.chests ?? fallback.chests,
      completedBuildingIds: parsed.completedBuildingIds?.length ? parsed.completedBuildingIds : fallback.completedBuildingIds,
      buildingClaimDates: parsed.buildingClaimDates ?? fallback.buildingClaimDates,
      dailyLogin: {
        streak: parsed.dailyLogin?.streak ?? fallback.dailyLogin.streak,
        lastClaimDate: parsed.dailyLogin?.lastClaimDate ?? fallback.dailyLogin.lastClaimDate
      },
      stats: {
        levelsCompleted: parsed.stats?.levelsCompleted ?? fallback.stats.levelsCompleted,
        totalBlasts: parsed.stats?.totalBlasts ?? fallback.stats.totalBlasts,
        highestMultiplierEver: parsed.stats?.highestMultiplierEver ?? fallback.stats.highestMultiplierEver
      },
      language: parsed.language ?? fallback.language
    };
  } catch {
    saveData(fallback);
    return fallback;
  }
}

export function saveData(data: SaveData): void {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  window.localStorage.setItem('jcr.language', data.language);
}

export function updateLanguage(data: SaveData, language: LocaleCode): SaveData {
  const next = { ...data, language };
  saveData(next);
  return next;
}
