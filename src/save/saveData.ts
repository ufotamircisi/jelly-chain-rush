import { STARTING_ENERGY } from '../game/economy';
import { detectLocale, isLocaleCode } from '../locales';
import { SHAKES_PER_LEVEL, type LocaleCode, type SaveData } from '../types';

export const SAVE_VERSION = 3;
export const SAVE_KEY = 'jelly-chain-rush.save.v3';
const LEGACY_SAVE_KEYS = ['jelly-chain-rush.save.v2', 'jelly-chain-rush.save.v1'];

type ImportResult =
  | { ok: true; data: SaveData }
  | { ok: false; error: 'invalid' };

export function createDefaultSave(): SaveData {
  const language = detectLocale();

  return stampSave({
    saveVersion: SAVE_VERSION,
    lastSavedAt: '',
    hasStartedGame: false,
    currentLevel: 1,
    highestUnlockedLevel: 1,
    completedLevels: [],
    shownForcedAdMilestones: [],
    claimedRewardedMilestones: [],
    energy: STARTING_ENERGY,
    shakes: SHAKES_PER_LEVEL,
    lastRegenAt: '',
    energyStarLevelsSince: 0,
    colorBombLevelsSince: 0,
    energyStarDiscovered: false,
    colorBombDiscovered: false,
    energyStarClaimedLevel: 0,
    colorBombClaimedLevel: 0,
    diamonds: 300,
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
      highestMultiplierEver: 0,
      highScore: 0
    },
    settings: {
      language,
      soundEnabled: true,
      vibrationEnabled: true
    },
    language,
    soundEnabled: true,
    vibrationEnabled: true
  });
}

export function loadSave(): SaveData {
  const fallback = createDefaultSave();
  const raw = window.localStorage.getItem(SAVE_KEY) ?? LEGACY_SAVE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);

  if (!raw) {
    saveData(fallback);
    return fallback;
  }

  try {
    return normalizeSave(JSON.parse(raw), fallback);
  } catch {
    saveData(fallback);
    return fallback;
  }
}

export function saveData(data: SaveData): void {
  const next = stampSave(normalizeSave(data));
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  window.localStorage.setItem('jcr.language', next.language);
  Object.assign(data, next);
}

export function markLevelCompleted(data: SaveData, level: number, highScore = 0): SaveData {
  const completedLevels = [...new Set([...data.completedLevels, level])].sort((a, b) => a - b);
  const highestUnlockedLevel = Math.max(data.highestUnlockedLevel, level + 1);
  const currentLevel = Math.max(1, Math.min(highestUnlockedLevel, getCurrentPlayableLevel(completedLevels, highestUnlockedLevel)));
  const next: SaveData = {
    ...data,
    currentLevel,
    highestUnlockedLevel,
    completedLevels,
    stats: {
      ...data.stats,
      levelsCompleted: completedLevels.length,
      highScore: Math.max(data.stats.highScore, highScore)
    }
  };
  saveData(next);
  return loadSave();
}

export function getCurrentPlayableLevel(completedLevels: number[], highestUnlockedLevel: number): number {
  for (let level = 1; level <= highestUnlockedLevel; level += 1) {
    if (!completedLevels.includes(level)) return level;
  }
  return highestUnlockedLevel;
}

export function updateLanguage(data: SaveData, language: LocaleCode): SaveData {
  const next = normalizeSave({
    ...data,
    language,
    settings: { ...data.settings, language }
  });
  saveData(next);
  return loadSave();
}

export function updateSoundEnabled(data: SaveData, soundEnabled: boolean): SaveData {
  const next = normalizeSave({
    ...data,
    soundEnabled,
    settings: { ...data.settings, soundEnabled }
  });
  saveData(next);
  return loadSave();
}

export function updateVibrationEnabled(data: SaveData, vibrationEnabled: boolean): SaveData {
  const next = normalizeSave({
    ...data,
    vibrationEnabled,
    settings: { ...data.settings, vibrationEnabled }
  });
  saveData(next);
  return loadSave();
}

export function exportBackupCode(data: SaveData): string {
  const normalized = stampSave(normalizeSave(data));
  const json = JSON.stringify(normalized);
  return window.btoa(unescape(encodeURIComponent(json)));
}

