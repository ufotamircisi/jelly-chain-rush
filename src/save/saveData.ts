import { detectLocale } from '../locales';
import type { LocaleCode, SaveData } from '../types';

const SAVE_KEY = 'jelly-chain-rush.save.v1';

export function createDefaultSave(): SaveData {
  return {
    currentLevel: 1,
    energy: 100,
    diamonds: 250,
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
      energy: parsed.energy ?? fallback.energy,
      diamonds: parsed.diamonds ?? fallback.diamonds,
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
