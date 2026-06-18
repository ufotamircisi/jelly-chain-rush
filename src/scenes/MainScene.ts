import Phaser from 'phaser';
import { BUILDINGS } from '../data/buildings';
import { getCandyDefinition } from '../data/candies';
import { getMultiplierLabel } from '../data/multipliers';
import { blastGroup, findConnectedGroup, hasAnyValidGroup, regenerateCandies } from '../game/boardModel';
import { createGameState } from '../game/gameState';
import { createTranslator, SUPPORTED_LOCALES, type TranslationKey } from '../locales';
import { loadSave, saveData, updateLanguage } from '../save/saveData';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  SHAKE_COST_ENERGY,
  type BoardPosition,
  type GameState,
  type LocaleCode,
  type SaveData,
  type ScreenKey
} from '../types';

const GAME_WIDTH = 540;
const BOARD_SIZE = 420;
const CELL_SIZE = BOARD_SIZE / BOARD_COLUMNS;
const BOARD_X = (GAME_WIDTH - BOARD_SIZE) / 2;
const BOARD_Y = 278;

export class MainScene extends Phaser.Scene {
  private save!: SaveData;
  private state!: GameState;
  private locale!: LocaleCode;
  private t!: (key: TranslationKey) => string;
  private screen: ScreenKey = 'play';
  private boardContainer?: Phaser.GameObjects.Container;
  private cellContainers = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('MainScene');
  }

  create(): void {
    this.save = loadSave();
    this.locale = this.save.language;
    this.t = createTranslator(this.locale);
    this.state = createGameState(this.save);
    this.drawScreen();
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

    this.addButton(270, 790, 310, 78, this.t('shakeButton'), () => this.handleShake(), 0xff5aa6, 0xffffff, 32);
  }

  private drawCounters(): void {
    const topStats = [
      `${this.t('level')} ${this.state.level}`,
      `${this.t('goal')}: ${this.t('targetScore')}`,
      `${this.t('score')}: ${this.state.score.toLocaleString()}`
    ];

    topStats.forEach((line, index) => {
      this.add
        .text(270, 86 + index * 30, line, {
          fontFamily: 'Arial',
          fontSize: index === 1 ? '18px' : '20px',
          color: '#3d2362',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);
    });

    this.drawPill(98, 194, `${this.t('shake')} ${this.state.shakesRemaining}/10`, 0x8f57df);
    this.drawPill(270, 194, `${this.t('energy')} ${this.state.energy}`, 0x19b68f);
    this.drawPill(442, 194, `${this.t('diamonds')} ${this.state.diamonds}`, 0x2d93e6);
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
    if (this.state.shakesRemaining <= 0) {
      this.showFloatingText(270, 724, this.t('noShakes'), '#7b2bbf');
      return;
    }

    if (this.state.energy < SHAKE_COST_ENERGY) {
      this.showFloatingText(270, 724, this.t('noEnergy'), '#7b2bbf');
      return;
    }

    this.state.shakesRemaining -= 1;
    this.state.energy -= SHAKE_COST_ENERGY;
    this.save = { ...this.save, energy: this.state.energy, diamonds: this.state.diamonds, currentLevel: this.state.level };
    saveData(this.save);

    if (this.boardContainer) {
      this.tweens.add({
        targets: this.boardContainer,
        x: { from: BOARD_X - 10, to: BOARD_X + 10 },
        y: { from: BOARD_Y - 5, to: BOARD_Y + 5 },
        duration: 55,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          this.state.board = regenerateCandies(this.state.board);
          this.drawScreen();
        }
      });
    }
  }

  private handleCellTap(position: BoardPosition): void {
    const group = findConnectedGroup(this.state.board, position);
    if (group.length < 3) {
      this.showInvalidFeedback(position);
      return;
    }

    this.highlightGroup(group);
    this.time.delayedCall(120, () => {
      const result = blastGroup(this.state.board, group);
      this.state.board = result.board;
      this.state.score += result.scoreDelta;
      this.showFloatingText(270, 244, `+${result.scoreDelta.toLocaleString()}`, '#ffffff');
      this.time.delayedCall(180, () => this.drawScreen());
    });
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

  private drawIslandScreen(): void {
    this.add.text(270, 100, this.t('island'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#643095',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    BUILDINGS.forEach((building, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 94 + col * 176;
      const y = 166 + row * 88;
      const isCompleted = index < 2;
      this.add.rectangle(x, y, 158, 74, isCompleted ? 0xffffff : 0xd9c7f2, isCompleted ? 0.72 : 0.58).setStrokeStyle(2, 0x8f57df, 0.55);
      this.add.text(x, y - 19, this.t(building.nameKey as TranslationKey), {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#3d2362',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 132 }
      }).setOrigin(0.5);
      this.add.text(x, y + 12, `${this.t('daily')}: +${building.energy} ${this.t('energy')} +${building.diamonds} ${this.t('diamonds')}`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#4d2382',
        align: 'center',
        wordWrap: { width: 138 }
      }).setOrigin(0.5);
      this.add.text(x, y + 28, isCompleted ? this.t('completed') : this.t('locked'), {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: isCompleted ? '#168e67' : '#7b6395',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    });
  }

  private drawMarketScreen(): void {
    this.add.text(270, 108, this.t('market'), {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#643095',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const items: TranslationKey[] = ['marketOneShake', 'marketFiveShakes', 'marketTenShakes', 'marketBoosters', 'marketPacks'];
    items.forEach((key, index) => {
      const y = 188 + index * 88;
      this.add.rectangle(270, y, 410, 64, 0xffffff, 0.72).setStrokeStyle(2, 0x4f9cff, 0.45);
      this.add.text(270, y, this.t(key), {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#3d2362',
        fontStyle: 'bold',
        align: 'center'
      }).setOrigin(0.5);
    });
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
  ): void {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, fill, 0.94).setStrokeStyle(3, 0xffffff, 0.72);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Arial',
      fontSize: `${fontSize}px`,
      color: `#${textColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(width, height);
    container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    container.on('pointerdown', onClick);
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
      fontSize: '26px',
      color,
      fontStyle: 'bold',
      stroke: '#7b2bbf',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 44,
      alpha: 0,
      duration: 850,
      onComplete: () => text.destroy()
    });
  }

  private positionKey(position: BoardPosition): string {
    return `${position.row}:${position.col}`;
  }
}
