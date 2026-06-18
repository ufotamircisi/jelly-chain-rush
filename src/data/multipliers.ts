export const MULTIPLIER_VALUES = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000] as const;

export function getMultiplierLabel(index: number): string {
  const value = MULTIPLIER_VALUES[index] ?? 0;
  return value > 0 ? `x${value}` : '';
}

export function getMultiplierScoreFactor(index: number): number {
  const value = MULTIPLIER_VALUES[index] ?? 0;
  return value > 0 ? value : 1;
}

export function upgradeMultiplier(index: number): number {
  return Math.min(index + 1, MULTIPLIER_VALUES.length - 1);
}
