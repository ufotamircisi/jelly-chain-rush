import Phaser from 'phaser';
import { BUILDINGS } from '../data/buildings';
import { getCandyDefinition } from '../data/candies';
import { getMultiplierLabel } from '../data/multipliers';
import { blastGroup, findConnectedGroup, findValidGroups, getHighestMultiplierIndex, hasAnyValidGroup, regenerateCandies } from '../game/boardModel';
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
  private isShaking = false;

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
    this.setText('helper-text', this.t(hasAnyValidGroup(this.state.board) ? 'blastHelper' : 'shakeHelper'));
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
        this.drawCandyIcon(container, cell.candy);
        container.setSize(CELL_SIZE, CELL_SIZE);
        container.setInteractive(new Phaser.Geom.Rectangle(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', () => this.handleCellTap({ row, col }));
        this.boardContainer.add(container);
        this.cellContainers.set(this.positionKey({ row, col }), container);
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
    if (this.isShaking || this.state.status !== 'playing') return;

    const availableGroups = findValidGroups(this.state.board, 3);
    if (availableGroups.length > 0) {
      this.showWarning(this.t('shakeBlocked'));
      this.highlightAvailableGroups(availableGroups);
      this.blockShakeButton();
      return;
    }

    if (this.state.shakesRemaining <= 0) {
      this.triggerLevelFail();
      return;
    }

    if (this.state.energy < SHAKE_COST_ENERGY) {
      this.showWarning(this.t('noEnergy'));
      return;
    }

    this.isShaking = true;
    this.state.shakesRemaining -= 1;
    this.state.energy -= SHAKE_COST_ENERGY;
    this.syncSaveCurrency();
    this.renderOverlay();

    this.tweens.add({
      targets: this.boardContainer,
      x: { from: BOARD_X - 10, to: BOARD_X + 10 },
      y: { from: BOARD_Y - 5, to: BOARD_Y + 5 },
      duration: 55,
      yoyo: true,
      repeat: 5,
      onComplete: () => this.finishShake()
    });
  }

  private finishShake(): void {
    this.state.board = regenerateCandies(this.state.board);
    this.isShaking = false;
    this.drawBoard();

    if (this.state.shakesRemaining <= 0 && !areGoalsComplete(this.state)) {
      this.triggerLevelFail();
      return;
    }

    this.renderOverlay();
  }

  private handleCellTap(position: BoardPosition): void {
    if (this.state.status !== 'playing') return;

    const group = findConnectedGroup(this.state.board, position);
    if (group.length < 3) {
      this.showInvalidFeedback(position);
      this.showWarning(this.t('invalidGroup'));
      return;
    }

    this.highlightGroup(group);
    this.time.delayedCall(120, () => {
      const candy = this.state.board[position.row][position.col].candy;
      const result = blastGroup(this.state.board, group);
      this.state.board = result.board;
      this.state.score += result.scoreDelta;
      this.state.candyBlasts[candy] = (this.state.candyBlasts[candy] ?? 0) + group.length;
      this.state.highestMultiplierIndex = Math.max(this.state.highestMultiplierIndex, getHighestMultiplierIndex(result.board));
      this.save.stats.totalBlasts += 1;
      this.save.stats.highestMultiplierEver = Math.max(this.save.stats.highestMultiplierEver, this.getHighestMultiplierValue());
      saveData(this.save);
      this.showScorePopup(`+${result.scoreDelta.toLocaleString()}`);

      this.time.delayedCall(180, () => {
        this.drawBoard();
        if (areGoalsComplete(this.state)) {
          this.triggerLevelWin();
        } else {
          this.renderOverlay();
        }
      });
    });
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

  private showScorePopup(label: string): void {
    const text = this.add.text(GAME_SIZE / 2, 38, label, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#7b2bbf',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: 0,
      alpha: 0,
      duration: 850,
      onComplete: () => text.destroy()
    });
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
