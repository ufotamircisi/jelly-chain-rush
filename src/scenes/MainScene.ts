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

const GAME_WIDTH = 540;
const BOARD_SIZE = 420;
const CELL_SIZE = BOARD_SIZE / BOARD_COLUMNS;
const BOARD_X = (GAME_WIDTH - BOARD_SIZE) / 2;
const BOARD_Y = 292;
const TODAY = () => getLocalDateKey();

export class MainScene extends Phaser.Scene {
  private save!: SaveData;
  private state!: GameState;
  private locale!: LocaleCode;
  private t!: (key: TranslationKey) => string;
  private screen: ScreenKey = 'play';
  private boardContainer?: Phaser.GameObjects.Container;
  private shakeButton?: Phaser.GameObjects.Container;
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
    this.drawScreen();

    if (this.isDailyRewardAvailable()) {
      this.drawDailyRewardModal();
    }
  }

  private drawScreen(): void {
    this.children.removeAll();
    this.cellContainers.clear();
    this.drawBackground();
    this.drawTopBar();

    if (this.screen === 'play') {
      this.drawPlayScreen();
    } else if (this.screen === 'island') {
      this.drawIslandScreen();
    } else {
      this.drawMarketScreen();
    }

    this.drawBottomNav();

    if (this.state.status === 'won') {
      this.drawWinPanel();
    } else if (this.state.status === 'failed') {
      this.drawContinuePanel();
    }
  }

  private drawBackground(): void {
    this.add.rectangle(270, 480, 540, 960, 0x6ee6df);
    this.add.rectangle(270, 842, 540, 236, 0xffd66b, 0.35);
    this.add.circle(72, 112, 62, 0xffffff, 0.18);
    this.add.circle(468, 154, 82, 0xffffff, 0.16);
    this.add.circle(100, 816, 110, 0xffffff, 0.14);
  }

  private drawTopBar(): void {
    this.add
      .text(270, 38, this.t('title'), {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#7b2bbf',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.addButton(442, 38, 148, 34, `${this.t('language')}: ${this.locale.toUpperCase()}`, () => {
      const index = SUPPORTED_LOCALES.indexOf(this.locale);
      this.locale = SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length];
      this.save = updateLanguage(this.save, this.locale);
      this.t = createTranslator(this.locale);
      this.drawScreen();
    }, 0xffffff, 0x7146bd, 15);
  }

  private drawPlayScreen(): void {
    this.drawCounters();
    this.drawGoalPanel();
    this.drawBoard();
    const helperKey = hasAnyValidGroup(this.state.board) ? 'blastHelper' : 'shakeHelper';

    this.add
      .text(270, 732, this.t(helperKey), {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#4d2382',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.shakeButton = this.addButton(270, 790, 310, 78, this.t('shakeButton'), () => this.handleShake(), 0xff5aa6, 0xffffff, 32);
  }

  private drawCounters(): void {
    const topStats = [
      `${this.t('level')} ${this.state.level}`,
      `${this.t('score')}: ${this.state.score.toLocaleString()} / ${this.state.definition.targetScore.toLocaleString()}`,
      `${this.t('highestMultiplier')}: ${getMultiplierLabel(this.state.highestMultiplierIndex) || 'x0'}`
    ];

    topStats.forEach((line, index) => {
      this.add
        .text(270, 86 + index * 28, line, {
          fontFamily: 'Arial',
          fontSize: index === 1 ? '18px' : '20px',
          color: '#3d2362',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);
    });

    this.drawPill(98, 194, `${this.t('shake')} ${this.state.shakesRemaining}/${MAX_SHAKES}`, 0x8f57df);
    this.drawPill(270, 194, `${this.t('energy')} ${this.state.energy}`, 0x19b68f);
    this.drawPill(442, 194, `${this.t('diamonds')} ${this.state.diamonds}`, 0x2d93e6);
  }

  private drawGoalPanel(): void {
    this.add.rectangle(270, 242, 470, 74, 0xffffff, 0.58).setStrokeStyle(2, 0x7b2bbf, 0.25);
    this.add.text(58, 214, this.t('goal'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#643095',
      fontStyle: 'bold'
    });

    this.state.definition.goals.forEach((goal, index) => {
      this.add.text(72, 238 + index * 18, this.formatGoal(goal), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: this.isGoalComplete(goal) ? '#168e67' : '#3d2362',
        fontStyle: 'bold'
      });
    });
  }

  private drawBoard(): void {
    this.boardContainer = this.add.container(BOARD_X, BOARD_Y);
    this.boardContainer.add(this.add.rectangle(BOARD_SIZE / 2, BOARD_SIZE / 2, BOARD_SIZE + 18, BOARD_SIZE + 18, 0xffffff, 0.34));

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLUMNS; col += 1) {
        const cell = this.state.board[row][col];
        const x = col * CELL_SIZE + CELL_SIZE / 2;
        const y = row * CELL_SIZE + CELL_SIZE / 2;
        const container = this.add.container(x, y);
        const multiplierLabel = getMultiplierLabel(cell.multiplierIndex);
        const candy = getCandyDefinition(cell.candy);

        container.add(this.add.rectangle(0, 0, CELL_SIZE - 7, CELL_SIZE - 7, 0xffffff, 0.34).setStrokeStyle(2, 0x7ad1e7, 0.6));
        container.add(this.add.text(0, 18, multiplierLabel, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#5b388d',
          fontStyle: 'bold'
        }).setOrigin(0.5));
        container.add(this.add.circle(0, -3, 21, candy.color).setStrokeStyle(4, candy.accent, 0.85));
        container.add(this.add.text(0, -4, candy.label, {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5));
        container.setSize(CELL_SIZE, CELL_SIZE);
        container.setInteractive(new Phaser.Geom.Rectangle(-CELL_SIZE / 2, -CELL_SIZE / 2, CELL_SIZE, CELL_SIZE), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', () => this.handleCellTap({ row, col }));

        this.boardContainer.add(container);
        this.cellContainers.set(this.positionKey({ row, col }), container);
      }
    }
  }

  private handleShake(): void {
    if (this.isShaking || this.state.status !== 'playing') {
      return;
    }

    const availableGroups = findValidGroups(this.state.board, 3);
    if (availableGroups.length > 0) {
      this.showFloatingText(270, 724, this.t('shakeBlocked'), '#ffffff');
      this.highlightAvailableGroups(availableGroups);
      this.showBlockedButtonFeedback();
      return;
    }

    if (this.state.shakesRemaining <= 0) {
      this.triggerLevelFail();
      return;
    }

    if (this.state.energy < SHAKE_COST_ENERGY) {
      this.showFloatingText(270, 724, this.t('noEnergy'), '#7b2bbf');
      return;
    }

    this.isShaking = true;
    this.state.shakesRemaining -= 1;
    this.state.energy -= SHAKE_COST_ENERGY;
    this.syncSaveCurrency();

    if (this.boardContainer) {
      this.tweens.add({
        targets: this.boardContainer,
        x: { from: BOARD_X - 10, to: BOARD_X + 10 },
        y: { from: BOARD_Y - 5, to: BOARD_Y + 5 },
        duration: 55,
        yoyo: true,
        repeat: 5,
        onComplete: () => this.finishShake()
      });
    } else {
      this.finishShake();
    }
  }

  private finishShake(): void {
    this.state.board = regenerateCandies(this.state.board);
    this.isShaking = false;

    if (this.state.shakesRemaining <= 0 && !areGoalsComplete(this.state)) {
      this.triggerLevelFail();
      return;
    }

    this.drawScreen();
  }

  private handleCellTap(position: BoardPosition): void {
    if (this.state.status !== 'playing') {
      return;
    }

    const group = findConnectedGroup(this.state.board, position);
    if (group.length < 3) {
      this.showInvalidFeedback(position);
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

      this.showFloatingText(270, 258, `+${result.scoreDelta.toLocaleString()}`, '#ffffff');
      this.time.delayedCall(180, () => {
        if (areGoalsComplete(this.state)) {
          this.triggerLevelWin();
        } else {
          this.drawScreen();
        }
      });
    });
  }

  private triggerLevelWin(): void {
    if (this.state.status === 'won') {
      return;
    }

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
    this.drawScreen();
  }

  private triggerLevelFail(): void {
    this.state.status = 'failed';
    this.drawScreen();
  }

  private continueLevel(shakes: number, diamondCost = 0): void {
    if (diamondCost > 0 && this.state.diamonds < diamondCost) {
      this.showFloatingText(270, 620, this.t('notEnoughDiamonds'), '#ffffff');
      return;
    }

    this.state.diamonds -= diamondCost;
    this.state.shakesRemaining += shakes;
    this.state.continued = true;
    this.state.status = 'playing';
    this.syncSaveCurrency();
    this.drawScreen();
  }

  private restartLevel(): void {
    this.state = createGameState(this.save);
    this.rewardSummary = undefined;
    this.screen = 'play';
    this.drawScreen();
  }

  private startNextLevel(): void {
    this.save.currentLevel = Math.max(this.save.currentLevel, this.state.level + 1);
    this.save.energy = this.state.energy;
    this.save.diamonds = this.state.diamonds;
    saveData(this.save);
    this.state = createGameState(this.save);
    this.rewardSummary = undefined;
    this.screen = 'play';
    this.drawScreen();
  }

  private drawWinPanel(): void {
    const reward = this.rewardSummary ?? calculateRewardSummary(this.state);
    const lines = [
      `${this.t('starsEarned')}: ${'★'.repeat(reward.stars)}`,
      `${this.t('starReward')}: +${reward.starEnergy} ${this.t('energy')} +${reward.starDiamonds} ${this.t('diamonds')}`,
      `${this.t('highestMultiplier')}: ${reward.multiplierLabel}`,
      `${this.t('multiplierBonus')}: +${reward.multiplierEnergy} ${this.t('energy')} +${reward.multiplierDiamonds} ${this.t('diamonds')}`,
      `${this.t('totalReward')}: +${reward.totalEnergy} ${this.t('energy')} +${reward.totalDiamonds} ${this.t('diamonds')}`
    ];

    this.drawModal(270, 470, 452, reward.superChest ? 382 : 342);
    this.add.text(270, 318, this.t('levelWin'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#7b2bbf',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    lines.forEach((line, index) => {
      this.add.text(270, 368 + index * 34, line, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#3d2362',
        fontStyle: 'bold',
        align: 'center'
      }).setOrigin(0.5);
    });

    if (reward.superChest) {
      this.add.text(270, 548, this.t('superChestUnlocked'), {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#d74f00',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 390 }
      }).setOrigin(0.5);
    }

    this.addButton(270, reward.superChest ? 620 : 586, 250, 54, this.t('nextLevel'), () => this.startNextLevel(), 0xff5aa6, 0xffffff, 22);
  }

  private drawContinuePanel(): void {
    this.drawModal(270, 482, 452, 440);
    this.add.text(270, 304, this.t('levelFailed'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#7b2bbf',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(270, 340, this.t('continuePrompt'), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#3d2362',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.addButton(270, 392, 330, 42, this.t('rewardedContinue'), () => this.continueLevel(1), 0x19b68f, 0xffffff, 16);
    this.addButton(270, 446, 330, 42, `${this.t('buyOneShake')} - 100 ${this.t('diamonds')}`, () => this.continueLevel(1, 100), 0xff5aa6, 0xffffff, 16);
    this.addButton(270, 500, 330, 42, `${this.t('buyFiveShakes')} - 300 ${this.t('diamonds')}`, () => this.continueLevel(5, 300), 0xff5aa6, 0xffffff, 16);
    this.addButton(270, 554, 330, 42, `${this.t('buyTenShakes')} - 600 ${this.t('diamonds')}`, () => this.continueLevel(10, 600), 0xff5aa6, 0xffffff, 16);
    this.addButton(270, 616, 250, 44, `${this.t('giveUp')} / ${this.t('restartLevel')}`, () => this.restartLevel(), 0xffffff, 0x7b2bbf, 15);
  }

  private drawDailyRewardModal(): void {
    const reward = getDailyReward(this.save.dailyLogin.streak + 1);
    this.drawModal(270, 438, 420, 296);
    this.add.text(270, 336, this.t('dailyRewardReady'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#7b2bbf',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(270, 388, `${this.t('day')} ${reward.day}: +${reward.energy} ${this.t('energy')} +${reward.diamonds} ${this.t('diamonds')}${reward.chest ? ` +${this.t('chest')}` : ''}`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#3d2362',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 360 }
    }).setOrigin(0.5);
    this.addButton(270, 484, 220, 52, this.t('claim'), () => this.claimDailyReward(), 0xff5aa6, 0xffffff, 22);
  }

  private claimDailyReward(): void {
    const reward = getDailyReward(this.save.dailyLogin.streak + 1);
    this.save.dailyLogin = {
      streak: this.save.dailyLogin.streak + 1,
      lastClaimDate: TODAY()
    };
    this.save.energy += reward.energy;
    this.save.diamonds += reward.diamonds;
    this.save.chests += reward.chest ? 1 : 0;
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.drawScreen();
  }

  private drawIslandScreen(): void {
    this.add.text(270, 88, this.t('island'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#643095',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.addButton(270, 130, 250, 38, this.t('collectAll'), () => this.collectIslandRewards(), 0xff5aa6, 0xffffff, 16);

    BUILDINGS.forEach((building, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 94 + col * 176;
      const y = 194 + row * 88;
      const isCompleted = this.save.completedBuildingIds.includes(building.id);
      const ready = isCompleted && this.isBuildingReady(building.id);
      const buildCost = this.getBuildCost(building.id);

      this.add.rectangle(x, y, 158, 78, isCompleted ? 0xffffff : 0xd9c7f2, isCompleted ? 0.72 : 0.58).setStrokeStyle(2, ready ? 0xff5aa6 : 0x8f57df, 0.65);
      this.add.text(x, y - 24, this.t(building.nameKey as TranslationKey), {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#3d2362',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 132 }
      }).setOrigin(0.5);
      this.add.text(x, y + 2, `${this.t('daily')}: +${building.energy} ${this.t('energy')} +${building.diamonds} ${this.t('diamonds')}`, {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#4d2382',
        align: 'center',
        wordWrap: { width: 138 }
      }).setOrigin(0.5);

      if (ready) {
        this.add.text(x, y + 24, this.t('ready'), {
          fontFamily: 'Arial',
          fontSize: '11px',
          color: '#d74f00',
          fontStyle: 'bold'
        }).setOrigin(0.5);
      } else if (isCompleted) {
        this.add.text(x, y + 24, this.t('claimedToday'), {
          fontFamily: 'Arial',
          fontSize: '10px',
          color: '#168e67',
          fontStyle: 'bold'
        }).setOrigin(0.5);
      } else {
        this.addButton(x, y + 25, 96, 22, `${this.t('build')} ${buildCost}`, () => this.buildBuilding(building.id), 0xffffff, 0x7b2bbf, 10);
      }
    });
  }

  private drawMarketScreen(): void {
    this.add.text(270, 108, this.t('market'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#643095',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.addButton(270, 190, 360, 58, `${this.t('marketOneShake')}`, () => this.buyMarketShakes(1, 100), 0xffffff, 0x7b2bbf, 20);
    this.addButton(270, 270, 360, 58, `${this.t('marketFiveShakes')}`, () => this.buyMarketShakes(5, 300), 0xffffff, 0x7b2bbf, 20);
    this.addButton(270, 350, 360, 58, `${this.t('marketTenShakes')}`, () => this.buyMarketShakes(10, 600), 0xffffff, 0x7b2bbf, 20);
    this.addButton(270, 450, 360, 58, this.t('marketBoosters'), () => this.showFloatingText(270, 520, this.t('marketSafePlaceholder'), '#ffffff'), 0xffffff, 0x7b2bbf, 18);
    this.addButton(270, 530, 360, 58, this.t('marketPacks'), () => this.showFloatingText(270, 600, this.t('marketSafePlaceholder'), '#ffffff'), 0xffffff, 0x7b2bbf, 18);
  }

  private buyMarketShakes(shakes: number, cost: number): void {
    if (this.state.status === 'failed') {
      this.continueLevel(shakes, cost);
      return;
    }

    this.showFloatingText(270, 624, this.t('marketSafePlaceholder'), '#ffffff');
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
      this.showFloatingText(270, 164, this.t('claimLater'), '#ffffff');
      return;
    }

    this.save.energy += energy;
    this.save.diamonds += diamonds;
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.showFloatingText(270, 164, `${this.t('gained')}: +${energy} ${this.t('energy')} +${diamonds} ${this.t('diamonds')}`, '#ffffff');
    this.time.delayedCall(450, () => this.drawScreen());
  }

  private buildBuilding(buildingId: number): void {
    const cost = this.getBuildCost(buildingId);
    if (this.save.diamonds < cost) {
      this.showFloatingText(270, 164, this.t('notEnoughDiamonds'), '#ffffff');
      return;
    }

    this.save.diamonds -= cost;
    this.save.completedBuildingIds = [...new Set([...this.save.completedBuildingIds, buildingId])].sort((a, b) => a - b);
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.drawScreen();
  }

  private drawBottomNav(): void {
    this.add.rectangle(270, 908, 540, 104, 0xffffff, 0.62);
    this.drawNavButton(95, 'play', this.t('play'));
    this.drawNavButton(270, 'island', this.t('island'));
    this.drawNavButton(445, 'market', this.t('market'));
  }

  private drawNavButton(x: number, key: ScreenKey, label: string): void {
    const active = this.screen === key;
    this.addButton(x, 908, 142, 58, label, () => {
      this.screen = key;
      this.drawScreen();
    }, active ? 0x7b2bbf : 0xffffff, active ? 0xffffff : 0x7b2bbf, 18);
  }

  private highlightGroup(group: BoardPosition[]): void {
    for (const position of group) {
      const container = this.cellContainers.get(this.positionKey(position));
      if (!container) continue;
      this.tweens.add({
        targets: container,
        scale: 1.12,
        alpha: 0.35,
        duration: 110
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

  private showBlockedButtonFeedback(): void {
    if (!this.shakeButton) {
      return;
    }

    this.tweens.killTweensOf(this.shakeButton);
    this.shakeButton.setScale(1);
    this.tweens.add({
      targets: this.shakeButton,
      x: { from: 262, to: 278 },
      scaleX: 0.98,
      scaleY: 1.04,
      duration: 55,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.shakeButton?.setPosition(270, 790);
        this.shakeButton?.setScale(1);
      }
    });
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

  private drawModal(x: number, y: number, width: number, height: number): void {
    this.add.rectangle(270, 480, 540, 960, 0x381d5f, 0.48).setInteractive();
    this.add.rectangle(x, y, width, height, 0xffffff, 0.95).setStrokeStyle(4, 0xff5aa6, 0.75);
  }

  private addButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    fill: number,
    textColor: number,
    fontSize: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, fill, 0.94).setStrokeStyle(3, 0xffffff, 0.72);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: `#${textColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 12 }
    }).setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(width, height);
    container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    container.input!.cursor = 'pointer';
    container.on('pointerover', () => {
      bg.setAlpha(1);
      container.setScale(1.03);
    });
    container.on('pointerout', () => {
      bg.setAlpha(0.94);
      container.setScale(1);
    });
    container.on('pointerdown', () => {
      this.tweens.killTweensOf(container);
      container.setScale(0.96);
      onClick();
    });
    container.on('pointerup', () => {
      container.setScale(1.03);
    });
    container.on('pointerupoutside', () => {
      container.setScale(1);
    });
    return container;
  }

  private drawPill(x: number, y: number, label: string, color: number): void {
    this.add.rectangle(x, y, 154, 42, color, 0.88).setStrokeStyle(2, 0xffffff, 0.65);
    this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  private showFloatingText(x: number, y: number, label: string, color: string): void {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color,
      fontStyle: 'bold',
      stroke: '#7b2bbf',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: 430 }
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 44,
      alpha: 0,
      duration: 850,
      onComplete: () => text.destroy()
    });
  }

  private formatGoal(goal: LevelGoal): string {
    const progress = getGoalProgress(this.state, goal);
    if (goal.type === 'score') {
      return `${this.t('goalScore')}: ${progress.toLocaleString()} / ${goal.target.toLocaleString()}`;
    }

    if (goal.type === 'candy' && goal.candy) {
      return `${this.getCandyName(goal.candy)}: ${progress} / ${goal.target}`;
    }

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

  private positionKey(position: BoardPosition): string {
    return `${position.row}:${position.col}`;
  }
}