export function importBackupCode(code: string): ImportResult {
  try {
    const json = decodeURIComponent(escape(window.atob(code.trim())));
    const normalized = normalizeSave(JSON.parse(json));
    saveData(normalized);
    return { ok: true, data: loadSave() };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}

function normalizeSave(input: Partial<SaveData>, fallback = createDefaultSave()): SaveData {
  const settings = {
    language: isLocaleCode(input.settings?.language ?? input.language ?? '') ? (input.settings?.language ?? input.language) as LocaleCode : fallback.language,
    soundEnabled: input.settings?.soundEnabled ?? input.soundEnabled ?? fallback.soundEnabled,
    vibrationEnabled: input.settings?.vibrationEnabled ?? input.vibrationEnabled ?? fallback.vibrationEnabled
  };
  const explicitCompletedLevels = sanitizeNumberArray(input.completedLevels);
  const legacyCompletedCount = clampNumber(input.stats?.levelsCompleted, 0, 999999, 0);
  const completedLevels = explicitCompletedLevels.length
    ? explicitCompletedLevels
    : Array.from({ length: legacyCompletedCount }, (_, index) => index + 1);
  const highestUnlockedLevel = Math.max(1, Math.floor(input.highestUnlockedLevel ?? input.currentLevel ?? fallback.highestUnlockedLevel));
  const currentLevel = Math.max(1, Math.min(highestUnlockedLevel, Math.floor(input.currentLevel ?? getCurrentPlayableLevel(completedLevels, highestUnlockedLevel))));
  const statsHighScore = clampNumber(input.stats?.highScore, 0, 999999999, fallback.stats.highScore);
  const totalBlasts = clampNumber(input.stats?.totalBlasts, 0, 999999999, fallback.stats.totalBlasts);
  const hasProgress = currentLevel > 1 || highestUnlockedLevel > 1 || completedLevels.length > 0 || statsHighScore > 0 || totalBlasts > 0;

  return {
    saveVersion: SAVE_VERSION,
    lastSavedAt: typeof input.lastSavedAt === 'string' ? input.lastSavedAt : fallback.lastSavedAt,
    hasStartedGame: input.hasStartedGame ?? hasProgress,
    currentLevel,
    highestUnlockedLevel,
    completedLevels,
    shownForcedAdMilestones: sanitizeNumberArray(input.shownForcedAdMilestones),
    claimedRewardedMilestones: sanitizeNumberArray(input.claimedRewardedMilestones),
    energy: clampNumber(input.energy, 0, 999, fallback.energy),
    shakes: clampNumber(input.shakes, 0, 99, SHAKES_PER_LEVEL),
    lastRegenAt: typeof input.lastRegenAt === 'string' && input.lastRegenAt ? input.lastRegenAt : '',
    energyStarLevelsSince: clampNumber(input.energyStarLevelsSince, 0, 9999, 0),
    colorBombLevelsSince: clampNumber(input.colorBombLevelsSince, 0, 9999, 0),
    energyStarDiscovered: typeof input.energyStarDiscovered === 'boolean' ? input.energyStarDiscovered : false,
    colorBombDiscovered: typeof input.colorBombDiscovered === 'boolean' ? input.colorBombDiscovered : false,
    energyStarClaimedLevel: clampNumber(input.energyStarClaimedLevel, 0, 9999, 0),
    colorBombClaimedLevel: clampNumber(input.colorBombClaimedLevel, 0, 9999, 0),
    diamonds: clampNumber(input.diamonds, 0, 999999, fallback.diamonds),
    superChests: clampNumber(input.superChests, 0, 999999, fallback.superChests),
    chests: clampNumber(input.chests, 0, 999999, fallback.chests),
    completedBuildingIds: sanitizeNumberArray(input.completedBuildingIds).length ? sanitizeNumberArray(input.completedBuildingIds) : fallback.completedBuildingIds,
    buildingClaimDates: input.buildingClaimDates && typeof input.buildingClaimDates === 'object' ? input.buildingClaimDates : fallback.buildingClaimDates,
    dailyLogin: {
      streak: clampNumber(input.dailyLogin?.streak, 0, 9999, fallback.dailyLogin.streak),
      lastClaimDate: input.dailyLogin?.lastClaimDate ?? fallback.dailyLogin.lastClaimDate
    },
    stats: {
      levelsCompleted: Math.max(completedLevels.length, clampNumber(input.stats?.levelsCompleted, 0, 999999, fallback.stats.levelsCompleted)),
      totalBlasts,
      highestMultiplierEver: clampNumber(input.stats?.highestMultiplierEver, 0, 1000, fallback.stats.highestMultiplierEver),
      highScore: statsHighScore
    },
    settings,
    language: settings.language,
    soundEnabled: settings.soundEnabled,
    vibrationEnabled: settings.vibrationEnabled
  };
}

function stampSave(data: SaveData): SaveData {
  return {
    ...data,
    saveVersion: SAVE_VERSION,
    lastSavedAt: new Date().toISOString(),
    settings: {
      language: data.language,
      soundEnabled: data.soundEnabled,
      vibrationEnabled: data.vibrationEnabled
    }
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(min, Math.min(max, number));
}

function sanitizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))].sort((a, b) => a - b);
}
