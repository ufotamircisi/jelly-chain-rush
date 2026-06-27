import type { CandyType } from '../types';

interface CandyDefinition {
  type: CandyType;
  color: number;
  accent: number;
  label: string;
  weight: number;
}

export const CANDIES: CandyDefinition[] = [
  { type: 'greenGummy', color: 0x4bd765, accent: 0xd6ffd8, label: 'G', weight: 22 },
  { type: 'purpleJelly', color: 0x9656d9, accent: 0xeadbff, label: 'J', weight: 22 },
  { type: 'redHeart', color: 0xff5a76, accent: 0xffd3dc, label: 'H', weight: 22 },
  { type: 'yellowStar', color: 0xffd94f, accent: 0xfff5b8, label: 'S', weight: 22 },
  { type: 'blueRound', color: 0x4f9cff, accent: 0xd5e8ff, label: 'B', weight: 22 },
  { type: 'orangeBean', color: 0xff9c3f, accent: 0xffe3c4, label: 'O', weight: 22 },
  { type: 'energyStar', color: 0x7ff8ff, accent: 0xffffff, label: 'E', weight: 2 },
  { type: 'colorBomb', color: 0xff66cc, accent: 0xffe0f5, label: 'C', weight: 0 }
];

export function getCandyDefinition(type: CandyType): CandyDefinition {
  const candy = CANDIES.find((item) => item.type === type);
  if (!candy) {
    throw new Error(`Unknown candy type ${type}`);
  }
  return candy;
}

export function randomCandyType(): CandyType {
  const totalWeight = CANDIES.reduce((sum, candy) => sum + candy.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const candy of CANDIES) {
    roll -= candy.weight;
    if (roll <= 0) {
      return candy.type;
    }
  }

  return CANDIES[0].type;
}
