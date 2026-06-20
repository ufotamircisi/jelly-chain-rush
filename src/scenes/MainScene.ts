import Phaser from 'phaser';
import { BUILDINGS } from '../data/buildings';
import { getCandyDefinition } from '../data/candies';
import { getMultiplierLabel } from '../data/multipliers';
import {
  areAdjacent,
  type CascadeStep,
  getHighestMultiplierIndex,
  hasValidSwipeMove,
  regenerateCandies,
  resolveMatchesAndCascades,
  swapCandies
} from '../game/boardModel';
import { getLocalDateKey, isBeforeToday } from '../game/calendar';
import { getDailyReward } from '../game/dailyRewards';
import { createGameState } from '../game/gameState';
import { areGoalsComplete, getGoalProgress } from '../game/levels';
import { calculateRewardSummary } from '../game/rewards';
import { createTranslator, SUPPORTED_LOCALES, type TranslationKey } from '../locales';
import { loadSave, saveData, updateLanguage } from '../save/saveData';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  MAX_SHAKES,
  SHAKE_COST_ENERGY,
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

export class MainScene extends Phaser.Scene {
  private save!: SaveData;
  private state!: GameState;
  private locale!: LocaleCode;
  private t!: (key: TranslationKey) => string;
  private screen: ScreenKey = 'play';
  private boardContainer?: Phaser.GameObjects.Container;
  private rewardSummary?: RewardSummary;
  private cellContainers = new Map<string, Phaser.GameObjects.Container>();
  private candyContainers = new Map<string, Phaser.GameObjects.Container>();
  private isShaking = false;
  private isDropping = false;
  private isResolving = false;
  private dragStart?: BoardPosition;
  private audioContext?: AudioContext;

  constructor() {
    super('MainScene');
  }

  create(): void {
    this.save = loadSave();
    this.locale = this.save.language;
    this.t = createTranslator(this.locale);
    this.state = createGameState(this.save);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.bindOverlay();
    this.drawBoard();
    this.renderOverlay();
    this.time.delayedCall(1, () => this.startDropSequence({ playChime: true }));

    if (this.isDailyRewardAvailable()) {
      this.renderDailyRewardModal();
    }
  }

  private bindOverlay(): void {
    this.el('shake-button').addEventListener('click', () => {
      this.bumpShakeButton();
      this.handleShake();
    });

    this.el('language-button').addEventListener('click', () => {
      const index = SUPPORTED_LOCALES.indexOf(this.locale);
      this.locale = SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length];
      this.save = updateLanguage(this.save, this.locale);
      this.t = createTranslator(this.locale);
      this.renderOverlay();
    });

    this.el('collect-all-button').addEventListener('click', () => this.collectIslandRewards());

