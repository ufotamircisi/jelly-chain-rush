import Phaser from 'phaser';
import { getBuildingAsset } from '../assets/buildingAssetManifest';
import { CANDY_ASSET_PACK, CANDY_TEXTURE_KEY_BY_TYPE } from '../assets/candyAssetManifest';
import { ISLAND_BASE_ASSET } from '../assets/islandAssetManifest';
import { UI_ASSETS } from '../assets/uiAssetManifest';
import { CandySfx } from '../audio/sfx';
import { BUILDINGS } from '../data/buildings';
import { getCandyDefinition } from '../data/candies';
import { getMultiplierLabel } from '../data/multipliers';
import {
  areAdjacent,
  applyComboMultiplierUpgrade,
  type CascadeStep,
  getHighestMultiplierIndex,
  hasValidSwipeMove,
  regenerateCandies,
  resolveMatchesAndCascades,
  swapCandies
} from '../game/boardModel';
import { getLocalDateKey, isBeforeToday } from '../game/calendar';
import { getDailyReward } from '../game/dailyRewards';
import {
  applyFreeEnergy,
  applyMarketEnergy,
  applyOfflineRegen,
  getRegenMsUntilNext,
  HARD_ENERGY_CAP,
  MARKET_DIAMOND_PACKS,
  MARKET_ENERGY_ITEMS,
  MARKET_SHAKE_ITEMS,
  REGEN_ENERGY_AMOUNT,
  REGEN_ENERGY_CAP,
  REGEN_START_THRESHOLD,
  RESTART_COST,
  SHAKE_ENERGY_COST
} from '../game/economy';
import { createGameState } from '../game/gameState';
import {
  COLOR_BOMB_REWARD_DIAMONDS,
  COLOR_BOMB_REWARD_ENERGY,
  COLOR_BOMB_THRESHOLD,
  consumeCandyFromBoard,
  countCandyOnBoard,
  ENERGY_STAR_REWARD,
  ENERGY_STAR_THRESHOLD,
  injectSpecialTilesIntoBoard,
  onColorBombEventFired,
  onEnergyStarEventFired,
  onFirstTimeLevelCompleted,
  shouldInjectColorBomb,
  shouldInjectEnergyStar
} from '../game/specialTiles';
import { areGoalsComplete, getGoalProgress } from '../game/levels';
import { calculateRewardSummary, getStarDiamondsCumulative } from '../game/rewards';
import { createTranslator, LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES, type TranslationKey } from '../locales';
import {
  claimRewardedMilestone,
  CONTINUE_AD_ENERGY_REWARD,
  createAdFlowPlan,
  markForcedBreakShown,
  type AdFlowPlan
} from '../services/adPlaceholderService';
import {
  exportBackupCode,
  getCurrentPlayableLevel,
  importBackupCode,
  loadSave,
  markLevelCompleted,
  saveData,
  updateLanguage,
  updateSoundEnabled,
  updateVibrationEnabled
} from '../save/saveData';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  SHAKES_PER_LEVEL,
  type BoardGrid,
  type BoardPosition,
  type CandyType,
  type GameState,
  type LevelGoal,
  type LocaleCode,
  type RewardSummary,
  type SaveData,
  type ScreenKey
} from '../types';

const GAME_SIZE = 380;
const BOARD_SIZE = 370;
const CELL_SIZE = BOARD_SIZE / BOARD_COLUMNS;
const BOARD_X = (GAME_SIZE - BOARD_SIZE) / 2;
const BOARD_Y = (GAME_SIZE - BOARD_SIZE) / 2;
const CANDY_IMAGE_SIZE = CELL_SIZE * 0.84;
const CANDY_IMAGE_OFFSET_Y = -2;
const MULTIPLIER_LABEL_OFFSET_Y = 14;
const CASCADE_SETTLE_DELAY_MS = 1000;
const APP_VERSION = '0.1.0';
const SHOW_BANNER_PLACEHOLDER = false;
const LEVEL_ROAD_SEGMENT_SIZE = 50;
const LEVEL_ROAD_MAP_ASPECT_RATIO = 1672 / 941;
const LEVEL_ROAD_FALLBACK_WIDTH = 390;
const LEVEL_ROAD_NODE_PATH = [
  { x: 0.6, y: 0.105 },
  { x: 0.47, y: 0.175 },
  { x: 0.57, y: 0.25 },
  { x: 0.45, y: 0.325 },
  { x: 0.56, y: 0.4 },
  { x: 0.44, y: 0.475 },
  { x: 0.55, y: 0.55 },
  { x: 0.45, y: 0.625 },
  { x: 0.56, y: 0.7 },
  { x: 0.46, y: 0.775 },
  { x: 0.57, y: 0.85 },
  { x: 0.48, y: 0.925 },
  { x: 0.61, y: 0.975 }
] as const;
const PRIVACY_URL = 'https://lumisoftstudios.com/jelly-chain-rush/privacy';
const TERMS_URL = 'https://lumisoftstudios.com/jelly-chain-rush/terms';
const SUPPORT_URL = 'https://lumisoftstudios.com/contact';
const TODAY = () => getLocalDateKey();

const MULTIPLIER_TINTS = [
  0xdff8ff,
  0x8be9ff,
  0xb88cff,
  0xff91c8,
  0xffc05d,
  0xffef78,
  0x7ee4a0,
  0x6fd7ff,
  0xd8a3ff,
  0xff8a73,
  0xffd33f
];

const ISLAND_BUILDING_LAYOUT: Record<number, { x: number; y: number; size: 'small' | 'medium' | 'large' }> = {
  1: { x: 53, y: 568, size: 'small' },
  2: { x: 29, y: 523, size: 'small' },
  3: { x: 79, y: 520, size: 'small' },
  4: { x: 53, y: 493, size: 'small' },
  5: { x: 28, y: 411, size: 'medium' },
  6: { x: 80, y: 374, size: 'medium' },
  7: { x: 54, y: 373, size: 'medium' },
  8: { x: 74, y: 307, size: 'medium' },
  9: { x: 25, y: 336, size: 'medium' },
  10: { x: 46, y: 285, size: 'medium' },
  11: { x: 74, y: 212, size: 'large' },
  12: { x: 26, y: 215, size: 'medium' },
  13: { x: 51, y: 165, size: 'large' },
  14: { x: 78, y: 129, size: 'large' },
  15: { x: 61, y: 107, size: 'large' },
  16: { x: 29, y: 120, size: 'large' },
  17: { x: 31, y: 41, size: 'large' },
  18: { x: 66, y: 22, size: 'large' }
};

export class MainScene extends Phaser.Scene {
  private save!: SaveData;
  private state!: GameState;
  private locale!: LocaleCode;
  private t!: (key: TranslationKey) => string;
  private screen: ScreenKey = 'play';
  private playMode: 'road' | 'game' = 'road';
  private boardContainer?: Phaser.GameObjects.Container;
  private rewardSummary?: RewardSummary;
  private cellContainers = new Map<string, Phaser.GameObjects.Container>();
  private candyContainers = new Map<string, Phaser.GameObjects.Container>();
  private isShaking = false;
  private isDropping = false;
  private isResolving = false;
  private dragStart?: BoardPosition;
  private sfx!: CandySfx;
  private selectedBuildingId?: number;
  private pendingAdFlow?: AdFlowPlan & { forcedHandled: boolean; rewardedHandled: boolean };
  private completedLevelWasReplay = false;
  private goalsCompletedEarly = false;
  private challengeTimerSeconds = 0;
  private challengeTimerRunning = false;
  private challengeBoardLocked = false;
  private challengeTimerWarningFired = false;

  constructor() {
    super('MainScene');
  }

  preload(): void {
    for (const asset of CANDY_ASSET_PACK) {
      if (!this.textures.exists(asset.textureKey)) {
        this.load.image(asset.textureKey, asset.src);
      }
    }
  }

  create(): void {
    this.save = loadSave();
    // Apply offline regen before creating game state so shakes/energy are up to date
    const regenOnLoad = applyOfflineRegen(this.save.energy, this.save.shakes, this.save.lastRegenAt);
    this.save.energy = regenOnLoad.energy;
    this.save.shakes = regenOnLoad.shakes;
    this.save.lastRegenAt = regenOnLoad.lastRegenAt;
    if (regenOnLoad.energyGained > 0 || regenOnLoad.shakesGained > 0) {
      saveData(this.save);
    } else if (!this.save.lastRegenAt) {
      saveData(this.save);
    }

    this.locale = this.save.language;
    this.t = createTranslator(this.locale);
    this.sfx = new CandySfx(this.save.soundEnabled);
    this.state = createGameState(this.save);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.bindOverlay();
    this.bindBoardInput();
    this.renderOverlay();

    // Countdown display: update every second; regen check every minute
    this.time.addEvent({ delay: 1_000, loop: true, callback: this.tickRegen, callbackScope: this });

    if (this.isDailyRewardAvailable()) {
      this.renderDailyRewardModal();
    }
  }

  private bindOverlay(): void {
    this.el('shake-button').addEventListener('click', () => {
      this.playButtonTap();
      this.bumpShakeButton();
      this.handleShake();
    });

    this.el('settings-button').addEventListener('click', () => {
      this.playButtonTap();
      this.renderSettingsModal();
    });

    this.el('continue-level-button').addEventListener('click', () => {
      this.playButtonTap();
      this.startLevel(this.getCurrentPlayableLevel());
    });

    this.el('collect-all-button').addEventListener('click', () => {
      this.playButtonTap();
      this.collectIslandRewards();
    });
    this.el('multiplier-rewards-button').addEventListener('click', () => {
      this.playButtonTap();
      this.renderMultiplierRewardsModal();
    });
    this.el('get-energy-button').addEventListener('click', () => {
      this.playButtonTap();
      this.renderEnergyEmptyModal();
    });
    this.bindIslandMapPan();

    for (const key of ['play', 'island', 'market'] as ScreenKey[]) {
      this.el(`nav-${key}`).addEventListener('click', () => {
        this.playButtonTap();
        this.screen = key;
        if (key === 'play') {
          this.playMode = 'road';
        }
        this.renderOverlay();
      });
    }
  }

