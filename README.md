# Jelly Chain Rush

Phase 1 playable MVP foundation for a mobile-first Phaser puzzle game.

## Setup

```bash
npm install
npm run dev
```

The dev server prints a local URL. Open it in a browser and use a narrow portrait viewport for the intended 9:16 layout.

## Build

```bash
npm run build
```

## Phase 1 Features

- TypeScript, Vite, and Phaser 3 project setup.
- 9:16 portrait Play screen.
- Level, goal, score, shake, energy, and diamonds counters.
- 7x7 board with 49 typed cells.
- Floor multiplier layer under candy icons.
- Candy layer with six common candy types and a rare Energy Star placeholder.
- SHAKE button that consumes 1 shake and 10 energy, animates the board, and regenerates candies.
- Manual tap-to-blast for 3+ matching candies connected up, down, left, or right.
- Invalid tap feedback.
- Multiplier upgrades on blasted cells.
- Falling and top-spawn refill after blasts.
- Score updates and score popup feedback.
- Helper text when no valid 3+ group remains.
- Browser/device language detection with English fallback.
- Localization structure for `en`, `tr`, `es`, `pt`, `fr`, `de`, `it`, `id`, `vi`, `nl`, and `pl`.
- localStorage save data for current level, energy, diamonds, and language.
- Placeholder Candy Island screen with 18 building cards.
- Placeholder Market screen with extra shake options.

## Still Placeholder

- Level win/fail flow.
- Continue flow.
- Daily login rewards.
- Building daily production and claiming.
- Detailed candy art.
- Full translations beyond English and Turkish.
- Mobile wrapper and native services.

## Core Rules Implemented

- Candies do not auto-blast.
- Player chooses which group to blast.
- Valid groups require 3 or more matching candies.
- Only orthogonal connections count.
- Floor multipliers stay attached to board cells.
- Candies move above floor multipliers.