    for (const key of ['play', 'island', 'market'] as ScreenKey[]) {
      this.el(`nav-${key}`).addEventListener('click', () => {
        this.screen = key;
        this.renderOverlay();
      });
    }
  }

  private renderOverlay(): void {
    this.el('phone-frame').classList.toggle('is-gameplay-active', this.screen === 'play');
    this.el('shake-button').toggleAttribute('disabled', this.isShaking || this.isDropping || this.isResolving || this.state.status !== 'playing');
    this.el('phone-frame').classList.toggle('is-island-active', this.screen === 'island');
    this.el('phone-frame').classList.toggle('is-market-active', this.screen === 'market');
    this.setText('game-title', this.t('title'));
    this.setText('language-button', `${this.t('language')}: ${this.locale.toUpperCase()}`);
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
    this.setText('shake-value', `${this.state.shakesRemaining}/${MAX_SHAKES}`);
    this.setText('goal-panel-title', this.t('goal'));
    this.setText('helper-text', this.getHelperText());
    this.setText('badge-blast', this.t('helperBadgeBlast'));
    this.setText('badge-special', this.t('specialCandyRule'));
    this.setText('multiplier-rewards-title', this.t('multiplierRewards'));
    this.setText('shake-button', this.t('shakeButton'));
    this.setText('island-title', this.t('islandTitle'));
    this.setText('collect-all-button', this.t('collectAll'));
    this.setText('market-title', this.t('market'));

    this.renderGoals();
    this.renderMultiplierRewards();
    this.renderIsland();
    this.renderMarket();
    this.renderNav();
    this.renderModalForStatus();
  }

  private renderGoals(): void {
    const list = this.el('goal-list');
    list.innerHTML = '';
    for (const goal of this.state.definition.goals) {
      const item = document.createElement('article');
      item.className = `goal-chip${this.isGoalComplete(goal) ? ' is-complete' : ''}`;
      item.textContent = this.formatGoal(goal);
      list.appendChild(item);
    }
  }

  private renderMultiplierRewards(): void {
    const list = this.el('multiplier-rewards');
    list.innerHTML = '';
    [
      ['x128', '+10', '+10', ''],
      ['x256', '+20', '+20', ''],
      ['x512', '+50', '+50', ''],
      ['x1000', '+100', '+100', ` + ${this.t('superChest')}`]
    ].forEach(([label, energy, diamonds, extra]) => {
      const item = document.createElement('article');
      item.className = 'reward-chip';
      item.textContent = `${label}: ${energy} ${this.t('energy')} ${diamonds} ${this.t('diamonds')}${extra}`;
      list.appendChild(item);
    });
  }

  private renderIsland(): void {
    const list = this.el('building-list');
    list.innerHTML = '';
    for (const building of BUILDINGS) {
      const completed = this.save.completedBuildingIds.includes(building.id);
      const ready = completed && this.isBuildingReady(building.id);
      const card = document.createElement('article');
      card.className = `building-card${ready ? ' is-ready' : completed ? ' is-completed' : ' is-locked'}`;
      const state = ready ? this.t('ready') : completed ? this.t('completed') : this.t('locked');
      const icon = this.getBuildingIcon(building.id);
      const action = ready
        ? `<button class="building-action" data-claim="${building.id}">${this.t('claim')}</button>`
        : completed
          ? `<p>${this.t('claimedToday')}</p>`
          : `<button class="building-action" data-build="${building.id}">${this.t('build')} ${this.getBuildCost(building.id)}</button>`;

      card.innerHTML = `
        <span class="building-state${ready ? ' ready' : ''}">${state}</span>
        <div class="building-icon" aria-hidden="true">${icon}</div>
        <h3>${this.t(building.nameKey as TranslationKey)}</h3>
        <p>${this.t('daily')}: +${building.energy} ${this.t('energy')} +${building.diamonds} ${this.t('diamonds')}</p>
        ${action}
      `;
      list.appendChild(card);
    }

    list.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((button) => {
      button.addEventListener('click', () => this.claimBuildingReward(Number(button.dataset.claim)));
    });
    list.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((button) => {
      button.addEventListener('click', () => this.buildBuilding(Number(button.dataset.build)));
    });
  }

  private renderMarket(): void {
    const list = this.el('market-list');
    const items = [
      { label: this.t('marketOneShake'), shakes: 1, cost: 100, active: true },
      { label: this.t('marketFiveShakes'), shakes: 5, cost: 300, active: true },
      { label: this.t('marketTenShakes'), shakes: 10, cost: 600, active: true },
      { label: this.t('marketBoosters'), shakes: 0, cost: 0, active: false },
      { label: this.t('futureDiamondPacks'), shakes: 0, cost: 0, active: false }
    ];
    list.innerHTML = '';

    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'market-card';
      card.innerHTML = `
        <span class="market-icon" aria-hidden="true">${item.active ? '⚡' : '✦'}</span>
        <strong>${item.label}</strong>
        <button type="button">${item.active ? this.t('claim') : this.t('claimLater')}</button>
      `;
      const button = card.querySelector('button');
      button?.addEventListener('click', () => {
        if (item.active) {
          this.buyMarketShakes(item.shakes, item.cost);
        } else {
          this.showWarning(this.t('marketSafePlaceholder'));
        }
      });
      list.appendChild(card);
    }
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

  private renderModalForStatus(): void {
    if (this.state.status === 'won') {
      this.renderWinModal();
    } else if (this.state.status === 'failed') {
      this.renderFailModal();
    } else {
      this.closeModal();
    }
  }

  private drawBoard(): void {
    this.children.removeAll();
    this.cellContainers.clear();
    this.candyContainers.clear();
    this.boardContainer = this.add.container(BOARD_X, BOARD_Y);
    this.boardContainer.add(this.add.rectangle(BOARD_SIZE / 2, BOARD_SIZE / 2 + 3, BOARD_SIZE + 12, BOARD_SIZE + 12, 0x3d2362, 0.18));
    this.boardContainer.add(this.add.rectangle(BOARD_SIZE / 2, BOARD_SIZE / 2, BOARD_SIZE + 10, BOARD_SIZE + 10, 0xffffff, 0.28).setStrokeStyle(3, 0xffffff, 0.58));

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLUMNS; col += 1) {
        const cell = this.state.board[row][col];
        const x = col * CELL_SIZE + CELL_SIZE / 2;
        const y = row * CELL_SIZE + CELL_SIZE / 2;
        const container = this.add.container(x, y);
        this.drawMultiplierFloor(container, cell.multiplierIndex);
        container.add(this.add.text(0, 17, getMultiplierLabel(cell.multiplierIndex), {
          fontFamily: 'Arial',
          fontSize: cell.multiplierIndex >= 10 ? '13px' : '14px',
          color: cell.multiplierIndex >= 10 ? '#7a3d00' : '#ffffff',
          fontStyle: 'bold',
          stroke: cell.multiplierIndex >= 10 ? '#fff1a6' : '#4d2382',
          strokeThickness: 3
        }).setOrigin(0.5));
        const candyContainer = this.add.container(0, 0);
        this.drawCandyIcon(candyContainer, cell.candy);
        container.add(candyContainer);
        container.setSize(CELL_SIZE, CELL_SIZE);
        container.setInteractive(new Phaser.Geom.Rectangle(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', () => this.handleCellPointerDown({ row, col }));
        container.on('pointerup', () => this.handleCellPointerUp({ row, col }));
        this.boardContainer.add(container);
        this.cellContainers.set(this.positionKey({ row, col }), container);
        this.candyContainers.set(this.positionKey({ row, col }), candyContainer);
      }
    }
  }

  private drawMultiplierFloor(container: Phaser.GameObjects.Container, multiplierIndex: number): void {
    const color = MULTIPLIER_TINTS[multiplierIndex] ?? 0xdff8ff;
    const g = this.add.graphics();
    const size = CELL_SIZE - 6;
    const x = -size / 2;
    const y = -size / 2;
    g.fillStyle(color, multiplierIndex > 0 ? 0.62 : 0.36);
    g.fillRoundedRect(x, y, size, size, 8);
    g.lineStyle(multiplierIndex >= 10 ? 3 : 2, multiplierIndex >= 10 ? 0xfff4a3 : 0xffffff, multiplierIndex > 0 ? 0.84 : 0.52);
    g.strokeRoundedRect(x, y, size, size, 8);
    if (multiplierIndex >= 10) {
      g.lineStyle(2, 0xffb11f, 0.95);
      g.strokeRoundedRect(x + 3, y + 3, size - 6, size - 6, 6);
      g.fillStyle(0xffdd58, 0.28);
    } else if (multiplierIndex >= 9) {
      g.fillStyle(0xffffff, 0.3);
    } else {
      g.fillStyle(0xffffff, 0.22);
    }
    g.fillRoundedRect(x + 4, y + 4, size - 8, 12, 6);
    container.add(g);
  }

  private drawCandyIcon(container: Phaser.GameObjects.Container, candyType: CandyType): void {
    const candy = getCandyDefinition(candyType);
    const g = this.add.graphics();
    const y = -8;

    if (candyType === 'greenGummy') {
      g.fillStyle(0x23bd4f, 1);
      g.fillCircle(-9, y - 14, 5);
      g.fillCircle(9, y - 14, 5);
      g.fillRoundedRect(-14, y - 12, 28, 31, 11);
      g.fillStyle(0x9cff9e, 0.55);
      g.fillCircle(-5, y - 2, 3);
      g.fillCircle(5, y - 2, 3);
      g.lineStyle(3, 0xd6ffd8, 0.8);
      g.strokeRoundedRect(-14, y - 12, 28, 31, 11);
    } else if (candyType === 'purpleJelly') {
      g.fillStyle(0x9f33d8, 1);
      g.fillRoundedRect(-16, y - 14, 32, 29, 13);
      g.fillStyle(0xf2c4ff, 0.38);
      g.fillEllipse(-5, y - 6, 12, 17);
      g.lineStyle(3, 0xeadbff, 0.85);
      g.strokeRoundedRect(-16, y - 14, 32, 29, 13);
    } else if (candyType === 'redHeart') {
      g.fillStyle(0xff385f, 1);
      g.fillCircle(-7, y - 7, 10);
      g.fillCircle(7, y - 7, 10);
      g.fillTriangle(-17, y - 2, 17, y - 2, 0, y + 21);
      g.lineStyle(3, 0xffd3dc, 0.85);
      g.strokeCircle(-7, y - 7, 10);
      g.strokeCircle(7, y - 7, 10);
    } else if (candyType === 'yellowStar' || candyType === 'energyStar') {
      const fill = candyType === 'energyStar' ? 0x86fbff : 0xffd82e;
      const stroke = candyType === 'energyStar' ? 0xffffff : 0xfff5b8;
      g.fillStyle(fill, 1);
      g.lineStyle(3, stroke, 0.9);
      const points = this.getStarPoints(0, y, 21, 10, 5);
      g.fillPoints(points, true);
      g.strokePoints(points, true);
    } else if (candyType === 'blueRound') {
      g.fillStyle(0x198eff, 1);
      g.fillCircle(0, y, 20);
      g.fillStyle(0xbfe4ff, 0.56);
      g.fillCircle(-7, y - 8, 6);
      g.lineStyle(4, 0xd5e8ff, 0.85);
      g.strokeCircle(0, y, 20);
    } else if (candyType === 'orangeBean') {
      g.fillStyle(0xff912e, 1);
      g.fillEllipse(0, y, 38, 23);
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

    if (this.state.shakesRemaining <= 0) {
      this.triggerLevelFail();
      return;
    }

    if (this.state.energy < SHAKE_COST_ENERGY) {
      this.showWarning(this.t('noEnergy'));
      return;
    }

    this.isShaking = true;
    this.dragStart = undefined;
    this.state.shakesRemaining -= 1;
    this.state.energy -= SHAKE_COST_ENERGY;
    this.syncSaveCurrency();
    this.renderOverlay();
    this.playStartChime();

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

  private startDropSequence(options: { playChime?: boolean } = {}): void {
    if (this.isDropping || this.isResolving || this.state.status !== 'playing') return;

    if (options.playChime) {
      this.playStartChime();
    }

    this.state.board = regenerateCandies(this.state.board);
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

  private handleCellPointerDown(position: BoardPosition): void {
    if (!this.canUseBoardInput()) return;
    this.dragStart = position;
  }

  private handleCellPointerUp(position: BoardPosition): void {
    if (!this.canUseBoardInput() || !this.dragStart) return;
    const start = this.dragStart;
    this.dragStart = undefined;

    if (start.row === position.row && start.col === position.col) {
      return;
    }

    this.handleSwipe(start, position);
  }

  private handleSwipe(first: BoardPosition, second: BoardPosition): void {
    if (!areAdjacent(first, second)) {
      this.showInvalidFeedback(first);
      this.playInvalidSound();
      this.showWarning(this.t('noMatch'));
      return;
    }

    const swappedBoard = swapCandies(this.state.board, first, second);
    const preview = resolveMatchesAndCascades(swappedBoard);
    this.state.board = swappedBoard;
    this.drawBoard();

    if (preview.steps.length === 0) {
      this.time.delayedCall(120, () => {
        this.state.board = swapCandies(this.state.board, first, second);
        this.drawBoard();
        this.showInvalidFeedback(first);
        this.showInvalidFeedback(second);
        this.playInvalidSound();
        this.showWarning(this.t('noMatch'));
        this.renderOverlay();
      });
      return;
    }

    this.showWarning(this.t('chainInProgress'));
    this.time.delayedCall(120, () => this.resolveCurrentCascades());
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
          duration: totalDuration - columnDelay - rowDelay,
          delay: columnDelay + rowDelay,
          ease: 'Bounce.easeOut',
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

  private resolveCurrentCascades(): void {
    if (this.state.status !== 'playing') return;

    this.isResolving = true;
    this.renderOverlay();
    const result = resolveMatchesAndCascades(this.state.board);
    this.state.board = result.board;

    if (result.steps.length > 0) {
      this.state.score += result.scoreDelta;
      for (const [candy, count] of Object.entries(result.candyCounts) as [CandyType, number][]) {
        this.state.candyBlasts[candy] = (this.state.candyBlasts[candy] ?? 0) + count;
      }
      this.state.highestMultiplierIndex = Math.max(this.state.highestMultiplierIndex, getHighestMultiplierIndex(result.board));
      this.save.stats.totalBlasts += result.steps.length;
      this.save.stats.highestMultiplierEver = Math.max(this.save.stats.highestMultiplierEver, this.getHighestMultiplierValue());
      saveData(this.save);
      this.playCascadeFeedback(result.steps);
    }

    const delay = Math.max(260, result.steps.length * 430);
    this.time.delayedCall(delay, () => {
      this.isResolving = false;
      this.drawBoard();

      if (areGoalsComplete(this.state)) {
        this.triggerLevelWin();
        return;
      }

      if (this.state.shakesRemaining <= 0) {
        this.triggerLevelFail();
        return;
      }

      this.renderOverlay();
    });
  }

  private canUseBoardInput(): boolean {
    return this.state.status === 'playing' && !this.isShaking && !this.isDropping && !this.isResolving;
  }

  private getHelperText(): string {
    if (this.isShaking || this.isDropping) return this.t('shakeDropHelper');
    if (this.isResolving) return this.t('chainInProgress');
    if (hasValidSwipeMove(this.state.board)) return this.t('swipeHelper');
    return this.t('shakeHelper');
  }

  private triggerLevelWin(): void {
    if (this.state.status === 'won') return;
    this.state.status = 'won';
    this.rewardSummary = calculateRewardSummary(this.state);
    this.state.energy += this.rewardSummary.totalEnergy;
    this.state.diamonds += this.rewardSummary.totalDiamonds;
    this.save = {
      ...this.save,
      currentLevel: this.state.level + 1,
      highestUnlockedLevel: Math.max(this.save.highestUnlockedLevel, this.state.level + 1),
      energy: this.state.energy,
      diamonds: this.state.diamonds,
      superChests: this.save.superChests + (this.rewardSummary.superChest ? 1 : 0),
      stats: {
        ...this.save.stats,
        levelsCompleted: this.save.stats.levelsCompleted + 1,
        highestMultiplierEver: Math.max(this.save.stats.highestMultiplierEver, this.getHighestMultiplierValue())
      }
    };
    saveData(this.save);
    this.renderOverlay();
  }

  private triggerLevelFail(): void {
    this.state.status = 'failed';
    this.renderOverlay();
  }

  private continueLevel(shakes: number, diamondCost = 0): void {
    if (diamondCost > 0 && this.state.diamonds < diamondCost) {
      this.showWarning(this.t('notEnoughDiamonds'));
      return;
    }

    this.state.diamonds -= diamondCost;
    this.state.shakesRemaining += shakes;
    this.state.continued = true;
    this.state.status = 'playing';
    this.syncSaveCurrency();
    this.closeModal();
    this.renderOverlay();
  }

  private restartLevel(): void {
    this.state = createGameState(this.save);
    this.rewardSummary = undefined;
    this.screen = 'play';
    this.closeModal();
    this.drawBoard();
    this.renderOverlay();
    this.time.delayedCall(1, () => this.startDropSequence({ playChime: true }));
  }

  private startNextLevel(): void {
    this.save.currentLevel = Math.max(this.save.currentLevel, this.state.level + 1);
    this.save.energy = this.state.energy;
    this.save.diamonds = this.state.diamonds;
    saveData(this.save);
    this.state = createGameState(this.save);
    this.rewardSummary = undefined;
    this.screen = 'play';
    this.closeModal();
    this.drawBoard();
    this.renderOverlay();
    this.time.delayedCall(1, () => this.startDropSequence({ playChime: true }));
  }

  private renderWinModal(): void {
    const reward = this.rewardSummary ?? calculateRewardSummary(this.state);
    this.openModal(`
      <div class="modal-card">
        <h2>${this.t('levelWin')}</h2>
        <p>${this.t('starsEarned')}: ${'*'.repeat(reward.stars)}</p>
        <p>${this.t('starReward')}: +${reward.starEnergy} ${this.t('energy')} +${reward.starDiamonds} ${this.t('diamonds')}</p>
        <p>${this.t('highestMultiplier')}: ${reward.multiplierLabel}</p>
        <p>${this.t('multiplierBonus')}: +${reward.multiplierEnergy} ${this.t('energy')} +${reward.multiplierDiamonds} ${this.t('diamonds')}</p>
        <p>${this.t('totalReward')}: +${reward.totalEnergy} ${this.t('energy')} +${reward.totalDiamonds} ${this.t('diamonds')}</p>
        ${reward.superChest ? `<p>${this.t('superChestUnlocked')}</p>` : ''}
        <button type="button" data-action="next">${this.t('nextLevel')}</button>
      </div>
    `);
    this.modalButton('next', () => this.startNextLevel());
  }

  private renderFailModal(): void {
    const goals = this.state.definition.goals.map((goal) => `<p>${this.formatGoal(goal)}</p>`).join('');
    this.openModal(`
      <div class="modal-card">
        <h2>${this.t('levelFailed')}</h2>
        <p>${this.t('continuePrompt')}</p>
        ${goals}
        <button type="button" data-action="ad">${this.t('rewardedContinue')}</button>
        <button type="button" data-action="one">${this.t('buyOneShake')} - 100 ${this.t('diamonds')}</button>
        <button type="button" data-action="five">${this.t('buyFiveShakes')} - 300 ${this.t('diamonds')}</button>
        <button type="button" data-action="ten">${this.t('buyTenShakes')} - 600 ${this.t('diamonds')}</button>
        <button type="button" data-action="restart">${this.t('giveUp')} / ${this.t('restartLevel')}</button>
      </div>
    `);
    this.modalButton('ad', () => this.continueLevel(1));
    this.modalButton('one', () => this.continueLevel(1, 100));
    this.modalButton('five', () => this.continueLevel(5, 300));
    this.modalButton('ten', () => this.continueLevel(10, 600));
    this.modalButton('restart', () => this.restartLevel());
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
    this.save.energy += reward.energy;
    this.save.diamonds += reward.diamonds;
    this.save.chests += reward.chest ? 1 : 0;
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.closeModal();
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
      this.showWarning(this.t('claimLater'));
      return;
    }

    this.save.energy += energy;
    this.save.diamonds += diamonds;
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.showWarning(`${this.t('gained')}: +${energy} ${this.t('energy')} +${diamonds} ${this.t('diamonds')}`);
    this.renderOverlay();
  }

  private claimBuildingReward(buildingId: number): void {
    const building = BUILDINGS.find((item) => item.id === buildingId);
    if (!building || !this.isBuildingReady(buildingId)) return;

    this.save.energy += building.energy;
    this.save.diamonds += building.diamonds;
    this.save.buildingClaimDates[String(buildingId)] = TODAY();
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.showWarning(`${this.t('gained')}: +${building.energy} ${this.t('energy')} +${building.diamonds} ${this.t('diamonds')}`);
    this.renderOverlay();
  }

  private buildBuilding(buildingId: number): void {
    const cost = this.getBuildCost(buildingId);
    if (this.save.diamonds < cost) {
      this.showWarning(this.t('notEnoughDiamonds'));
      return;
    }

    this.save.diamonds -= cost;
    this.save.completedBuildingIds = [...new Set([...this.save.completedBuildingIds, buildingId])].sort((a, b) => a - b);
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.renderOverlay();
  }

  private buyMarketShakes(shakes: number, cost: number): void {
    if (this.state.status === 'failed') {
      this.continueLevel(shakes, cost);
      return;
    }

    this.showWarning(this.t('marketSafePlaceholder'));
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

  private playCascadeFeedback(steps: CascadeStep[]): void {
    steps.forEach((step, index) => {
      this.time.delayedCall(index * 410, () => {
        this.playBlastFeedback(step, index);
      });
    });
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
    this.showScorePopup(`+${this.formatScore(step.scoreDelta)}`, center.x, center.y - 8, size, highMultiplier, specialMultiplier);
    this.playBlastSound(size, specialMultiplier);

    if (powerful && this.boardContainer) {
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
      this.playChainSound(cascadeIndex);
    }
  }

  private emitSparkles(x: number, y: number, size: number, highMultiplier: boolean, specialMultiplier: boolean): void {
    const count = size >= 6 ? 18 : size >= 5 ? 14 : size >= 4 ? 10 : 7;
    const color = specialMultiplier ? 0xffd33f : highMultiplier ? 0xffffff : 0xfff1a6;

    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + (Math.random() * 0.36 - 0.18);
      const minDistance = size >= 5 ? 34 : 22;
      const maxDistance = size >= 6 ? 74 : 48;
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
      radius: size >= 6 ? 66 : size >= 5 ? 54 : size >= 4 ? 42 : 30,
      alpha: 0,
      duration: size >= 5 ? 420 : 280,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  private showScorePopup(label: string, x: number, y: number, size: number, highMultiplier: boolean, specialMultiplier: boolean): void {
    const fontSize = specialMultiplier ? 34 : highMultiplier || size >= 5 ? 30 : size >= 4 ? 25 : 21;
    const text = this.add.text(x, y, label, {
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
      y: y - (size >= 5 || highMultiplier ? 58 : 42),
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
    warning.textContent = label;
    window.setTimeout(() => {
      if (warning.textContent === label) warning.textContent = '';
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

  private playStartChime(): void {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    this.audioContext ??= new AudioContextClass();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;
    [660, 880].forEach((frequency, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.09);
      gain.gain.setValueAtTime(0.0001, now + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.09 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.18);
      oscillator.connect(gain);
      gain.connect(this.audioContext!.destination);
      oscillator.start(now + index * 0.09);
      oscillator.stop(now + index * 0.09 + 0.2);
    });
  }

  private playBlastSound(size: number, specialMultiplier: boolean): void {
    const audio = this.getAudioContext();
    if (!audio) return;

    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const baseFrequency = specialMultiplier ? 760 : size >= 5 ? 520 : size >= 4 ? 420 : 320;

    oscillator.type = size >= 5 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(baseFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(90, baseFrequency * 0.36), now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(specialMultiplier ? 0.22 : size >= 5 ? 0.18 : 0.12, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (size >= 5 ? 0.28 : 0.18));
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + (size >= 5 ? 0.3 : 0.2));

    if (size >= 5 || specialMultiplier) {
      this.playTone(baseFrequency * 1.5, 0.08, 0.12, 0.05);
    }
  }

  private playChainSound(cascadeIndex: number): void {
    const base = cascadeIndex >= 2 ? 980 : 820;
    this.playTone(base, 0.1, 0.1, 0.02);
    this.time.delayedCall(70, () => this.playTone(base * 1.25, 0.08, 0.09, 0.02));
  }

  private playInvalidSound(): void {
    const audio = this.getAudioContext();
    if (!audio) return;

    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(180, now);
    oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }

  private playTone(frequency: number, duration: number, volume: number, delay = 0): void {
    const audio = this.getAudioContext();
    if (!audio) return;

    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private getAudioContext(): AudioContext | undefined {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return undefined;

    this.audioContext ??= new AudioContextClass();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
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
      energyStar: 'candyEnergyStar'
    };
    return this.t(keys[candy]);
  }

  private getHighestMultiplierValue(): number {
    const label = getMultiplierLabel(this.state.highestMultiplierIndex);
    return label ? Number(label.replace('x', '')) : 0;
  }

  private syncSaveCurrency(): void {
    this.save.energy = this.state.energy;
    this.save.diamonds = this.state.diamonds;
    this.save.currentLevel = this.state.level;
    saveData(this.save);
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

  private modalButton(action: string, onClick: () => void): void {
    this.el('modal-root').querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.addEventListener('click', onClick);
  }

  private setText(id: string, value: string): void {
    this.el(id).textContent = value;
  }

  private el(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element #${id}`);
    return element;
  }

  private positionKey(position: BoardPosition): string {
    return `${position.row}:${position.col}`;
  }
}
