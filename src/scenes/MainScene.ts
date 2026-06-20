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
const BOARD_SIZE = 392;
const CELL_SIZE = BOARD_SIZE / BOARD_COLUMNS;
const BOARD_X = (GAME_WIDTH - BOARD_SIZE) / 2;
const BOARD_Y = 270;
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
    this.add.rectangle(270, 480, 540, 960, 0x7ee8ff);
    this.add.rectangle(270, 510, 540, 760, 0xffb8d8, 0.16);
    this.add.rectangle(270, 822, 540, 278, 0x4ccfd1, 0.34);
    this.add.circle(70, 126, 68, 0xffffff, 0.2);
    this.add.circle(472, 158, 92, 0xffffff, 0.18);
    this.add.circle(84, 792, 116, 0xfff4b8, 0.18);
    this.add.circle(456, 744, 138, 0xff6fae, 0.14);
    this.add.rectangle(270, 886, 540, 148, 0x1f5ec9, 0.38);
  }

  private drawTopBar(): void {
    this.add.text(273, 50, this.t('title'), {
      fontFamily: 'Arial',
      fontSize: '39px',
      color: '#3d2362',
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: 7,
      align: 'center'
    }).setOrigin(0.5);
    this.add
      .text(270, 45, this.t('title'), {
        fontFamily: 'Arial',
        fontSize: '39px',
        color: '#ff5aa6',
        fontStyle: 'bold',
        stroke: '#7b2bbf',
        strokeThickness: 3,
        align: 'center'
      })
      .setOrigin(0.5);

    this.addButton(462, 26, 118, 30, `${this.t('language')}: ${this.locale.toUpperCase()}`, () => {
      const index = SUPPORTED_LOCALES.indexOf(this.locale);
      this.locale = SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length];
      this.save = updateLanguage(this.save, this.locale);
      this.t = createTranslator(this.locale);
      this.drawScreen();
    }, 0xffffff, 0x7146bd, 12);
  }

  private drawPlayScreen(): void {
    this.drawCounters();
    this.drawGoalPanel();
    this.drawBoard();
    this.drawHelperBadges();
    this.drawMultiplierRewardsPanel();
    const helperKey = hasAnyValidGroup(this.state.board) ? 'blastHelper' : 'shakeHelper';

    this.add
      .text(270, 710, this.t(helperKey), {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#3d2362',
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.shakeButton = this.addButton(270, 770, 340, 78, this.t('shakeButton'), () => this.handleShake(), 0x62d728, 0xffffff, 34);
  }

  private drawCounters(): void {
    this.drawStatCard(74, 92, 116, 48, this.t('level'), String(this.state.level), 0xffffff);
    this.drawStatCard(74, 150, 116, 48, this.t('score'), this.state.score.toLocaleString(), 0xffffff);
    this.drawStatCard(198, 104, 126, 58, this.t('goal'), this.state.definition.targetScore.toLocaleString(), 0xffffff);
    this.drawStatCard(400, 92, 122, 48, this.t('energy'), String(this.state.energy), 0xffffff);
    this.drawStatCard(400, 150, 122, 48, this.t('diamonds'), String(this.state.diamonds), 0xffffff);
    this.drawStatCard(270, 168, 122, 44, this.t('shake'), `${this.state.shakesRemaining}/${MAX_SHAKES}`, 0xffffff);
  }

  private drawGoalPanel(): void {
    this.drawGlossyPanel(26, 204, 160, 102, 0xffd7e8, 0xff5aa6);
    this.add.text(106, 222, this.t('goal'), {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#7b2bbf',
      strokeThickness: 3
    }).setOrigin(0.5);

    this.state.definition.goals.forEach((goal, index) => {
      this.add.text(40, 248 + index * 24, this.formatGoal(goal), {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: this.isGoalComplete(goal) ? '#168e67' : '#3d2362',
        fontStyle: 'bold',
        wordWrap: { width: 130 }
      });
    });
  }

  private drawBoard(): void {
    this.boardContainer = this.add.container(BOARD_X, BOARD_Y);
    this.boardContainer.add(this.add.rectangle(BOARD_SIZE / 2, BOARD_SIZE / 2 + 4, BOARD_SIZE + 20, BOARD_SIZE + 20, 0x3d2362, 0.18));
    this.boardContainer.add(this.add.rectangle(BOARD_SIZE / 2, BOARD_SIZE / 2, BOARD_SIZE + 18, BOARD_SIZE + 18, 0xffffff, 0.28).setStrokeStyle(3, 0xffffff, 0.58));

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLUMNS; col += 1) {
        const cell = this.state.board[row][col];
        const x = col * CELL_SIZE + CELL_SIZE / 2;
        const y = row * CELL_SIZE + CELL_SIZE / 2;
        const container = this.add.container(x, y);
        const multiplierLabel = getMultiplierLabel(cell.multiplierIndex);

        this.drawMultiplierFloor(container, cell.multiplierIndex);
        container.add(this.add.text(0, 18, multiplierLabel, {
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
    g.fillStyle(color, multiplierIndex > 0 ? 0.52 : 0.28);
    g.fillRoundedRect(x, y, size, size, 7);
    g.lineStyle(multiplierIndex >= 10 ? 3 : 2, multiplierIndex >= 10 ? 0xfff4a3 : 0xffffff, multiplierIndex > 0 ? 0.72 : 0.42);
    g.strokeRoundedRect(x, y, size, size, 7);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(x + 4, y + 4, size - 8, 12, 5);
    if (multiplierIndex >= 10) {
      g.lineStyle(2, 0xffd33f, 0.8);
      g.strokeRoundedRect(x + 4, y + 4, size - 8, size - 8, 5);
    }
    container.add(g);
  }

  private drawCandyIcon(container: Phaser.GameObjects.Container, candyType: CandyType): void {
    const candy = getCandyDefinition(candyType);
    const g = this.add.graphics();
    const y = -7;

    if (candyType === 'greenGummy') {
      g.fillStyle(0x23bd4f, 1);
      g.fillCircle(-10, y - 15, 6);
      g.fillCircle(10, y - 15, 6);
      g.fillRoundedRect(-16, y - 13, 32, 35, 12);
      g.fillStyle(0x9cff9e, 0.55);
      g.fillCircle(-6, y - 2, 4);
      g.fillCircle(6, y - 2, 4);
      g.lineStyle(3, 0xd6ffd8, 0.8);
      g.strokeRoundedRect(-16, y - 13, 32, 35, 12);
    } else if (candyType === 'purpleJelly') {
      g.fillStyle(0x9f33d8, 1);
      g.fillRoundedRect(-18, y - 15, 36, 31, 13);
      g.fillStyle(0xf2c4ff, 0.38);
      g.fillEllipse(-6, y - 6, 13, 18);
      g.lineStyle(3, 0xeadbff, 0.85);
      g.strokeRoundedRect(-18, y - 15, 36, 31, 13);
    } else if (candyType === 'redHeart') {
      g.fillStyle(0xff385f, 1);
      g.fillCircle(-8, y - 7, 11);
      g.fillCircle(8, y - 7, 11);
      g.fillTriangle(-19, y - 2, 19, y - 2, 0, y + 24);
      g.lineStyle(3, 0xffd3dc, 0.85);
      g.strokeCircle(-8, y - 7, 11);
      g.strokeCircle(8, y - 7, 11);
    } else if (candyType === 'yellowStar' || candyType === 'energyStar') {
      const fill = candyType === 'energyStar' ? 0x86fbff : 0xffd82e;
      const stroke = candyType === 'energyStar' ? 0xffffff : 0xfff5b8;
      g.fillStyle(fill, 1);
      g.lineStyle(3, stroke, 0.9);
      const points = this.getStarPoints(0, y, 24, 11, 5);
      g.fillPoints(points, true);
      g.strokePoints(points, true);
      g.fillStyle(0xffffff, 0.42);
      g.fillCircle(-6, y - 5, 4);
    } else if (candyType === 'blueRound') {
      g.fillStyle(0x198eff, 1);
      g.fillCircle(0, y, 22);
      g.fillStyle(0xbfe4ff, 0.56);
      g.fillCircle(-8, y - 9, 7);
      g.lineStyle(4, 0xd5e8ff, 0.85);
      g.strokeCircle(0, y, 22);
    } else if (candyType === 'orangeBean') {
      g.fillStyle(0xff912e, 1);
      g.fillEllipse(0, y, 42, 25);
      g.fillStyle(0xffe0b5, 0.45);
      g.fillEllipse(-8, y - 5, 16, 7);
      g.lineStyle(3, 0xffe3c4, 0.85);
      g.strokeEllipse(0, y, 42, 25);
      g.rotation = -0.42;
    } else {
      g.fillStyle(candy.color, 1);
      g.fillCircle(0, y, 21);
      g.lineStyle(4, candy.accent, 0.85);
      g.strokeCircle(0, y, 21);
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

  private drawHelperBadges(): void {
    this.drawGlossyPanel(20, 604, 155, 46, 0x13a9e8, 0xffffff);
    this.add.text(98, 627, this.t('helperBadgeBlast'), {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 126 }
    }).setOrigin(0.5);

    this.drawGlossyPanel(20, 656, 155, 46, 0x8f57df, 0xffffff);
    this.add.text(98, 679, this.t('specialCandyRule'), {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 126 }
    }).setOrigin(0.5);
  }

  private drawMultiplierRewardsPanel(): void {
    this.drawGlossyPanel(362, 602, 158, 104, 0xfff4b8, 0x8f57df);
    this.add.text(441, 620, this.t('multiplierRewards'), {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#643095',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    [
      ['x128', '+10'],
      ['x256', '+20'],
      ['x512', '+50'],
      ['x1000', '+100']
    ].forEach(([label, reward], index) => {
      const y = 642 + index * 15;
      this.add.text(382, y, label, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: label === 'x1000' ? '#b56b00' : '#168e67',
        fontStyle: 'bold'
      });
      this.add.text(448, y, `${reward} ${this.t('energy')} +${reward.replace('+', '')} ${this.t('diamonds')}`, {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#3d2362',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0);
    });
  }

  private drawStatCard(x: number, y: number, width: number, height: number, label: string, value: string, fill: number): void {
    this.drawGlossyPanel(x - width / 2, y - height / 2, width, height, fill, 0xd9b7ff);
    this.add.text(x, y - height * 0.18, label.toUpperCase(), {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#7b2bbf',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);
    this.add.text(x, y + height * 0.2, value, {
      fontFamily: 'Arial',
      fontSize: height > 50 ? '20px' : '18px',
      color: '#3d2362',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 12 }
    }).setOrigin(0.5);
  }

  private drawGlossyPanel(x: number, y: number, width: number, height: number, fill: number, stroke: number): void {
    this.add.rectangle(x + width / 2, y + height / 2 + 4, width, height, 0x3d2362, 0.16);
    this.add.rectangle(x + width / 2, y + height / 2, width, height, fill, 0.86).setStrokeStyle(3, stroke, 0.7);
    this.add.rectangle(x + width / 2, y + 10, width - 14, 12, 0xffffff, 0.22);
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
      this.showFloatingText(270, 710, this.t('invalidGroup'), '#ffffff');
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
    this.drawModal(270, 482, 452, 470);
    this.add.text(270, 284, this.t('levelFailed'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#7b2bbf',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(270, 318, this.t('continuePrompt'), {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#3d2362',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.state.definition.goals.forEach((goal, index) => {
      this.add.text(270, 350 + index * 20, this.formatGoal(goal), {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: this.isGoalComplete(goal) ? '#168e67' : '#3d2362',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 360 }
      }).setOrigin(0.5);
    });

    this.addButton(270, 416, 330, 40, this.t('rewardedContinue'), () => this.continueLevel(1), 0x19b68f, 0xffffff, 15);
    this.addButton(270, 468, 330, 40, `${this.t('buyOneShake')} - 100 ${this.t('diamonds')}`, () => this.continueLevel(1, 100), 0xff5aa6, 0xffffff, 15);
    this.addButton(270, 520, 330, 40, `${this.t('buyFiveShakes')} - 300 ${this.t('diamonds')}`, () => this.continueLevel(5, 300), 0xff5aa6, 0xffffff, 15);
    this.addButton(270, 572, 330, 40, `${this.t('buyTenShakes')} - 600 ${this.t('diamonds')}`, () => this.continueLevel(10, 600), 0xff5aa6, 0xffffff, 15);
    this.addButton(270, 628, 250, 42, `${this.t('giveUp')} / ${this.t('restartLevel')}`, () => this.restartLevel(), 0xffffff, 0x7b2bbf, 14);
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
        this.addButton(x, y + 25, 96, 22, this.t('claim'), () => this.claimBuildingReward(building.id), 0xffd33f, 0x7b2bbf, 10);
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
    this.addButton(270, 530, 360, 58, this.t('futureRemoveAds'), () => this.showFloatingText(270, 600, this.t('marketSafePlaceholder'), '#ffffff'), 0xffffff, 0x7b2bbf, 18);
    this.addButton(270, 610, 360, 58, this.t('futureDiamondPacks'), () => this.showFloatingText(270, 680, this.t('marketSafePlaceholder'), '#ffffff'), 0xffffff, 0x7b2bbf, 18);
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

  private claimBuildingReward(buildingId: number): void {
    const building = BUILDINGS.find((item) => item.id === buildingId);
    if (!building || !this.isBuildingReady(buildingId)) {
      return;
    }

    this.save.energy += building.energy;
    this.save.diamonds += building.diamonds;
    this.save.buildingClaimDates[String(buildingId)] = TODAY();
    this.state.energy = this.save.energy;
    this.state.diamonds = this.save.diamonds;
    saveData(this.save);
    this.showFloatingText(270, 164, `${this.t('gained')}: +${building.energy} ${this.t('energy')} +${building.diamonds} ${this.t('diamonds')}`, '#ffffff');
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
        this.shakeButton?.setPosition(270, 770);
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
    const shadow = this.add.rectangle(0, 5, width, height, 0x3d2362, 0.22);
    const bg = this.add.rectangle(0, 0, width, height, fill, 0.95).setStrokeStyle(3, 0xffffff, 0.78);
    const shine = this.add.rectangle(0, -height * 0.24, width - 18, Math.max(8, height * 0.22), 0xffffff, 0.22);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: `#${textColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 12 }
    }).setOrigin(0.5);
    container.add([shadow, bg, shine, text]);
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