  private bindBoardInput(): void {
    // Prevent browser scroll/gesture takeover while the canvas is active.
    const canvasParent = document.getElementById('game');
    if (canvasParent) {
      canvasParent.addEventListener('touchstart', (e) => {
        if (this.playMode === 'game' && this.state.status === 'playing') {
          e.preventDefault();
        }
      }, { passive: false });
      canvasParent.addEventListener('touchmove', (e) => {
        if (this.playMode === 'game' && this.state.status === 'playing') {
          e.preventDefault();
        }
      }, { passive: false });
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.canUseBoardInput()) return;
      const cell = this.worldToCell(pointer.x, pointer.y);
      if (cell) this.dragStart = cell;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragStart) return;
      if (!this.canUseBoardInput()) {
        this.dragStart = undefined;
        return;
      }
      const start = this.dragStart;
      this.dragStart = undefined;
      const end = this.worldToCell(pointer.x, pointer.y);
      if (!end || (end.row === start.row && end.col === start.col)) return;
      this.handleSwipe(start, this.snapToAdjacentCell(start, end));
    });

    this.input.on('pointercancel', () => {
      this.dragStart = undefined;
    });
  }

  private worldToCell(x: number, y: number): BoardPosition | undefined {
    const col = Math.floor((x - BOARD_X) / CELL_SIZE);
    const row = Math.floor((y - BOARD_Y) / CELL_SIZE);
    if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLUMNS) {
      return { row, col };
    }
    return undefined;
  }

  private snapToAdjacentCell(start: BoardPosition, end: BoardPosition): BoardPosition {
    const dr = end.row - start.row;
    const dc = end.col - start.col;
    if (Math.abs(dr) >= Math.abs(dc)) {
      return { row: start.row + Math.sign(dr), col: start.col };
    }
    return { row: start.row, col: start.col + Math.sign(dc) };
  }

  private renderOverlay(): void {
    const gameplayActive = this.screen === 'play' && this.playMode === 'game';
    this.el('phone-frame').classList.toggle('is-gameplay-active', gameplayActive);
    this.el('phone-frame').classList.toggle('has-top-banner', gameplayActive);
    this.el('shake-button').toggleAttribute('disabled', !this.canUseShake());
    this.el('phone-frame').classList.toggle('is-island-active', this.screen === 'island');
    this.el('phone-frame').classList.toggle('is-market-active', this.screen === 'market');
    this.setText('game-title', this.t('title'));
    this.setText('top-ad-banner-text', this.t('title'));
    this.el('top-ad-banner').setAttribute('aria-label', this.t('title'));
    this.renderLogo();
    this.el('settings-button').setAttribute('aria-label', this.t('settings'));
    this.el('settings-button').setAttribute('title', this.t('settings'));
    this.setText('level-label', this.t('level'));
    this.setText('level-value', String(this.state.level));
    this.setText('goal-label', this.t('goal'));
    this.setText('goal-value', this.state.definition.targetScore.toLocaleString());
    this.setText('energy-label', this.t('energy'));
    this.setText('energy-value', String(this.state.energy));
    this.setText('score-label', this.t('score'));
    this.setText('score-value', this.state.score.toLocaleString());
    this.setText('diamonds-label', this.t('diamonds'));
    this.setText('diamonds-value', String(this.state.diamonds));
    this.setText('shake-label', this.t('shake'));
    this.setText('shake-value', `${this.state.shakesRemaining}/${SHAKES_PER_LEVEL}`);
    this.setText('goal-panel-title', this.t('goal'));
    this.setText('helper-text', this.getHelperText());
    this.setText('multiplier-rewards-title', this.t('multiplierRewards'));
    this.setText('multiplier-next-reward', this.t('nextMultiplierReward'));
    this.setText('multiplier-rewards-button', this.t('viewRewards'));
    this.setText('shake-button', this.t('shakeButton'));
    this.setText('get-energy-button', this.t('getEnergy'));
    this.el('get-energy-button').classList.toggle('is-visible', gameplayActive && this.state.status === 'playing' && this.state.energy < SHAKE_ENERGY_COST);
    this.setText('island-title', this.t('islandTitle'));
    this.setText('collect-all-button', this.t('collectAll'));
    this.setText('market-title', this.t('market'));
    this.el('level-road-section').classList.toggle('is-active', this.screen === 'play' && this.playMode === 'road');
    this.el('gameplay-section').classList.toggle('is-active', gameplayActive);

    this.renderLevelRoad();
    this.renderGoals();
    this.renderMultiplierRewards();
    this.renderIsland();
    this.renderMarket();
    this.renderNav();
    this.renderUiIcons();
    this.renderModalForStatus();
    this.renderRegenCountdown();
    this.renderChallengeTimer();
  }

  private renderLogo(): void {
    this.el('top-ad-banner').classList.remove('is-active');
    const title = this.el('game-title');
    title.classList.remove('is-hidden-for-banner');
    title.innerHTML = `<img src="${UI_ASSETS.logo}" alt="${this.t('title')}" />`;
  }

  private getCurrentPlayableLevel(): number {
    return getCurrentPlayableLevel(this.save.completedLevels, this.save.highestUnlockedLevel);
  }

  private renderGoals(): void {
    const list = this.el('goal-list');
    list.innerHTML = '';
    const goals = this.state.definition.goals;
    const nonScoreGoals = goals.map((g, i) => ({ goal: g, i })).filter(({ goal }) => goal.type !== 'score');
    const scoreGoals = goals.map((g, i) => ({ goal: g, i })).filter(({ goal }) => goal.type === 'score');

    if (nonScoreGoals.length > 0) {
      const row = document.createElement('div');
      row.className = 'goal-chips-row';
      for (const { goal, i } of nonScoreGoals) {
        const complete = this.isGoalComplete(goal);
        const progress = getGoalProgress(this.state, goal);
        const item = document.createElement('article');
        item.id = `goal-chip-${i}`;
        if (goal.type === 'candy' && goal.candy) {
          const remaining = Math.max(0, goal.target - progress);
          const src = CANDY_ASSET_PACK.find((a) => a.candyType === goal.candy)?.src ?? '';
          item.className = `goal-chip${complete ? ' is-complete' : ''}`;
          item.innerHTML = `<img class="goal-chip-icon" src="${src}" alt=""><span class="goal-chip-count">${remaining}</span>`;
        } else {
          item.className = `goal-chip goal-chip-mult${complete ? ' is-complete' : ''}`;
          item.innerHTML = `<span class="goal-chip-mult-badge">×${goal.target}</span><span class="goal-chip-mult-progress">${complete ? '✓' : `×${progress}`}</span>`;
        }
        row.appendChild(item);
      }
      list.appendChild(row);
    }

    for (const { goal, i } of scoreGoals) {
      const complete = this.isGoalComplete(goal);
      const progress = getGoalProgress(this.state, goal);
      const item = document.createElement('article');
      item.id = `goal-chip-${i}`;
      item.className = `goal-chip goal-chip-score${complete ? ' is-complete' : ''}`;
      item.innerHTML = `<span class="goal-chip-label">${this.t('goalScore')}</span><span class="goal-chip-count">${this.formatScore(progress)} / ${this.formatScore(goal.target)}</span>`;
      list.appendChild(item);
    }
  }

  private renderMultiplierRewards(): void {
    // Kept as a render hook; the full reward list now lives in a modal to preserve gameplay space.
  }

  private getMultiplierRewardRows(): string[][] {
    return [
      ['x128', '+10', '+10', ''],
      ['x256', '+20', '+20', ''],
      ['x512', '+50', '+50', ''],
      ['x1000', '+100', '+100', ` + ${this.t('superChest')}`]
    ];
  }

  private renderMultiplierRewardsModal(): void {
    const rewards = this.getMultiplierRewardRows()
      .map(([label, energy, diamonds, extra]) => `<article class="reward-chip">${label}: ${energy} ${this.t('energy')} ${diamonds} ${this.t('diamonds')}${extra}</article>`)
      .join('');

    this.openModal(`
      <div class="modal-card reward-modal-card">
        <h2>${this.t('multiplierRewards')}</h2>
        <div class="reward-list reward-list-modal">${rewards}</div>
        <button type="button" data-action="close">${this.t('close')}</button>
      </div>
    `);
    this.modalButton('close', () => this.closeModal());
  }

  private renderLevelRoad(): void {
    const currentPlayableLevel = this.getCurrentPlayableLevel();
    const segmentStart = Math.floor((currentPlayableLevel - 1) / LEVEL_ROAD_SEGMENT_SIZE) * LEVEL_ROAD_SEGMENT_SIZE + 1;
    const segmentEnd = segmentStart + LEVEL_ROAD_SEGMENT_SIZE - 1;
    const continueKey = this.save.hasStartedGame ? 'continueLevel' : 'newGameLevel';
    this.setText('level-road-title', this.t('levelRoad'));
    this.setText('road-current-label', this.t('currentLevel'));
    this.setText('road-current-value', String(currentPlayableLevel));
    this.setText('road-completed-label', this.t('completedLevels'));
    this.setText('road-completed-value', String(this.save.completedLevels.length));
    this.setText('road-unlocked-label', this.t('highestUnlockedLevel'));
    this.setText('road-unlocked-value', String(this.save.highestUnlockedLevel));
    this.setText('continue-level-button', this.t(continueKey).replace('{level}', String(currentPlayableLevel)));

    const road = this.el('level-road-list');
    const tileHeight = this.getLevelRoadTileHeight(road);
    const roadHeight = tileHeight * Math.ceil(LEVEL_ROAD_SEGMENT_SIZE / LEVEL_ROAD_NODE_PATH.length);
    road.style.setProperty('--level-road-map', `url("${UI_ASSETS.levelRoad.map}")`);
    road.style.setProperty('--level-road-height', `${roadHeight}px`);
    road.innerHTML = '<div class="level-road-map-art" aria-hidden="true"></div>';

    for (let level = segmentStart; level <= segmentEnd; level += 1) {
      const completed = this.save.completedLevels.includes(level);
      const unlocked = level <= this.save.highestUnlockedLevel;
      const current = level === currentPlayableLevel;
      const playable = unlocked && (!completed || current);
      const segmentIndex = level - segmentStart;
      const nodeImage = completed
        ? UI_ASSETS.levelRoad.nodeCompleted
        : unlocked
          ? UI_ASSETS.levelRoad.nodeDefault
          : UI_ASSETS.levelRoad.nodeLocked;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `level-node${completed ? ' is-completed' : ''}${current ? ' is-current' : ''}${unlocked ? ' is-unlocked' : ' is-locked'}`;
      button.disabled = !playable;
      const position = this.getLevelNodePosition(segmentIndex, tileHeight, roadHeight);
      button.style.left = `${position.x}%`;
      button.style.top = `${position.y}px`;
      button.setAttribute('aria-label', `${this.t('level')} ${level}${unlocked ? '' : ` ${this.t('levelLocked')}`}`);
      button.innerHTML = `
        <img class="level-node-image" src="${nodeImage}" alt="" aria-hidden="true" />
        <span class="level-node-number">${level}</span>
      `;
      if (playable) {
        button.addEventListener('click', () => {
          this.playButtonTap();
          this.startLevel(level);
        });
      }
      road.appendChild(button);
    }

    if (!road.dataset.initialScrollSet) {
      road.dataset.initialScrollSet = 'true';
      window.requestAnimationFrame(() => {
        const currentNode = road.querySelector<HTMLElement>('.level-node.is-current');
        if (currentNode) {
          road.scrollTop = Math.max(0, currentNode.offsetTop - road.clientHeight * 0.38);
        }
      });
    }
  }

  private getLevelRoadTileHeight(road: HTMLElement): number {
    const width = road.clientWidth || LEVEL_ROAD_FALLBACK_WIDTH;
    return Math.round(width * LEVEL_ROAD_MAP_ASPECT_RATIO);
  }

  private getLevelNodePosition(segmentIndex: number, tileHeight: number, roadHeight: number): { x: number; y: number } {
    const point = LEVEL_ROAD_NODE_PATH[segmentIndex % LEVEL_ROAD_NODE_PATH.length];
    const tileIndex = Math.floor(segmentIndex / LEVEL_ROAD_NODE_PATH.length);
    return {
      x: point.x * 100,
      y: roadHeight - tileIndex * tileHeight - point.y * tileHeight
    };
  }

  private renderSettingsModal(message = ''): void {
    const languageOptions = SUPPORTED_LOCALES.map((locale) => {
      const label = LOCALE_NATIVE_NAMES[locale] ?? locale.toUpperCase();
      return `<option value="${locale}"${locale === this.locale ? ' selected' : ''}>${label}</option>`;
    }).join('');
    const lastSaved = this.save.lastSavedAt ? new Date(this.save.lastSavedAt).toLocaleString(this.locale === 'tr' ? 'tr-TR' : 'en-US') : this.t('neverSaved');

    this.openModal(`
      <div class="modal-card settings-card">
        <div class="settings-header">
          <h2>${this.t('settings')}</h2>
          <button class="settings-close" type="button" data-action="close" aria-label="${this.t('close')}">×</button>
        </div>
        <section class="settings-section settings-toggles">
          <label>
            <span>${this.t('sound')}</span>
            <input id="settings-sound-toggle" type="checkbox"${this.save.soundEnabled ? ' checked' : ''} />
          </label>
          <label>
            <span>${this.t('vibration')}</span>
            <input id="settings-vibration-toggle" type="checkbox"${this.save.vibrationEnabled ? ' checked' : ''} />
          </label>
          <label>
            <span>${this.t('language')}</span>
            <select id="settings-language-select">${languageOptions}</select>
          </label>
        </section>
        <section class="settings-section">
          <h3>${this.t('playerProgress')}</h3>
          <p class="settings-save-note">${this.t('autoSaveEnabled')}</p>
          <div class="progress-grid">
            <article><span>${this.t('currentLevel')}</span><strong>${this.save.currentLevel}</strong></article>
            <article><span>${this.t('completedLevels')}</span><strong>${this.save.completedLevels.length}</strong></article>
            <article><span>${this.t('highestUnlockedLevel')}</span><strong>${this.save.highestUnlockedLevel}</strong></article>
            <article><span>${this.t('energy')}</span><strong>${this.state.energy}</strong></article>
            <article><span>${this.t('diamonds')}</span><strong>${this.state.diamonds}</strong></article>
            <article><span>${this.t('shake')}</span><strong>${this.state.shakesRemaining}</strong></article>
          </div>
          <p class="settings-last-saved">${this.t('lastSaved')}: ${lastSaved}</p>
        </section>
        <section class="settings-section settings-actions">
          <button type="button" data-action="show-backup">${this.t('showBackupCode')}</button>
          <button type="button" data-action="enter-backup">${this.t('enterBackupCode')}</button>
        </section>
        <section class="settings-section legal-links">
          <button type="button" data-action="privacy">${this.t('privacyPolicy')}</button>
          <button type="button" data-action="terms">${this.t('termsOfUse')}</button>
          <button type="button" data-action="support">${this.t('support')}</button>
        </section>
        <p class="settings-version">${this.t('version')}: ${APP_VERSION}</p>
        <div class="modal-feedback" aria-live="polite">${message}</div>
      </div>
    `);

    this.modalButton('close', () => this.closeModal());
    this.modalButton('show-backup', () => this.renderBackupCodeModal());
    this.modalButton('enter-backup', () => this.renderImportBackupModal());
    this.modalButton('privacy', () => this.openExternalLink(PRIVACY_URL));
    this.modalButton('terms', () => this.openExternalLink(TERMS_URL));
    this.modalButton('support', () => this.openExternalLink(SUPPORT_URL));

    this.el('settings-sound-toggle').addEventListener('change', (event) => {
      const soundEnabled = (event.currentTarget as HTMLInputElement).checked;
      this.save = updateSoundEnabled(this.save, soundEnabled);
      this.sfx.setMuted(!soundEnabled);
      if (soundEnabled) this.sfx.unlock();
      this.renderOverlay();
      this.renderSettingsModal();
    });

    this.el('settings-vibration-toggle').addEventListener('change', (event) => {
      this.save = updateVibrationEnabled(this.save, (event.currentTarget as HTMLInputElement).checked);
      this.renderOverlay();
      this.renderSettingsModal();
    });

    this.el('settings-language-select').addEventListener('change', (event) => {
      const nextLocale = (event.currentTarget as HTMLSelectElement).value as LocaleCode;
      this.locale = nextLocale;
      this.save = updateLanguage(this.save, nextLocale);
      this.t = createTranslator(this.locale);
      this.renderOverlay();
      this.renderSettingsModal();
    });
  }

  private renderBackupCodeModal(): void {
    this.syncSaveCurrency();
    const code = exportBackupCode(this.save);
    this.openModal(`
      <div class="modal-card settings-card">
        <div class="settings-header">
          <h2>${this.t('backupCode')}</h2>
          <button class="settings-close" type="button" data-action="close" aria-label="${this.t('close')}">×</button>
        </div>
        <textarea id="backup-code-output" class="backup-code-field" readonly>${code}</textarea>
        <div class="settings-actions">
          <button type="button" data-action="copy">${this.t('copy')}</button>
          <button type="button" data-action="back">${this.t('settings')}</button>
        </div>
        <div class="modal-feedback" aria-live="polite"></div>
      </div>
    `);
    this.modalButton('close', () => this.closeModal());
    this.modalButton('back', () => this.renderSettingsModal());
    this.modalButton('copy', async () => {
      const output = this.el('backup-code-output') as HTMLTextAreaElement;
      output.select();
      try {
        await navigator.clipboard?.writeText(output.value);
      } catch {
        document.execCommand('copy');
      }
      this.showWarning(this.t('copied'));
    });
  }

  private renderImportBackupModal(message = ''): void {
    this.openModal(`
      <div class="modal-card settings-card">
        <div class="settings-header">
          <h2>${this.t('enterBackupCode')}</h2>
          <button class="settings-close" type="button" data-action="close" aria-label="${this.t('close')}">×</button>
        </div>
        <textarea id="backup-code-input" class="backup-code-field" placeholder="${this.t('backupCode')}"></textarea>
        <p>${this.t('importConfirm')}</p>
        <div class="settings-actions">
          <button type="button" data-action="import">${this.t('importProgress')}</button>
          <button type="button" data-action="back">${this.t('settings')}</button>
        </div>
        <div class="modal-feedback" aria-live="polite">${message}</div>
      </div>
    `);
    this.modalButton('close', () => this.closeModal());
    this.modalButton('back', () => this.renderSettingsModal());
    this.modalButton('import', () => {
      const input = this.el('backup-code-input') as HTMLTextAreaElement;
      const imported = importBackupCode(input.value);
      if (!imported.ok) {
        this.renderImportBackupModal(this.t('invalidBackupCode'));
        return;
      }

      this.save = imported.data;
      this.locale = this.save.language;
      this.t = createTranslator(this.locale);
      this.sfx.setMuted(!this.save.soundEnabled);
      this.state = createGameState(this.save);
      this.rewardSummary = undefined;
      this.playMode = 'road';
      this.screen = 'play';
      this.children.removeAll();
      this.cellContainers.clear();
      this.candyContainers.clear();
      this.renderOverlay();
      this.renderSettingsModal(this.t('progressImported'));
    });
  }

  private openExternalLink(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private renderIsland(): void {
    const map = this.el('building-list');
    const highestCompletedId = Math.max(0, ...this.save.completedBuildingIds);
    const nextBuildableId = Math.min(highestCompletedId + 1, BUILDINGS.length);
    map.innerHTML = `
      <img class="island-base-image" src="${ISLAND_BASE_ASSET.src}" alt="" aria-hidden="true" />
    `;

    for (const building of BUILDINGS) {
      const completed = this.save.completedBuildingIds.includes(building.id);
      const ready = completed && this.isBuildingReady(building.id);
      const buildable = !completed && building.id === nextBuildableId;
      const layout = ISLAND_BUILDING_LAYOUT[building.id];
      const card = document.createElement('article');
      card.className = `building-node building-${layout.size}${ready ? ' is-ready' : completed ? ' is-completed' : buildable ? ' is-buildable' : ' is-locked'}${this.selectedBuildingId === building.id ? ' is-selected' : ''}`;
      card.style.left = `${layout.x}%`;
      card.style.top = `${layout.y}px`;
      const state = ready ? this.t('readyStatus') : completed ? this.t('completed') : buildable ? this.t('build') : this.t('locked');
      const icon = this.getBuildingIcon(building.id);
      const asset = getBuildingAsset(building.id);
      const image = asset?.[completed ? 'renovated' : 'ruined'];
      const visual = image
        ? `<img src="${image}" alt="" aria-hidden="true" />`
        : icon;

      card.innerHTML = `
        <button class="building-node-button" type="button" data-detail="${building.id}" aria-label="${this.t(building.nameKey as TranslationKey)}">
          <span class="building-icon${image ? ' has-building-image' : ''}" aria-hidden="true">${visual}</span>
          <strong>${this.getBuildingMapLabel(building.id)}</strong>
          <span class="building-state${ready ? ' ready' : ''}">${state}</span>
          ${completed ? '<span class="building-check" aria-hidden="true">✓</span>' : ''}
        </button>
      `;
      map.appendChild(card);
    }

    map.querySelectorAll<HTMLButtonElement>('[data-detail]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedBuildingId = Number(button.dataset.detail);
        this.renderIsland();
      });
    });

    if (!map.dataset.initialScrollSet) {
      map.dataset.initialScrollSet = 'true';
      window.requestAnimationFrame(() => {
        map.scrollLeft = 0;
        map.scrollTop = Math.max(0, map.scrollHeight - map.clientHeight - 138);
      });
    }

    this.renderBuildingDetailPanel();
  }

  private renderMarket(): void {
    const list = this.el('market-list');
    list.innerHTML = '';

    this.renderMarketSection(
      list,
      this.t('energy'),
      MARKET_ENERGY_ITEMS.map((item) => ({
        label: this.t(item.labelKey),
        iconSrc: UI_ASSETS.stats.energy,
        iconLabel: this.t('energy'),
        onClick: () => this.buyMarketEnergy(item.energy, item.cost),
        active: true
      }))
    );

    this.renderMarketSection(
      list,
      this.t('shakes'),
      MARKET_SHAKE_ITEMS.map((item) => ({
        label: this.t(item.labelKey),
        iconSrc: UI_ASSETS.stats.shake,
        iconLabel: this.t('shake'),
        onClick: () => this.buyMarketShakes(item.shakes, item.cost),
        active: true
      }))
    );

    this.renderMarketSection(
      list,
      this.t('marketDiamondPacks'),
      MARKET_DIAMOND_PACKS.map((item) => ({
        label: this.t(item.labelKey),
        iconSrc: UI_ASSETS.stats.diamond,
        iconLabel: this.t('diamonds'),
        onClick: () => this.showWarning(this.t('marketPurchaseReadySoon')),
        active: true
      }))
    );

    // Remove Ads – UI placeholder only, no real IAP implementation
    this.renderMarketSection(
      list,
      this.t('removeAdsTitle'),
      [{
        label: this.t('removeAdsLabel'),
        note: this.t('removeAdsNote'),
        iconSrc: UI_ASSETS.stats.diamond,
        iconLabel: this.t('removeAdsTitle'),
        onClick: () => this.showWarning(this.t('marketPurchaseReadySoon')),
        active: true
      }]
    );
  }

  private renderMarketSection(
    list: HTMLElement,
    title: string,
    items: { label: string; note?: string; iconSrc: string; iconLabel: string; onClick: () => void; active: boolean }[]
  ): void {
    const section = document.createElement('section');
    section.className = 'market-section';
    section.innerHTML = `<h3>${title}</h3>`;

    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'market-card';
      card.innerHTML = `
        <span class="market-icon has-asset-icon" aria-hidden="true"><img src="${item.iconSrc}" alt="" /></span>
        <div class="market-card-body">
          <strong>${item.label}</strong>
          ${item.note ? `<small class="market-card-note">${item.note}</small>` : ''}
        </div>
        <button type="button">${item.active ? this.t('marketAction') : this.t('comingSoon')}</button>
      `;
      card.querySelector('button')?.addEventListener('click', () => {
        this.playButtonTap();
        item.onClick();
      });
      section.appendChild(card);
    }

    list.appendChild(section);
  }

  private renderNav(): void {
    for (const key of ['play', 'island', 'market'] as ScreenKey[]) {
      const tab = this.el(`nav-${key}`);
      tab.classList.toggle('is-active', this.screen === key);
      const label = tab.querySelector('strong');
      if (label) label.textContent = this.t(key);
      this.el(`${key}-view`).classList.toggle('is-active', this.screen === key);
    }
  }

  private renderUiIcons(): void {
    this.renderCounterIcon('counter-energy', UI_ASSETS.stats.energy, this.t('energy'));
    this.renderCounterIcon('counter-diamonds', UI_ASSETS.stats.diamond, this.t('diamonds'));
    this.renderCounterIcon('counter-shakes', UI_ASSETS.stats.shake, this.t('shake'));
    this.renderNavIcon('nav-play', UI_ASSETS.nav.play, this.t('play'));
    this.renderNavIcon('nav-island', UI_ASSETS.nav.island, this.t('island'));
    this.renderNavIcon('nav-market', UI_ASSETS.nav.market, this.t('market'));
  }

  private renderCounterIcon(cardClass: string, src: string, label: string): void {
    const card = this.el('phone-frame').querySelector<HTMLElement>(`.${cardClass}`);
    if (!card) return;
    card.classList.add('has-asset-icon');
    let icon = card.querySelector<HTMLImageElement>('.counter-asset-icon');
    if (!icon) {
      icon = document.createElement('img');
      icon.className = 'counter-asset-icon';
      icon.setAttribute('aria-hidden', 'true');
      card.prepend(icon);
    }
    icon.src = src;
    icon.alt = '';
    icon.title = label;
  }

  private renderNavIcon(buttonId: string, src: string, label: string): void {
    const button = this.el(buttonId);
    const container = button.querySelector<HTMLElement>('.nav-icon');
    if (!container) return;
    container.classList.add('has-asset-icon');
    container.innerHTML = `<img src="${src}" alt="" aria-hidden="true" />`;
    button.setAttribute('aria-label', label);
  }

  private renderBuildingDetailPanel(): void {
    const panel = this.el('building-detail-panel');
    const building = BUILDINGS.find((item) => item.id === this.selectedBuildingId);

    if (!building) {
      panel.classList.remove('is-open');
      panel.innerHTML = '';
      return;
    }

    const highestCompletedId = Math.max(0, ...this.save.completedBuildingIds);
    const nextBuildableId = Math.min(highestCompletedId + 1, BUILDINGS.length);
    const completed = this.save.completedBuildingIds.includes(building.id);
    const ready = completed && this.isBuildingReady(building.id);
    const buildable = !completed && building.id === nextBuildableId;
    const state = ready ? this.t('readyStatus') : completed ? this.t('completed') : buildable ? this.t('build') : this.t('locked');
    const asset = getBuildingAsset(building.id);
    const image = asset?.[completed ? 'renovated' : 'ruined'];
    const visual = image
      ? `<img src="${image}" alt="" aria-hidden="true" />`
      : this.getBuildingIcon(building.id);
    const action = ready
      ? `<button class="building-detail-action" data-detail-claim="${building.id}">${this.t('claim')}</button>`
      : buildable
        ? `<button class="building-detail-action" data-detail-build="${building.id}">${this.t('build')} ${this.getBuildCost(building.id)}</button>`
        : '';

    panel.classList.add('is-open');
    panel.innerHTML = `
      <button class="building-detail-close" type="button" data-detail-close aria-label="${this.t('close')}">×</button>
      <div class="building-detail-icon${image ? ' has-building-image' : ''}" aria-hidden="true">${visual}</div>
      <div class="building-detail-copy">
        <span class="building-detail-kicker">${this.t('buildingDetails')}</span>
        <h3>${this.t(building.nameKey as TranslationKey)}</h3>
        <p><strong>${state}</strong></p>
        <p>${this.t('daily')} ${this.t('production')}: +${building.energy} ${this.t('energy')} +${building.diamonds} ${this.t('diamonds')}</p>
        ${!completed ? `<p>${this.t('buildCost')}: ${this.getBuildCost(building.id)}</p>` : ''}
      </div>
      <div class="building-detail-actions">
        ${action}
        <button class="building-detail-secondary" type="button" data-detail-close>${this.t('close')}</button>
      </div>
    `;

    panel.querySelectorAll<HTMLButtonElement>('[data-detail-close]').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedBuildingId = undefined;
        this.renderBuildingDetailPanel();
        this.renderIsland();
      });
    });
    panel.querySelector<HTMLButtonElement>('[data-detail-claim]')?.addEventListener('click', () => this.claimBuildingReward(building.id));
    panel.querySelector<HTMLButtonElement>('[data-detail-build]')?.addEventListener('click', () => this.buildBuilding(building.id));
  }

  private bindIslandMapPan(): void {
    const map = this.el('building-list');
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    map.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = map.scrollLeft;
      startScrollTop = map.scrollTop;
      map.classList.add('is-dragging');
      map.setPointerCapture(event.pointerId);
    });

    map.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      map.scrollLeft = startScrollLeft - (event.clientX - startX);
      map.scrollTop = startScrollTop - (event.clientY - startY);
    });

    const stopDragging = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      map.classList.remove('is-dragging');
      if (map.hasPointerCapture(event.pointerId)) {
        map.releasePointerCapture(event.pointerId);
      }
    };

    map.addEventListener('pointerup', stopDragging);
    map.addEventListener('pointercancel', stopDragging);
  }

  private renderModalForStatus(): void {
    if (this.state.status === 'won') {
      this.renderWinModal();
    } else if (this.state.status === 'failed') {
      this.renderFailModal();
    } else if (this.el('modal-root').querySelector('.result-card-win, .result-card-fail')) {
      this.closeModal();
    }
  }

  private drawBoard(): void {
    this.children.removeAll();
    this.cellContainers.clear();
    this.candyContainers.clear();
    this.boardContainer = this.add.container(BOARD_X, BOARD_Y);
    this.drawBoardFrame();

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLUMNS; col += 1) {
        const cell = this.state.board[row][col];
        const x = col * CELL_SIZE + CELL_SIZE / 2;
        const y = row * CELL_SIZE + CELL_SIZE / 2;
        const container = this.add.container(x, y);
        this.drawMultiplierFloor(container, cell.multiplierIndex);
        const multiplierLabel = this.add.text(0, MULTIPLIER_LABEL_OFFSET_Y, getMultiplierLabel(cell.multiplierIndex), {
          fontFamily: 'Arial',
          fontSize: cell.multiplierIndex >= 10 ? '12px' : cell.multiplierIndex >= 7 ? '13px' : '12px',
          color: cell.multiplierIndex >= 9 ? '#8a4a00' : '#ffffff',
          fontStyle: 'bold',
          stroke: cell.multiplierIndex >= 9 ? '#fff5b8' : '#4d2382',
          strokeThickness: cell.multiplierIndex > 0 ? 3 : 2
        }).setOrigin(0.5).setAlpha(cell.multiplierIndex > 0 ? 0.88 : 0.32).setDepth(3);
        const candyContainer = this.add.container(0, 0);
        this.drawCandyIcon(candyContainer, cell.candy);
        candyContainer.setDepth(2);
        container.add(candyContainer);
        container.add(multiplierLabel);
        container.setSize(CELL_SIZE, CELL_SIZE);
        this.boardContainer.add(container);
        this.cellContainers.set(this.positionKey({ row, col }), container);
        this.candyContainers.set(this.positionKey({ row, col }), candyContainer);
      }
    }
  }

  private drawBoardFrame(): void {
    const frame = this.add.graphics();
    frame.fillStyle(0x4d2382, 0.28);
    frame.fillRoundedRect(-5, -1, BOARD_SIZE + 10, BOARD_SIZE + 14, 24);
    frame.fillStyle(0xffffff, 0.38);
    frame.fillRoundedRect(-3, -5, BOARD_SIZE + 6, BOARD_SIZE + 8, 23);
    frame.fillStyle(0xff72bd, 0.22);
    frame.fillRoundedRect(0, 0, BOARD_SIZE, BOARD_SIZE, 20);
    frame.fillStyle(0x7ad8ff, 0.14);
    frame.fillRoundedRect(6, 6, BOARD_SIZE - 12, BOARD_SIZE - 12, 17);
    frame.lineStyle(5, 0xffffff, 0.72);
    frame.strokeRoundedRect(-2, -2, BOARD_SIZE + 4, BOARD_SIZE + 4, 22);
    frame.lineStyle(3, 0x7b2bbf, 0.34);
    frame.strokeRoundedRect(5, 5, BOARD_SIZE - 10, BOARD_SIZE - 10, 16);
    this.boardContainer?.add(frame);
  }

  private drawMultiplierFloor(container: Phaser.GameObjects.Container, multiplierIndex: number): void {
    const color = MULTIPLIER_TINTS[multiplierIndex] ?? 0xdff8ff;
    const g = this.add.graphics();
    const size = CELL_SIZE - 8;
    const x = -size / 2;
    const y = -size / 2;
    const alpha = multiplierIndex >= 10 ? 0.86 : multiplierIndex >= 9 ? 0.78 : multiplierIndex >= 7 ? 0.68 : multiplierIndex >= 4 ? 0.56 : multiplierIndex > 0 ? 0.42 : 0.26;
    g.fillStyle(0x2a1754, 0.14);
    g.fillRoundedRect(x + 2, y + 3, size, size, 10);
    g.fillStyle(color, alpha);
    g.fillRoundedRect(x, y, size, size, 10);
    g.lineStyle(2, 0xffffff, multiplierIndex > 0 ? 0.62 : 0.34);
    g.strokeRoundedRect(x, y, size, size, 10);
    if (multiplierIndex >= 10) {
      g.lineStyle(4, 0xffd33f, 0.9);
      g.strokeRoundedRect(x - 1, y - 1, size + 2, size + 2, 11);
      g.lineStyle(2, 0xffb11f, 0.95);
      g.strokeRoundedRect(x + 3, y + 3, size - 6, size - 6, 6);
      g.fillStyle(0xffdd58, 0.28);
      g.fillCircle(0, 0, size * 0.42);
    } else if (multiplierIndex >= 9) {
      g.lineStyle(3, 0xfff1a6, 0.86);
      g.strokeRoundedRect(x + 2, y + 2, size - 4, size - 4, 8);
    } else if (multiplierIndex >= 7) {
      g.lineStyle(3, 0xffffff, 0.58);
      g.strokeRoundedRect(x + 2, y + 2, size - 4, size - 4, 8);
    } else {
      g.fillStyle(0xffffff, 0.22);
    }
    g.fillRoundedRect(x + 5, y + 4, size - 10, 10, 6);
    container.add(g);
  }

  private drawCandyIcon(container: Phaser.GameObjects.Container, candyType: CandyType): void {
    const textureKey = CANDY_TEXTURE_KEY_BY_TYPE[candyType];
    if (textureKey && this.textures.exists(textureKey)) {
      const candyImage = this.add.image(0, CANDY_IMAGE_OFFSET_Y, textureKey)
        .setDisplaySize(CANDY_IMAGE_SIZE, CANDY_IMAGE_SIZE)
        .setOrigin(0.5)
        .setName(textureKey);
      container.add(candyImage);
      return;
    }

    const candy = getCandyDefinition(candyType);
    const g = this.add.graphics();
    const y = -8;

    if (candyType === 'greenGummy') {
      g.fillStyle(0x147a38, 0.22);
      g.fillEllipse(0, y + 17, 31, 9);
      g.fillStyle(0x27c85a, 1);
      g.fillCircle(-10, y - 15, 6);
      g.fillCircle(10, y - 15, 6);
      g.fillRoundedRect(-16, y - 14, 32, 34, 13);
      g.fillStyle(0x9cff9e, 0.5);
      g.fillEllipse(-6, y - 4, 9, 14);
      g.fillStyle(0xffffff, 0.62);
      g.fillCircle(-7, y - 7, 3);
      g.fillCircle(6, y - 7, 3);
      g.lineStyle(3, 0xd6ffd8, 0.9);
      g.strokeRoundedRect(-16, y - 14, 32, 34, 13);
    } else if (candyType === 'purpleJelly') {
      g.fillStyle(0x5e1f8e, 0.24);
      g.fillEllipse(0, y + 16, 34, 8);
      g.fillStyle(0xa83add, 1);
      g.fillRoundedRect(-17, y - 12, 34, 29, 14);
      g.fillStyle(0xd77bff, 0.62);
      g.fillRoundedRect(-12, y - 14, 24, 12, 9);
      g.fillStyle(0xffffff, 0.45);
      g.fillEllipse(-6, y - 7, 10, 15);
      g.lineStyle(3, 0xeadbff, 0.9);
      g.strokeRoundedRect(-17, y - 12, 34, 29, 14);
    } else if (candyType === 'redHeart') {
      g.fillStyle(0x8d1736, 0.22);
      g.fillEllipse(0, y + 17, 32, 8);
      g.fillStyle(0xff385f, 1);
      g.fillCircle(-7, y - 7, 10);
      g.fillCircle(7, y - 7, 10);
      g.fillTriangle(-17, y - 2, 17, y - 2, 0, y + 21);
      g.fillStyle(0xffffff, 0.42);
      g.fillCircle(-8, y - 10, 4);
      g.lineStyle(3, 0xffd3dc, 0.85);
      g.strokeCircle(-7, y - 7, 10);
      g.strokeCircle(7, y - 7, 10);
    } else if (candyType === 'yellowStar' || candyType === 'energyStar') {
      const fill = candyType === 'energyStar' ? 0x86fbff : 0xffd82e;
      const stroke = candyType === 'energyStar' ? 0xffffff : 0xfff5b8;
      if (candyType === 'energyStar') {
        g.fillStyle(0x86fbff, 0.22);
        g.fillCircle(0, y, 27);
      } else {
        g.fillStyle(0x9f6d00, 0.18);
        g.fillEllipse(0, y + 18, 34, 8);
      }
      g.fillStyle(fill, 1);
      g.lineStyle(3, stroke, 0.9);
      const points = this.getStarPoints(0, y, 21, 10, 5);
      g.fillPoints(points, true);
      g.strokePoints(points, true);
      g.fillStyle(0xffffff, candyType === 'energyStar' ? 0.66 : 0.42);
      g.fillCircle(-5, y - 7, 4);
    } else if (candyType === 'blueRound') {
      g.fillStyle(0x0d4f96, 0.22);
      g.fillEllipse(0, y + 18, 34, 8);
      g.fillStyle(0x198eff, 1);
      g.fillCircle(0, y, 20);
      g.fillStyle(0x5ec8ff, 0.52);
      g.fillCircle(4, y + 4, 15);
      g.fillStyle(0xbfe4ff, 0.56);
      g.fillCircle(-7, y - 8, 6);
      g.lineStyle(4, 0xd5e8ff, 0.85);
      g.strokeCircle(0, y, 20);
    } else if (candyType === 'orangeBean') {
      g.fillStyle(0x9e4f11, 0.22);
      g.fillEllipse(0, y + 17, 36, 8);
      g.fillStyle(0xff912e, 1);
      g.fillEllipse(0, y, 38, 23);
      g.fillStyle(0xffb44f, 0.55);
      g.fillEllipse(4, y + 3, 28, 15);
      g.fillStyle(0xffe0b5, 0.45);
      g.fillEllipse(-7, y - 5, 14, 6);
      g.lineStyle(3, 0xffe3c4, 0.85);
      g.strokeEllipse(0, y, 38, 23);
      g.rotation = -0.42;
    } else {
      g.fillStyle(candy.color, 1);
      g.fillCircle(0, y, 19);
      g.lineStyle(4, candy.accent, 0.85);
      g.strokeCircle(0, y, 19);
    }

    container.add(g);
  }

  private getStarPoints(x: number, y: number, outer: number, inner: number, points: number): Phaser.Math.Vector2[] {
    const result: Phaser.Math.Vector2[] = [];
    for (let index = 0; index < points * 2; index += 1) {
      const radius = index % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (index * Math.PI) / points;
      result.push(new Phaser.Math.Vector2(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
    }
    return result;
  }

  private handleShake(): void {
    if (this.isShaking || this.isDropping || this.isResolving || this.state.status !== 'playing') return;
    if (!this.consumeShakeCost()) return;

    this.challengeBoardLocked = false;
    this.startChallengeTimer();
    this.isShaking = true;
    this.dragStart = undefined;
    this.renderOverlay();
    this.sfx.playShakeRattle();

    this.tweens.add({
      targets: this.boardContainer,
      x: { from: BOARD_X - 10, to: BOARD_X + 10 },
      y: { from: BOARD_Y - 8, to: BOARD_Y + 8 },
      duration: 65,
      yoyo: true,
      repeat: 8,
      onComplete: () => {
        this.isShaking = false;
        this.startDropSequence();
      }
    });
  }

  private consumeShakeCost(): boolean {
    if (this.state.shakesRemaining <= 0) {
      this.triggerLevelFail();
      return false;
    }

    if (this.state.energy < SHAKE_ENERGY_COST) {
      this.sfx.playWarning();
      this.blockShakeButton();
      this.renderOverlay();
      this.renderEnergyEmptyModal();
      return false;
    }

    this.state.shakesRemaining -= 1;
    this.state.energy -= SHAKE_ENERGY_COST;
    this.syncSaveCurrency();
    return true;
  }

  private startDropSequence(options: { playChime?: boolean; injectAfterRegen?: (board: BoardGrid) => BoardGrid } = {}): void {
    if (this.isDropping || this.isResolving || this.state.status !== 'playing') return;

    if (options.playChime) {
      this.sfx.playStartChime();
    }

    let freshBoard = regenerateCandies(this.state.board);
    if (options.injectAfterRegen) {
      freshBoard = options.injectAfterRegen(freshBoard);
    }
    this.state.board = freshBoard;
    this.sfx.playDropShimmer();
    this.isDropping = true;
    this.dragStart = undefined;
    this.drawBoard();
    this.renderOverlay();
    this.animateCandyDrop(() => {
      this.isDropping = false;
      this.showWarning(this.t('chainInProgress'));
      this.resolveCurrentCascades();
    });
  }

  private startInitialDrop(): void {
    if (this.isDropping || this.isResolving || this.state.status !== 'playing') return;
    const injectES = shouldInjectEnergyStar(this.save, this.state.level);
    const injectCB = shouldInjectColorBomb(this.save, this.state.level);
    this.startDropSequence({
      injectAfterRegen: (board) => injectSpecialTilesIntoBoard(board, injectES ? ENERGY_STAR_THRESHOLD : 0, injectCB)
    });
  }

  private handleSwipe(first: BoardPosition, second: BoardPosition): void {
    if (!areAdjacent(first, second)) {
      this.showInvalidFeedback(first);
      this.sfx.playInvalid();
      this.vibrate(18);
      this.showWarning(this.t('noMatch'));
      return;
    }

    const swappedBoard = swapCandies(this.state.board, first, second);
    const preview = resolveMatchesAndCascades(swappedBoard);

    if (preview.steps.length === 0) {
      this.animateSwap(first, second, true, () => {
        this.showInvalidFeedback(first);
        this.showInvalidFeedback(second);
        this.sfx.playInvalid();
        this.vibrate(18);
        this.showWarning(this.t('noMatch'));
        this.renderOverlay();
      });
      return;
    }

    this.animateSwap(first, second, false, () => {
      this.state.board = swappedBoard;
      this.drawBoard();
      this.showWarning(this.t('chainInProgress'));
      this.time.delayedCall(80, () => this.resolveCurrentCascades({ allowMultiplierUpgrade: true }));
    });
  }

  private animateSwap(first: BoardPosition, second: BoardPosition, swapBack: boolean, onComplete: () => void): void {
    const firstCandy = this.candyContainers.get(this.positionKey(first));
    const secondCandy = this.candyContainers.get(this.positionKey(second));
    if (!firstCandy || !secondCandy) {
      onComplete();
      return;
    }

    const dx = (second.col - first.col) * CELL_SIZE;
    const dy = (second.row - first.row) * CELL_SIZE;
    let completed = 0;
    const finishOne = () => {
      completed += 1;
      if (completed === 2) {
        onComplete();
      }
    };
    const duration = swapBack ? 110 : 150;

    this.tweens.add({
      targets: firstCandy,
      x: dx,
      y: dy,
      scale: 1.08,
      duration,
      yoyo: swapBack,
      ease: 'Sine.easeInOut',
      onComplete: finishOne
    });
    this.tweens.add({
      targets: secondCandy,
      x: -dx,
      y: -dy,
      scale: 1.08,
      duration,
      yoyo: swapBack,
      ease: 'Sine.easeInOut',
      onComplete: finishOne
    });
  }

  private animateCandyDrop(onComplete: () => void): void {
    let remaining = this.candyContainers.size;
    const totalDuration = 3000;

    if (remaining === 0) {
      onComplete();
      return;
    }

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLUMNS; col += 1) {
        const candy = this.candyContainers.get(this.positionKey({ row, col }));
        if (!candy) continue;
        const columnDelay = col * 42;
        const rowDelay = row * 36;
        candy.y = -BOARD_SIZE - (BOARD_ROWS - row) * CELL_SIZE;
        candy.alpha = 0.18;
        this.tweens.add({
          targets: candy,
          y: 0,
          alpha: 1,
          scale: { from: 0.94, to: 1 },
          duration: totalDuration - columnDelay - rowDelay,
          delay: columnDelay + rowDelay,
          ease: 'Back.easeOut',
          onComplete: () => {
            remaining -= 1;
            if (remaining === 0) {
              onComplete();
            }
          }
        });
      }
    }
  }

  private resolveCurrentCascades(options: { allowMultiplierUpgrade?: boolean } = {}): void {
    if (this.state.status !== 'playing') return;

    this.isResolving = true;
    this.renderOverlay();
    const result = resolveMatchesAndCascades(this.state.board);
    const multiplierUpgrade = options.allowMultiplierUpgrade
      ? applyComboMultiplierUpgrade(result.board, result.steps)
      : { board: result.board, upgraded: [] };
    this.state.board = multiplierUpgrade.board;

    if (result.steps.length > 0) {
      this.state.score += result.scoreDelta;
      for (const [candy, count] of Object.entries(result.candyCounts) as [CandyType, number][]) {
        this.state.candyBlasts[candy] = (this.state.candyBlasts[candy] ?? 0) + count;
      }
      this.state.highestMultiplierIndex = Math.max(this.state.highestMultiplierIndex, getHighestMultiplierIndex(this.state.board));
      this.save.stats.totalBlasts += result.steps.length;
      this.save.stats.highestMultiplierEver = Math.max(this.save.stats.highestMultiplierEver, this.getHighestMultiplierValue());
      saveData(this.save);
      this.playCascadeFeedback(result.steps);
      this.sfx.playGameplayCallout(
        result.steps.length,
        Math.max(...result.steps.map((step) => step.matched.length)),
        this.getHighestUpgradedMultiplierIndex(multiplierUpgrade.board, multiplierUpgrade.upgraded)
      );
      if (multiplierUpgrade.upgraded.length > 0) {
        this.time.delayedCall(Math.max(180, result.steps.length * CASCADE_SETTLE_DELAY_MS), () => {
          this.showMultiplierUpgradeFeedback(multiplierUpgrade.upgraded);
        });
      }
    }

    const delay = Math.max(260, result.steps.length * CASCADE_SETTLE_DELAY_MS);
    this.time.delayedCall(delay, () => {
      this.isResolving = false;
      this.state.board = multiplierUpgrade.board;
      this.drawBoard();
      this.animateBoardSettle();
      this.checkSpecialTileEvents();

      if (areGoalsComplete(this.state)) {
        if (!this.goalsCompletedEarly && this.state.shakesRemaining > 0) {
          this.goalsCompletedEarly = true;
          this.renderGoalCompleteModal();
          return;
        }
        if (!this.goalsCompletedEarly) {
          // Goals complete with 0 shakes on first trigger — immediate win
          this.triggerLevelWin();
          return;
        }
        // goalsCompletedEarly=true: player chose to continue; let remaining shakes exhaust naturally
      }

      if (this.state.shakesRemaining <= 0) {
        if (this.goalsCompletedEarly) {
          this.triggerLevelWin();
        } else {
          this.triggerLevelFail();
        }
        return;
      }

      this.renderOverlay();
    });
  }

  private canUseBoardInput(): boolean {
    return this.playMode === 'game' && this.state.status === 'playing' && !this.isShaking && !this.isDropping && !this.isResolving && !this.challengeBoardLocked;
  }

  private canUseShake(): boolean {
    return this.playMode === 'game'
      && this.state.status === 'playing'
      && !this.isShaking
      && !this.isDropping
      && !this.isResolving
      && this.state.shakesRemaining > 0
      && this.state.energy >= SHAKE_ENERGY_COST;
  }

  private getHelperText(): string {
    if (this.isShaking || this.isDropping) return this.t('shakeDropHelper');
    if (this.isResolving) return this.t('chainInProgress');
    if (this.challengeBoardLocked) return this.t('challengeTimeLocked');
    if (this.state.energy < SHAKE_ENERGY_COST) return this.t('noEnergy');
    if (hasValidSwipeMove(this.state.board)) return this.t('swipeHelper');
    return this.t('shakeHelper');
  }

  private triggerLevelWin(): void {
    if (this.state.status === 'won') return;
    this.challengeTimerRunning = false;
    this.challengeBoardLocked = false;
    this.state.status = 'won';
    this.sfx.playLevelComplete();
    this.vibrate([18, 32, 28]);
    const reward = calculateRewardSummary(this.state);
    const alreadyCompleted = this.save.completedLevels.includes(this.state.level);
    this.completedLevelWasReplay = alreadyCompleted;

    // Star diamonds: only reward the delta between new and previous tier (anti-farming)
    const previousStars = (this.save.levelStars ?? {})[this.state.level] ?? 0;
    const newStarDiamonds = getStarDiamondsCumulative(reward.stars) - getStarDiamondsCumulative(previousStars);
    if (reward.stars > previousStars) {
      this.save.levelStars = { ...(this.save.levelStars ?? {}), [this.state.level]: reward.stars };
    }

    const finalLevelEnergy = alreadyCompleted ? 0 : reward.levelEnergy;
    const finalMultiplierEnergy = alreadyCompleted ? 0 : reward.multiplierEnergy;
    const finalMultiplierDiamonds = alreadyCompleted ? 0 : reward.multiplierDiamonds;
    const finalTotalEnergy = finalLevelEnergy + finalMultiplierEnergy;
    const finalTotalDiamonds = finalMultiplierDiamonds + newStarDiamonds;
    const energyResult = applyFreeEnergy(this.state.energy, finalTotalEnergy);

    this.rewardSummary = {
      ...reward,
      levelEnergy: finalLevelEnergy,
      starEnergy: 0,
      starDiamonds: newStarDiamonds,
      multiplierEnergy: finalMultiplierEnergy,
      multiplierDiamonds: finalMultiplierDiamonds,
      totalEnergy: finalTotalEnergy,
      totalDiamonds: finalTotalDiamonds,
      superChest: alreadyCompleted ? false : reward.superChest,
      actualEnergyGained: alreadyCompleted ? 0 : energyResult.gained,
      energyCapped: alreadyCompleted ? false : energyResult.capped
    };
    if (!alreadyCompleted) {
      this.state.energy = energyResult.energy;
      this.state.diamonds += finalMultiplierDiamonds;
    }
    this.state.diamonds += newStarDiamonds;
    this.save = {
      ...this.save,
      energy: this.state.energy,
      diamonds: this.state.diamonds,
      superChests: this.save.superChests + (!alreadyCompleted && this.rewardSummary.superChest ? 1 : 0),
      stats: {
        ...this.save.stats,
        highScore: Math.max(this.save.stats.highScore, this.state.score),
        highestMultiplierEver: Math.max(this.save.stats.highestMultiplierEver, this.getHighestMultiplierValue())
      }
    };
    if (!alreadyCompleted) {
      onFirstTimeLevelCompleted(this.save);
    }
    this.save = markLevelCompleted(this.save, this.state.level, this.state.score);
    this.renderOverlay();
  }

  private triggerLevelFail(): void {
    this.challengeTimerRunning = false;
    this.challengeBoardLocked = false;
    this.state.status = 'failed';
    this.sfx.playLevelFailed();
    this.renderOverlay();
  }

  private renderGoalCompleteModal(): void {
    const multLabel = getMultiplierLabel(this.state.highestMultiplierIndex) || 'x0';
    const multInfo = this.t('goalCompleteMultiplierInfo').replace('{mult}', multLabel);
    this.openModal(`
      <div class="modal modal--goal-complete">
        <h2>${this.t('goalCompleteTitle')}</h2>
        <p class="goal-complete-mult">${multInfo}</p>
        <button class="btn btn--primary" data-action="goal-continue">${this.t('goalCompleteContinue')}</button>
        <button class="btn btn--ghost" data-action="goal-finish">${this.t('goalCompleteFinish')}</button>
      </div>
    `);
    this.modalButton('goal-continue', () => {
      this.closeModal();
      this.renderOverlay();
    });
    this.modalButton('goal-finish', () => {
      this.closeModal();
      this.triggerLevelWin();
    });
  }

  private continueLevel(shakes: number, diamondCost = 0, source: 'ad' | 'diamonds' = 'diamonds'): boolean {
    if (diamondCost > 0 && this.state.diamonds < diamondCost) {
      this.sfx.playWarning();
      this.showWarning(this.t('notEnoughDiamonds'));
      return false;
    }

    this.state.diamonds -= diamondCost;
    this.state.shakesRemaining += shakes;
    this.state.continued = true;
    if (source === 'ad') {
      this.state.adContinueUsedForAttempt = true;
      const adEnergyResult = applyMarketEnergy(this.state.energy, CONTINUE_AD_ENERGY_REWARD);
      this.state.energy = adEnergyResult.energy;
    }
    this.state.status = 'playing';
    this.syncSaveCurrency();
    this.closeModal();
    this.sfx.playPurchaseSuccess();
    this.startChallengeTimer();
    this.renderOverlay();
    return true;
  }

  private startLevel(level: number): void {
    if (level > this.save.highestUnlockedLevel) {
      this.sfx.playWarning();
      this.showWarning(this.t('levelLocked'));
      return;
    }

    this.save.currentLevel = Math.max(1, Math.floor(level));
    this.save.shakes = SHAKES_PER_LEVEL;
    this.save.hasStartedGame = true;
    saveData(this.save);
    this.state = createGameState(this.save);
    this.rewardSummary = undefined;
    this.completedLevelWasReplay = false;
    this.goalsCompletedEarly = false;
    this.challengeTimerSeconds = 0;
    this.challengeTimerRunning = false;
    this.challengeBoardLocked = false;
    this.challengeTimerWarningFired = false;
    this.screen = 'play';
    this.playMode = 'game';
    this.closeModal();
    this.drawBoard();
    this.renderOverlay();
    this.sfx.playLevelStart();
    if (this.isChallengeLevel()) {
      this.showChallengeIntro();
      this.time.delayedCall(1400, () => this.startChallengeTimer());
    }
    this.time.delayedCall(1, () => this.startInitialDrop());
  }

  private restartLevel(): void {
    this.save.shakes = SHAKES_PER_LEVEL;
    this.state = createGameState(this.save);
    this.rewardSummary = undefined;
    this.completedLevelWasReplay = false;
    this.goalsCompletedEarly = false;
    this.challengeTimerSeconds = 0;
    this.challengeTimerRunning = false;
    this.challengeBoardLocked = false;
    this.challengeTimerWarningFired = false;
    this.screen = 'play';
    this.playMode = 'game';
    this.closeModal();
    this.drawBoard();
    this.renderOverlay();
    this.sfx.playLevelStart();
    if (this.isChallengeLevel()) {
      this.time.delayedCall(800, () => this.startChallengeTimer());
    }
    this.time.delayedCall(1, () => this.startInitialDrop());
  }

  private tryRestartLevel(): void {
    if (this.state.energy < RESTART_COST) {
      this.sfx.playWarning();
      this.renderEnergyEmptyModal();
      return;
    }
    this.state.energy -= RESTART_COST;
    this.state.adContinueUsedForAttempt = false;
    this.state.adEnergyUsedForAttempt = false;
    this.save.energy = this.state.energy;
    this.save.diamonds = this.state.diamonds;
    saveData(this.save);
    this.restartLevel();
  }

  private startNextLevel(): void {
    this.pendingAdFlow = undefined;
    this.save.currentLevel = Math.max(this.save.currentLevel, this.state.level + 1);
    this.save.energy = this.state.energy;
    this.save.shakes = this.state.shakesRemaining;
    this.save.diamonds = this.state.diamonds;
    saveData(this.save);
    this.state = createGameState(this.save);
    this.rewardSummary = undefined;
    this.screen = 'play';
    this.playMode = 'road';
    this.closeModal();
    this.children.removeAll();
    this.cellContainers.clear();
    this.candyContainers.clear();
    this.renderOverlay();
  }

  private renderWinModal(): void {
    const reward = this.rewardSummary ?? calculateRewardSummary(this.state);
    const rewardRows = [
      `<article><span>${this.t('levelReward')}</span><strong>+${reward.levelEnergy} ${this.t('energy')}</strong></article>`
    ];
    if (reward.starDiamonds > 0) {
      rewardRows.push(`<article><span>${this.t('starReward')}</span><strong>+${reward.starDiamonds} ${this.t('diamonds')}</strong></article>`);
    }

    if (reward.multiplierEnergy > 0 || reward.multiplierDiamonds > 0) {
      const mulDiamondPart = reward.multiplierDiamonds > 0 ? ` +${reward.multiplierDiamonds} ${this.t('diamonds')}` : '';
      rewardRows.push(`<article><span>${this.t('multiplierBonus')}</span><strong>+${reward.multiplierEnergy} ${this.t('energy')}${mulDiamondPart}</strong></article>`);
    }

    const totalDiamondPart = reward.totalDiamonds > 0 ? ` +${reward.totalDiamonds} ${this.t('diamonds')}` : '';
    rewardRows.push(`<article><span>${this.t('totalReward')}</span><strong>+${reward.totalEnergy} ${this.t('energy')}${totalDiamondPart}</strong></article>`);

    if (reward.superChest) {
      rewardRows.push(`<article class="result-special-row"><img class="super-chest-img" src="${UI_ASSETS.rewards.superChest}" alt="" aria-hidden="true"><div class="super-chest-text"><span>${this.t('superChest')}</span><strong>${this.t('superChestUnlocked')}</strong></div></article>`);
    }

    this.openModal(`
      <div class="modal-card result-card result-card-win${reward.superChest ? ' is-super' : ''}">
        ${reward.superChest ? '<div class="result-glow" aria-hidden="true"></div>' : ''}
        <div class="confetti" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        <h2>${this.t('levelWin')}</h2>
        <p class="result-level">${this.t('level')} ${this.state.level}</p>
        <div class="result-stars" aria-label="${this.t('starsEarned')}: ${reward.stars}">${'★'.repeat(reward.stars)}${'☆'.repeat(3 - reward.stars)}</div>
        <div class="result-stats">
          <article><span>${this.t('score')}</span><strong>${this.formatScore(this.state.score)}</strong></article>
          <article><span>${this.t('highestMultiplier')}</span><strong>${reward.multiplierLabel}</strong></article>
        </div>
        <div class="result-rewards">${rewardRows.join('')}</div>
        ${reward.energyCapped ? `<p class="result-keep-note">${this.t('energyFull')}</p>` : ''}
        <button class="result-primary-button" type="button" data-action="next">${this.t('nextLevel')}</button>
      </div>
    `);
    this.modalButton('next', (button) => {
      this.disableModalButtons(button);
      this.beginNextLevelFlow();
    });
  }

  private beginNextLevelFlow(): void {
    const completedLevel = this.state.level;
    const plan = createAdFlowPlan(this.save, completedLevel, this.completedLevelWasReplay);

    if (!plan.showForcedBreak && !plan.showRewardedOffer) {
      this.startNextLevel();
      return;
    }

    this.pendingAdFlow = { ...plan, forcedHandled: !plan.showForcedBreak, rewardedHandled: !plan.showRewardedOffer };

    if (plan.showForcedBreak) {
      this.save = markForcedBreakShown(this.save, completedLevel);
      this.renderMandatoryAdModal();
      return;
    }

    this.renderRewardedAdOfferModal();
  }

  private renderMandatoryAdModal(): void {
    this.openModal(`
      <div class="modal-card result-card">
        <h2>${this.t('adBreakTitle')}</h2>
        <p>${this.t('adBreakMessage')}</p>
        <button class="result-primary-button" type="button" data-action="continue">${this.t('adBreakContinue')}</button>
      </div>
    `);
    this.modalButton('continue', (button) => {
      this.disableModalButtons(button);
      this.continueAfterMandatoryAd();
    });
  }

  private continueAfterMandatoryAd(): void {
    const flow = this.pendingAdFlow;
    if (!flow) {
      this.startNextLevel();
      return;
    }

    flow.forcedHandled = true;
    if (flow.showRewardedOffer && !flow.rewardedHandled) {
      this.renderRewardedAdOfferModal();
      return;
    }

    this.startNextLevel();
  }

  private renderRewardedAdOfferModal(): void {
    const completedLevel = this.pendingAdFlow?.completedLevel ?? 0;
    const title = this.t('bonusRewardTitle').replace('{level}', String(completedLevel));
    this.openModal(`
      <div class="modal-card result-card result-card-win">
        <h2>${title}</h2>
        <p>${this.t('bonusRewardMessage')}</p>
        <div class="result-rewards">
          <article><span>${this.t('bonus')}</span><strong>${this.t('bonusRewardText')}</strong></article>
        </div>
        <div class="continue-actions">
          <button class="result-primary-button" type="button" data-action="claim">${this.t('watchAndClaim')}</button>
          <button class="result-secondary-button" type="button" data-action="skip">${this.t('skip')}</button>
        </div>
      </div>
    `);
    this.modalButton('claim', (button) => {
      this.disableModalButtons(button);
      this.claimRewardedAdBonus();
    });
    this.modalButton('skip', (button) => {
      this.disableModalButtons(button);
      this.skipRewardedAdBonus();
    });
  }

  private claimRewardedAdBonus(): void {
    const flow = this.pendingAdFlow;
    if (!flow || flow.rewardedHandled) return;

    flow.rewardedHandled = true;
    this.save.energy = this.state.energy;
    this.save.diamonds = this.state.diamonds;
    const result = claimRewardedMilestone(this.save, flow.completedLevel);
    this.save = result.save;
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    this.sfx.playPurchaseSuccess();
    this.showWarning(this.t('tenLevelBonusClaimed'));
    if (result.capped) {
      this.showWarning(this.t('energyFull'));
    }
    this.startNextLevel();
  }

  private skipRewardedAdBonus(): void {
    const flow = this.pendingAdFlow;
    if (flow) {
      flow.rewardedHandled = true;
    }
    this.startNextLevel();
  }

  private renderFailModal(): void {
    const goals = this.state.definition.goals.map((goal) => `<article>${this.formatGoal(goal)}</article>`).join('');

    let adContinue: string;
    if (this.state.adContinueUsedForAttempt) {
      adContinue = `<p class="result-keep-note">${this.t('adContinueUsed')}</p>`;
    } else if (this.isAdReady()) {
      adContinue = `<button type="button" data-action="ad">${this.t('watchAdContinue')}</button>`;
    } else {
      adContinue = `<button type="button" disabled class="btn-ad-disabled">${this.t('adNotReady')}</button>`;
    }

    this.openModal(`
      <div class="modal-card result-card result-card-fail">
        <h2>${this.t('levelFailed')}</h2>
        <p>${this.t('continuePrompt')}</p>
        <div class="result-stats">
          <article><span>${this.t('score')}</span><strong>${this.formatScore(this.state.score)}</strong></article>
          <article><span>${this.t('highestMultiplier')}</span><strong>${getMultiplierLabel(this.state.highestMultiplierIndex) || 'x0'}</strong></article>
        </div>
        <div class="goal-progress-list">${goals}</div>
        <p class="result-keep-note">${this.t('continueKeepsMultipliers')}</p>
        <div class="modal-feedback" aria-live="polite"></div>
        <div class="continue-actions">
          ${adContinue}
          <button type="button" data-action="one">${this.t('continueOneShake')}</button>
          <button type="button" data-action="three">${this.t('continueThreeShakes')}</button>
          <button type="button" data-action="five">${this.t('continueFiveShakes')}</button>
          <button class="result-secondary-button" type="button" data-action="restart">${this.t('restart')}</button>
        </div>
      </div>
    `);
    if (!this.state.adContinueUsedForAttempt && this.isAdReady()) {
      this.modalButton('ad', (button) => this.handleContinueClick(button, 1, 0, 'ad'));
    }
    this.modalButton('one', (button) => this.handleContinueClick(button, 1, 100));
    this.modalButton('three', (button) => this.handleContinueClick(button, 3, 250));
    this.modalButton('five', (button) => this.handleContinueClick(button, 5, 400));
    this.modalButton('restart', (button) => {
      this.disableModalButtons(button);
      this.tryRestartLevel();
    });
  }

  private handleContinueClick(button: HTMLButtonElement, shakes: number, diamondCost = 0, source: 'ad' | 'diamonds' = 'diamonds'): void {
    if (!this.continueLevel(shakes, diamondCost, source)) return;
    this.disableModalButtons(button);
  }

  private renderEnergyEmptyModal(): void {
    let adEnergy: string;
    if (this.state.adEnergyUsedForAttempt) {
      adEnergy = `<p class="result-keep-note">${this.t('adContinueUsed')}</p>`;
    } else if (this.isAdReady()) {
      adEnergy = `<button type="button" data-action="ad-energy">${this.t('watchAdEnergy')}</button>`;
    } else {
      adEnergy = `<button type="button" disabled class="btn-ad-disabled">${this.t('adNotReady')}</button>`;
    }

    const energyItems = MARKET_ENERGY_ITEMS.map((item) =>
      `<button type="button" data-action="energy-${item.energy}">${this.t(item.labelKey)}</button>`
    ).join('');

    let regenLine = '';
    if (this.save.energy < REGEN_ENERGY_CAP) {
      const ms = getRegenMsUntilNext(this.save.lastRegenAt);
      const minutes = Math.floor(ms / 60_000);
      const seconds = Math.floor((ms % 60_000) / 1_000);
      const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      regenLine = `<p class="result-keep-note">${this.t('regenEnergyGain').replace('{amount}', String(REGEN_ENERGY_AMOUNT))} ${this.t('regenIn').replace('{time}', timeStr)}</p>`;
    }

    this.openModal(`
      <div class="modal-card result-card">
        <h2>${this.t('noEnergy')}</h2>
        <div class="modal-feedback" aria-live="polite"></div>
        <div class="continue-actions">
          ${adEnergy}
          ${energyItems}
          ${regenLine}
          <button class="result-secondary-button" type="button" data-action="close">${this.t('close')}</button>
        </div>
      </div>
    `);
    if (!this.state.adEnergyUsedForAttempt && this.isAdReady()) {
      this.modalButton('ad-energy', (button) => this.handleEnergyAdClick(button));
    }
    for (const item of MARKET_ENERGY_ITEMS) {
      this.modalButton(`energy-${item.energy}`, (button) => this.handleModalEnergyPurchase(button, item.energy, item.cost));
    }
    this.modalButton('close', () => this.closeModal());
  }

  private handleEnergyAdClick(button: HTMLButtonElement): void {
    this.state.adEnergyUsedForAttempt = true;
    this.disableModalButtons(button);
    // TODO: replace with real ad SDK callback; grant energy only on completion
    const result = applyMarketEnergy(this.state.energy, REGEN_ENERGY_AMOUNT);
    this.state.energy = result.energy;
    this.save.energy = result.energy;
    saveData(this.save);
    this.sfx.playPurchaseSuccess();
    this.closeModal();
    this.renderOverlay();
  }

  private handleModalEnergyPurchase(button: HTMLButtonElement, energy: number, cost: number): void {
    if (this.state.diamonds < cost) {
      this.sfx.playWarning();
      this.showWarning(this.t('notEnoughDiamonds'));
      return;
    }
    this.state.diamonds -= cost;
    const result = applyMarketEnergy(this.state.energy, energy);
    this.state.energy = result.energy;
    this.syncSaveCurrency();
    this.sfx.playPurchaseSuccess();
    if (result.capped) this.showWarning(this.t('energyFull'));
    this.disableModalButtons(button);
    this.closeModal();
    this.renderOverlay();
  }

  private renderDailyRewardModal(): void {
    const reward = getDailyReward(this.save.dailyLogin.streak + 1);
    this.openModal(`
      <div class="modal-card">
        <h2>${this.t('dailyRewardReady')}</h2>
        <p>${this.t('day')} ${reward.day}: +${reward.energy} ${this.t('energy')} +${reward.diamonds} ${this.t('diamonds')}${reward.chest ? ` +${this.t('chest')}` : ''}</p>
        <button type="button" data-action="claim">${this.t('claim')}</button>
      </div>
    `);
    this.modalButton('claim', () => this.claimDailyReward());
  }

  private claimDailyReward(): void {
    const reward = getDailyReward(this.save.dailyLogin.streak + 1);
    this.save.dailyLogin = { streak: this.save.dailyLogin.streak + 1, lastClaimDate: TODAY() };
    const energyResult = applyFreeEnergy(this.save.energy, reward.energy);
    this.save.energy = energyResult.energy;
    this.save.diamonds += reward.diamonds;
    this.save.chests += reward.chest ? 1 : 0;
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.closeModal();
    if (energyResult.capped) this.showWarning(this.t('energyFull'));
    this.sfx.playPurchaseSuccess();
    this.renderOverlay();
  }

  private collectIslandRewards(): void {
    let energy = 0;
    let diamonds = 0;
    const today = TODAY();

    for (const building of BUILDINGS) {
      if (this.save.completedBuildingIds.includes(building.id) && this.isBuildingReady(building.id)) {
        energy += building.energy;
        diamonds += building.diamonds;
        this.save.buildingClaimDates[String(building.id)] = today;
      }
    }

    if (energy === 0 && diamonds === 0) {
      this.sfx.playWarning();
      this.showWarning(this.t('claimLater'));
      return;
    }

    const energyResult = applyFreeEnergy(this.save.energy, energy);
    this.save.energy = energyResult.energy;
    this.save.diamonds += diamonds;
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.sfx.playPurchaseSuccess();
    this.showWarning(`${this.t('dailyProductionCollected')} +${energyResult.gained} ${this.t('energy')} +${diamonds} ${this.t('diamonds')}${energyResult.capped ? ` ${this.t('energyFull')}` : ''}`);
    this.renderOverlay();
  }

  private claimBuildingReward(buildingId: number): void {
    const building = BUILDINGS.find((item) => item.id === buildingId);
    if (!building || !this.isBuildingReady(buildingId)) return;

    const energyResult = applyFreeEnergy(this.save.energy, building.energy);
    this.save.energy = energyResult.energy;
    this.save.diamonds += building.diamonds;
    this.save.buildingClaimDates[String(buildingId)] = TODAY();
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.sfx.playPurchaseSuccess();
    this.showWarning(`${this.t('gained')}: +${energyResult.gained} ${this.t('energy')} +${building.diamonds} ${this.t('diamonds')}${energyResult.capped ? ` ${this.t('energyFull')}` : ''}`);
    this.renderOverlay();
  }

  private buildBuilding(buildingId: number): void {
    const cost = this.getBuildCost(buildingId);
    if (this.save.diamonds < cost) {
      this.sfx.playWarning();
      this.showWarning(this.t('notEnoughDiamonds'));
      return;
    }

    this.save.diamonds -= cost;
    this.save.completedBuildingIds = [...new Set([...this.save.completedBuildingIds, buildingId])].sort((a, b) => a - b);
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.sfx.playPurchaseSuccess();
    this.renderOverlay();
  }

  private buyMarketShakes(shakes: number, cost: number): void {
    if (this.state.status === 'failed') {
      this.continueLevel(shakes, cost);
      return;
    }

    if (this.state.diamonds < cost) {
      this.sfx.playWarning();
      this.showWarning(this.t('notEnoughDiamonds'));
      return;
    }

    this.state.diamonds -= cost;
    this.state.shakesRemaining += shakes;
    this.syncSaveCurrency();
    this.sfx.playPurchaseSuccess();
    this.showWarning(`${this.t('gained')}: +${shakes} ${this.t('shake')}`);
    this.renderOverlay();
  }

  private buyMarketEnergy(energy: number, cost: number): void {
    if (this.state.energy >= HARD_ENERGY_CAP) {
      this.sfx.playWarning();
      this.showWarning(this.t('energyFull'));
      return;
    }

    if (this.state.diamonds < cost) {
      this.sfx.playWarning();
      this.showWarning(this.t('notEnoughDiamonds'));
      return;
    }

    const energyResult = applyMarketEnergy(this.state.energy, energy);
    this.state.diamonds -= cost;
    this.state.energy = energyResult.energy;
    this.syncSaveCurrency();
    this.sfx.playPurchaseSuccess();
    this.showWarning(`+${energyResult.gained} ${this.t('energy')} ${this.t('energyAdded')}${energyResult.capped ? ` ${this.t('energyFull')}` : ''}`);
    this.renderOverlay();
  }

  private highlightGroup(group: BoardPosition[]): void {
    for (const position of group) {
      const container = this.cellContainers.get(this.positionKey(position));
      if (!container) continue;
      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        scale: 1.18,
        alpha: 0.72,
        duration: 75,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          container.setScale(1);
          container.setAlpha(1);
        }
      });
    }
  }

  private highlightAvailableGroups(groups: BoardPosition[][]): void {
    for (const group of groups) {
      for (const position of group) {
        const container = this.cellContainers.get(this.positionKey(position));
        if (!container) continue;
        this.tweens.killTweensOf(container);
        container.setScale(1);
        container.setAlpha(1);
        this.tweens.add({
          targets: container,
          scale: 1.16,
          alpha: 0.62,
          duration: 110,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            container.setScale(1);
            container.setAlpha(1);
          }
        });
      }
    }
  }

  private showInvalidFeedback(position: BoardPosition): void {
    const container = this.cellContainers.get(this.positionKey(position));
    if (!container) return;
    this.tweens.add({
      targets: container,
      x: container.x + 7,
      duration: 45,
      yoyo: true,
      repeat: 3
    });
  }

  private animateBoardSettle(): void {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLUMNS; col += 1) {
        const candy = this.candyContainers.get(this.positionKey({ row, col }));
        if (!candy) continue;
        candy.y = -18 - row * 3;
        candy.alpha = 0.84;
        this.tweens.add({
          targets: candy,
          y: 0,
          alpha: 1,
          duration: 180 + row * 18,
          delay: col * 8,
          ease: 'Back.easeOut'
        });
      }
    }
  }

  private playCascadeFeedback(steps: CascadeStep[]): void {
    steps.forEach((step, index) => {
      this.time.delayedCall(index * CASCADE_SETTLE_DELAY_MS, () => {
        this.playBlastFeedback(step, index);
        this.time.delayedCall(90, () => this.triggerGoalFlyAnimations(step));
        if (index < steps.length - 1) {
          this.time.delayedCall(260, () => {
            this.state.board = step.boardAfter;
            this.drawBoard();
            this.animateBoardSettle();
          });
        }
      });
    });
  }

  private showMultiplierUpgradeFeedback(upgraded: BoardPosition[]): void {
    this.sfx.playMultiplierUpgrade();
    for (const position of upgraded) {
      const container = this.cellContainers.get(this.positionKey(position));
      if (!container) continue;
      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        scale: 1.2,
        duration: 120,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeOut',
        onComplete: () => container.setScale(1)
      });
    }

    const center = this.getBlastCenter(upgraded);
    this.showBurstLabel(this.t('comboMultiplierUp'), center.x, center.y - 34, false);
  }

  private getHighestUpgradedMultiplierIndex(board: BoardGrid, upgraded: BoardPosition[]): number {
    return upgraded.reduce((highest, position) => {
      const cell = board[position.row]?.[position.col];
      return Math.max(highest, cell?.multiplierIndex ?? 0);
    }, 0);
  }

  private playBlastFeedback(step: CascadeStep, cascadeIndex: number): void {
    const center = this.getBlastCenter(step.matched);
    const size = step.largestGroupSize;
    const highMultiplier = step.highestMultiplierIndex >= 7;
    const specialMultiplier = step.highestMultiplierIndex >= 9;
    const powerful = size >= 5 || highMultiplier;
    const huge = size >= 6 || specialMultiplier;

    for (const position of step.matched) {
      const candy = this.candyContainers.get(this.positionKey(position));
      if (!candy) continue;
      this.tweens.killTweensOf(candy);
      this.tweens.add({
        targets: candy,
        scale: powerful ? 1.28 : 1.12,
        alpha: 0,
        duration: powerful ? 220 : 160,
        ease: 'Back.easeIn'
      });
    }

    this.emitSparkles(center.x, center.y, size, highMultiplier, specialMultiplier);
    this.showBlastRing(center.x, center.y, size, specialMultiplier);
    if (step.highestMultiplierIndex >= 9) {
      this.showGoldenPulse(center.x, center.y, step.highestMultiplierIndex >= 10);
    }
    this.showScorePopup(`+${this.formatScore(step.scoreDelta)}`, center.x, center.y - 8, size, highMultiplier, specialMultiplier);
    this.sfx.playBlast(size, step.highestMultiplierIndex);

    if (powerful && this.boardContainer) {
      if (size >= 5) this.vibrate(size >= 10 ? [12, 18, 18] : 16);
      this.tweens.add({
        targets: this.boardContainer,
        x: BOARD_X + (huge ? 6 : 4),
        y: BOARD_Y + (huge ? 4 : 2),
        duration: 45,
        yoyo: true,
        repeat: huge ? 3 : 1,
        onComplete: () => this.boardContainer?.setPosition(BOARD_X, BOARD_Y)
      });
    }

    if (size >= 6) {
      this.showBurstLabel(this.t('bigBlast'), center.x, center.y - 38, true);
    } else if (size >= 5) {
      this.showBurstLabel(this.t('bigBlast'), center.x, center.y - 36, false);
    }

    if (cascadeIndex >= 1) {
      this.showBurstLabel(this.t(cascadeIndex >= 2 ? 'megaChain' : 'chain'), GAME_SIZE / 2, 42, cascadeIndex >= 2);
      this.sfx.playChain(cascadeIndex);
    }
  }

  private emitSparkles(x: number, y: number, size: number, highMultiplier: boolean, specialMultiplier: boolean): void {
    const count = size >= 10 ? 24 : size >= 6 ? 18 : size >= 5 ? 14 : size >= 4 ? 10 : 7;
    const color = specialMultiplier ? 0xffd33f : highMultiplier ? 0xffffff : 0xfff1a6;

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + (Math.random() * 0.36 - 0.18);
      const minDistance = size >= 5 ? 34 : 22;
      const maxDistance = size >= 10 ? 88 : size >= 6 ? 74 : 48;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
      const sparkle = this.add.star(x, y, 5, 3, specialMultiplier ? 8 : 6, color, 0.95).setScale(0.55);
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scale: 0,
        alpha: 0,
        duration: size >= 5 ? 420 : 300,
        ease: 'Cubic.easeOut',
        onComplete: () => sparkle.destroy()
      });
    }
  }

  private showBlastRing(x: number, y: number, size: number, specialMultiplier: boolean): void {
    const ring = this.add.circle(x, y, 10, specialMultiplier ? 0xffd33f : 0xffffff, 0);
    ring.setStrokeStyle(size >= 5 ? 5 : 3, specialMultiplier ? 0xffd33f : 0xffffff, specialMultiplier ? 0.95 : 0.78);
    this.tweens.add({
      targets: ring,
      radius: size >= 10 ? 78 : size >= 6 ? 66 : size >= 5 ? 54 : size >= 4 ? 42 : 30,
      alpha: 0,
      duration: size >= 5 ? 420 : 280,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  private showGoldenPulse(x: number, y: number, isMax: boolean): void {
    const pulse = this.add.circle(x, y, isMax ? 18 : 12, 0xffd33f, isMax ? 0.24 : 0.18);
    pulse.setStrokeStyle(isMax ? 7 : 5, 0xfff1a6, isMax ? 0.95 : 0.78);
    this.tweens.add({
      targets: pulse,
      radius: isMax ? 92 : 72,
      alpha: 0,
      duration: isMax ? 620 : 480,
      ease: 'Cubic.easeOut',
      onComplete: () => pulse.destroy()
    });
  }

  private showScorePopup(label: string, x: number, y: number, size: number, highMultiplier: boolean, specialMultiplier: boolean): void {
    const fontSize = specialMultiplier || size >= 10 ? 34 : highMultiplier || size >= 5 ? 30 : size >= 4 ? 25 : 21;
    const safeX = Phaser.Math.Clamp(x, 52, GAME_SIZE - 52);
    const safeY = Phaser.Math.Clamp(y, 48, GAME_SIZE - 42);
    const text = this.add.text(safeX, safeY, label, {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: specialMultiplier ? '#fff1a6' : '#ffffff',
      fontStyle: 'bold',
      stroke: specialMultiplier ? '#ff7c1f' : highMultiplier ? '#1c7ed6' : '#7b2bbf',
      strokeThickness: specialMultiplier || highMultiplier ? 6 : 4
    }).setOrigin(0.5);

    text.setScale(size >= 5 || highMultiplier ? 0.65 : 0.84);
    this.tweens.add({
      targets: text,
      y: safeY - (size >= 5 || highMultiplier ? 58 : 42),
      scale: size >= 5 || highMultiplier ? 1.18 : 1,
      alpha: 0,
      duration: size >= 5 || highMultiplier ? 1050 : 820,
      ease: 'Back.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private showBurstLabel(label: string, x: number, y: number, intense: boolean): void {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: intense ? '26px' : '21px',
      color: intense ? '#fff1a6' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#7b2bbf',
      strokeThickness: intense ? 6 : 4
    }).setOrigin(0.5);

    text.setScale(0.7);
    this.tweens.add({
      targets: text,
      y: y - 36,
      scale: intense ? 1.18 : 1,
      alpha: 0,
      duration: 860,
      ease: 'Back.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private getBlastCenter(positions: BoardPosition[]): { x: number; y: number } {
    if (positions.length === 0) {
      return { x: GAME_SIZE / 2, y: GAME_SIZE / 2 };
    }

    const sum = positions.reduce(
      (total, position) => ({
        x: total.x + BOARD_X + position.col * CELL_SIZE + CELL_SIZE / 2,
        y: total.y + BOARD_Y + position.row * CELL_SIZE + CELL_SIZE / 2
      }),
      { x: 0, y: 0 }
    );
    return {
      x: sum.x / positions.length,
      y: sum.y / positions.length
    };
  }

  private showWarning(label: string): void {
    const warning = this.el('warning-text');
    const marketFeedback = this.el('market-feedback');
    const modalFeedback = this.el('modal-root').querySelector<HTMLElement>('.modal-feedback');
    warning.textContent = label;
    marketFeedback.textContent = label;
    if (modalFeedback) modalFeedback.textContent = label;
    window.setTimeout(() => {
      if (warning.textContent === label) warning.textContent = '';
      if (marketFeedback.textContent === label) marketFeedback.textContent = '';
      if (modalFeedback?.textContent === label) modalFeedback.textContent = '';
    }, 1400);
  }

  private bumpShakeButton(): void {
    const button = this.el('shake-button');
    button.classList.add('is-pressed');
    window.setTimeout(() => button.classList.remove('is-pressed'), 160);
  }

  private blockShakeButton(): void {
    const button = this.el('shake-button');
    button.classList.remove('is-blocked');
    void button.offsetWidth;
    button.classList.add('is-blocked');
  }

  private playButtonTap(): void {
    this.sfx.unlock();
    this.sfx.playButtonTap();
  }

  private vibrate(pattern: VibratePattern): void {
    if (this.save.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  private formatScore(score: number): string {
    return score.toLocaleString(this.locale === 'tr' ? 'tr-TR' : 'en-US');
  }

  private formatGoal(goal: LevelGoal): string {
    const progress = getGoalProgress(this.state, goal);
    if (goal.type === 'score') return `${this.t('goalScore')}: ${progress.toLocaleString()} / ${goal.target.toLocaleString()}`;
    if (goal.type === 'candy' && goal.candy) return `${this.getCandyName(goal.candy)}: ${progress} / ${goal.target}`;
    return `${this.t('goalMultiplier')}: x${progress} / x${goal.target}`;
  }

  private isGoalComplete(goal: LevelGoal): boolean {
    return getGoalProgress(this.state, goal) >= goal.target;
  }

  private getCandyName(candy: CandyType): string {
    const keys: Record<CandyType, TranslationKey> = {
      greenGummy: 'candyGreenGummy',
      purpleJelly: 'candyPurpleJelly',
      redHeart: 'candyRedHeart',
      yellowStar: 'candyYellowStar',
      blueRound: 'candyBlueRound',
      orangeBean: 'candyOrangeBean',
      energyStar: 'candyEnergyStar',
      colorBomb: 'candyColorBomb'
    };
    return this.t(keys[candy]);
  }

  private getHighestMultiplierValue(): number {
    const label = getMultiplierLabel(this.state.highestMultiplierIndex);
    return label ? Number(label.replace('x', '')) : 0;
  }

  private syncSaveCurrency(): void {
    this.save.energy = this.state.energy;
    this.save.shakes = this.state.shakesRemaining;
    this.save.diamonds = this.state.diamonds;
    this.save.currentLevel = this.state.level;
    saveData(this.save);
  }

  private checkSpecialTileEvents(): void {
    if (this.state.status !== 'playing') return;

    if (!this.state.energyStarEventFired) {
      const count = countCandyOnBoard(this.state.board, 'energyStar');
      if (count >= ENERGY_STAR_THRESHOLD) {
        this.triggerEnergyStarEvent();
      }
    }

    if (!this.state.colorBombEventFired) {
      const count = countCandyOnBoard(this.state.board, 'colorBomb');
      if (count >= COLOR_BOMB_THRESHOLD) {
        this.triggerColorBombEvent();
      }
    }
  }

  private triggerEnergyStarEvent(): void {
    this.state.energyStarEventFired = true;
    this.state.board = consumeCandyFromBoard(this.state.board, 'energyStar');
    this.drawBoard();

    const isFirstTime = !this.save.completedLevels.includes(this.state.level)
      && this.save.energyStarClaimedLevel !== this.state.level;

    if (isFirstTime) {
      this.state.energy = Math.min(this.state.energy + ENERGY_STAR_REWARD, 999);
      onEnergyStarEventFired(this.save, this.state.level);
      this.save.energy = this.state.energy;
      saveData(this.save);
      this.sfx.playLevelComplete();
      this.showSpecialEventFeedback(this.t('energyStarEvent'));
      this.renderOverlay();
    }
  }

  private triggerColorBombEvent(): void {
    this.state.colorBombEventFired = true;
    this.state.board = consumeCandyFromBoard(this.state.board, 'colorBomb');
    this.state.shakesRemaining = Math.max(this.state.shakesRemaining, SHAKES_PER_LEVEL);
    this.drawBoard();

    const isFirstTime = !this.save.completedLevels.includes(this.state.level)
      && this.save.colorBombClaimedLevel !== this.state.level;

    if (isFirstTime) {
      this.state.energy = Math.min(this.state.energy + COLOR_BOMB_REWARD_ENERGY, 999);
      this.state.diamonds = Math.min(this.state.diamonds + COLOR_BOMB_REWARD_DIAMONDS, 999999);
      onColorBombEventFired(this.save, this.state.level);
      this.save.energy = this.state.energy;
      this.save.diamonds = this.state.diamonds;
      saveData(this.save);
      this.sfx.playLevelComplete();
      this.showSpecialEventFeedback(this.t('colorBombEvent'));
      this.renderOverlay();
    }
  }

  private showSpecialEventFeedback(message: string): void {
    const cx = BOARD_X + BOARD_SIZE / 2;
    const cy = BOARD_Y + BOARD_SIZE / 2;
    this.emitSparkles(cx, cy, 12, false, true);
    this.showBlastRing(cx, cy, 12, true);
    this.showBurstLabel(message, cx, cy - 30, true);
  }

  private tickRegen(): void {
    this.tickChallenge();
    const result = applyOfflineRegen(this.save.energy, this.save.shakes, this.save.lastRegenAt);
    if (result.energyGained > 0 || result.lastRegenAt !== this.save.lastRegenAt) {
      this.save.energy = result.energy;
      this.save.lastRegenAt = result.lastRegenAt;
      this.state.energy = result.energy;
      saveData(this.save);
      this.renderOverlay();
    }
    this.renderRegenCountdown();
  }

  private renderRegenCountdown(): void {
    const el = document.getElementById('regen-countdown');
    if (!el) return;

    if (this.screen !== 'play' || this.state.energy >= REGEN_ENERGY_CAP || !this.save.lastRegenAt) {
      el.textContent = '';
      return;
    }

    const ms = getRegenMsUntilNext(this.save.lastRegenAt);
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1_000);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    el.textContent = `${this.t('regenEnergyGain').replace('{amount}', String(REGEN_ENERGY_AMOUNT))} ${this.t('regenIn').replace('{time}', timeStr)}`;
  }

  private isChallengeLevel(): boolean {
    return this.state.level % 10 === 0;
  }

  private getChallengeTimerDuration(): number {
    return this.state.level === 10 ? 120 : 90;
  }

  private startChallengeTimer(): void {
    if (!this.isChallengeLevel()) {
      this.challengeTimerRunning = false;
      return;
    }
    this.challengeTimerSeconds = this.getChallengeTimerDuration();
    this.challengeTimerRunning = true;
    this.challengeTimerWarningFired = false;
    this.challengeBoardLocked = false;
    this.renderChallengeTimer();
  }

  private tickChallenge(): void {
    if (!this.challengeTimerRunning) return;
    if (!this.isChallengeLevel()) return;
    if (this.state.status !== 'playing') return;
    if (this.screen !== 'play' || this.playMode !== 'game') return;

    this.challengeTimerSeconds = Math.max(0, this.challengeTimerSeconds - 1);

    if (this.challengeTimerSeconds <= 10 && this.challengeTimerSeconds > 0 && !this.challengeTimerWarningFired) {
      this.challengeTimerWarningFired = true;
      this.sfx.playWarning();
      this.vibrate([15, 10, 15]);
    }

    if (this.challengeTimerSeconds <= 0) {
      this.challengeTimerRunning = false;
      this.onChallengeTimerExpired();
      return;
    }

    this.renderChallengeTimer();
  }

  private onChallengeTimerExpired(): void {
    if (areGoalsComplete(this.state)) {
      this.triggerLevelWin();
    } else {
      this.challengeBoardLocked = true;
      this.renderOverlay();
    }
  }

  private renderChallengeTimer(): void {
    const timerEl = document.getElementById('challenge-timer');
    const boardStage = document.querySelector<HTMLElement>('.board-stage');
    const phoneFrame = document.getElementById('phone-frame');

    const show = this.isChallengeLevel()
      && this.playMode === 'game'
      && (this.state.status === 'playing' || this.state.status === 'won');

    if (!show || (!this.challengeTimerRunning && !this.challengeBoardLocked)) {
      if (timerEl) timerEl.hidden = true;
      boardStage?.classList.remove('is-challenge-warning', 'is-challenge-locked');
      phoneFrame?.classList.remove('has-challenge-lock');
      return;
    }

    if (timerEl) {
      timerEl.hidden = false;
      if (this.challengeBoardLocked) {
        timerEl.textContent = '⏰';
        timerEl.classList.add('is-warning');
      } else {
        const minutes = Math.floor(this.challengeTimerSeconds / 60);
        const seconds = this.challengeTimerSeconds % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timerEl.classList.toggle('is-warning', this.challengeTimerSeconds <= 10);
      }
    }

    const isWarning = this.challengeTimerRunning && this.challengeTimerSeconds <= 10 && this.challengeTimerSeconds > 0;
    boardStage?.classList.toggle('is-challenge-warning', isWarning);
    boardStage?.classList.toggle('is-challenge-locked', this.challengeBoardLocked);
    phoneFrame?.classList.toggle('has-challenge-lock', this.challengeBoardLocked);
  }

  private showChallengeIntro(): void {
    const el = document.getElementById('challenge-intro');
    if (!el) return;
    el.innerHTML = `<strong>${this.t('challengeTitle')}</strong><p>${this.t('challengeIntroShake')}<br>${this.t('challengeIntroMoves')}</p>`;
    el.classList.remove('is-visible');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('is-visible');
    this.time.delayedCall(3200, () => {
      el.classList.remove('is-visible');
      this.time.delayedCall(400, () => { el.innerHTML = ''; });
    });
  }

  private isAdReady(): boolean {
    return false;
  }

  private isDailyRewardAvailable(): boolean {
    return isBeforeToday(this.save.dailyLogin.lastClaimDate, TODAY());
  }

  private isBuildingReady(buildingId: number): boolean {
    return isBeforeToday(this.save.buildingClaimDates[String(buildingId)] ?? '', TODAY());
  }

  private getBuildCost(buildingId: number): number {
    return 75 + (buildingId - 1) * 50;
  }

  private getBuildingIcon(buildingId: number): string {
    const icons = ['🍬', '🧸', '🍭', '🍨', '🏪', '🏠', '🍮', '🧁', '🎨', '⭐', '🏭', '📦', '🚂', '🌉', '⚓', '🏝️', 'x1000', '🏰'];
    return icons[buildingId - 1] ?? '🍬';
  }

  private getBuildingMapLabel(buildingId: number): string {
    const keys: TranslationKey[] = [
      'mapCandyStand',
      'mapGummyStand',
      'mapLollipopCart',
      'mapIceCreamBooth',
      'mapCandyShop',
      'mapMarshmallowHouse',
      'mapCaramelWorkshop',
      'mapGummyWorkshop',
      'mapColorMixingLab',
      'mapEnergyStarGenerator',
      'mapCandyFactory',
      'mapPackingCenter',
      'mapCandyTrainStation',
      'mapChocolateBridge',
      'mapCandyHarbor',
      'mapGrandCandySquare',
      'mapMultiplierTower',
      'mapMegaCandyPalace'
    ];
    return this.t(keys[buildingId - 1] ?? 'building');
  }

  private openModal(html: string): void {
    const root = this.el('modal-root');
    root.innerHTML = html;
    root.classList.add('is-open');
  }

  private closeModal(): void {
    const root = this.el('modal-root');
    root.classList.remove('is-open');
    root.innerHTML = '';
  }

  private modalButton(action: string, onClick: (button: HTMLButtonElement) => void): void {
    this.el('modal-root').querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.addEventListener('click', (event) => {
      this.playButtonTap();
      onClick(event.currentTarget as HTMLButtonElement);
    });
  }

  private disableModalButtons(activeButton: HTMLButtonElement): void {
    activeButton.closest('.modal-card')?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.disabled = true;
    });
  }

  private setText(id: string, value: string): void {
    this.el(id).textContent = value;
  }

  private el(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element #${id}`);
    return element;
  }

  private optionalEl(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  private positionKey(position: BoardPosition): string {
    return `${position.row}:${position.col}`;
  }

  private triggerGoalFlyAnimations(step: CascadeStep): void {
    const goals = this.state.definition.goals;
    goals.forEach((goal, goalIndex) => {
      if (goal.type === 'candy' && goal.candy) {
        const positions = step.candyPositions[goal.candy];
        if (positions && positions.length > 0 && !this.isGoalComplete(goal)) {
          this.flyToGoal(goal.candy, positions, goalIndex);
        }
      }
    });
    if (step.scoreDelta > 0 && goals.some((g) => g.type === 'score')) {
      const center = this.getBlastCenter(step.matched);
      this.flyScoreToGoal(center.x, center.y);
    }
  }

  private flyToGoal(candyType: CandyType, positions: BoardPosition[], goalIndex: number): void {
    const goalEl = document.getElementById(`goal-chip-${goalIndex}`);
    if (!goalEl) return;
    const src = CANDY_ASSET_PACK.find((a) => a.candyType === candyType)?.src;
    if (!src) return;

    const MAX_FLYERS = 5;
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const sx = canvasRect.width / GAME_SIZE;
    const sy = canvasRect.height / GAME_SIZE;

    positions.slice(0, MAX_FLYERS).forEach((pos, i) => {
      const worldX = BOARD_X + pos.col * CELL_SIZE + CELL_SIZE / 2;
      const worldY = BOARD_Y + pos.row * CELL_SIZE + CELL_SIZE / 2;
      const startX = canvasRect.left + worldX * sx;
      const startY = canvasRect.top + worldY * sy;
      const goalRect = goalEl.getBoundingClientRect();
      const tx = goalRect.left + goalRect.width / 2;
      const ty = goalRect.top + goalRect.height / 2;
      const ctrlX = startX + (tx - startX) * 0.35 + (i % 2 === 0 ? 26 : -26);
      const ctrlY = Math.min(startY, ty) - 52 - i * 6;

      const div = document.createElement('div');
      div.style.cssText =
        `position:fixed;left:${startX - 14}px;top:${startY - 14}px;` +
        `width:28px;height:28px;` +
        `background:url('${src}') center/contain no-repeat;` +
        `border-radius:50%;pointer-events:none;z-index:9999;will-change:transform,opacity;`;
      document.body.appendChild(div);

      const flyObj = { t: 0 };
      this.tweens.add({
        targets: flyObj,
        t: 1,
        delay: i * 55,
        duration: 580,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const t = flyObj.t;
          const u = 1 - t;
          const x = u * u * startX + 2 * u * t * ctrlX + t * t * tx;
          const y = u * u * startY + 2 * u * t * ctrlY + t * t * ty;
          div.style.left = `${x - 14}px`;
          div.style.top = `${y - 14}px`;
          div.style.transform = `scale(${1 - t * 0.38})`;
          div.style.opacity = t > 0.78 ? String(Math.max(0, 1 - (t - 0.78) / 0.22)) : '1';
        },
        onComplete: () => {
          div.remove();
          if (i === 0) this.pulseGoalChip(goalEl);
        }
      });
    });
  }

  private flyScoreToGoal(blastX: number, blastY: number): void {
    const scoreIdx = this.state.definition.goals.findIndex((g) => g.type === 'score');
    if (scoreIdx < 0) return;
    const goalEl = document.getElementById(`goal-chip-${scoreIdx}`);
    if (!goalEl) return;

    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const sx = canvasRect.width / GAME_SIZE;
    const sy = canvasRect.height / GAME_SIZE;
    const startX = canvasRect.left + blastX * sx;
    const startY = canvasRect.top + blastY * sy;
    const goalRect = goalEl.getBoundingClientRect();
    const tx = goalRect.left + goalRect.width / 2;
    const ty = goalRect.top + goalRect.height / 2;
    const ctrlX = startX + (tx - startX) * 0.3 + 18;
    const ctrlY = Math.min(startY, ty) - 46;

    const orb = document.createElement('div');
    orb.style.cssText =
      `position:fixed;left:${startX - 11}px;top:${startY - 11}px;` +
      `width:22px;height:22px;border-radius:50%;` +
      `background:radial-gradient(circle at 38% 32%, #fff7b0 0%, #ffc020 70%);` +
      `box-shadow:0 0 8px rgba(255,175,0,0.75);` +
      `pointer-events:none;z-index:9999;will-change:transform,opacity;`;
    document.body.appendChild(orb);

    const flyObj = { t: 0 };
    this.tweens.add({
      targets: flyObj,
      t: 1,
      duration: 500,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        const t = flyObj.t;
        const u = 1 - t;
        const x = u * u * startX + 2 * u * t * ctrlX + t * t * tx;
        const y = u * u * startY + 2 * u * t * ctrlY + t * t * ty;
        orb.style.left = `${x - 11}px`;
        orb.style.top = `${y - 11}px`;
        orb.style.transform = `scale(${1 - t * 0.48})`;
        orb.style.opacity = t > 0.8 ? String(Math.max(0, 1 - (t - 0.8) / 0.2)) : '1';
      },
      onComplete: () => {
        orb.remove();
        this.pulseGoalChip(goalEl);
      }
    });
  }

  private pulseGoalChip(el: HTMLElement): void {
    el.classList.remove('is-popping');
    void el.offsetWidth;
    el.classList.add('is-popping');
    el.addEventListener('animationend', () => el.classList.remove('is-popping'), { once: true });
  }
}
