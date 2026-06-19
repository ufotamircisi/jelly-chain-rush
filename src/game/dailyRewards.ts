export interface DailyReward {
  day: number;
  energy: number;
  diamonds: number;
  chest: boolean;
}

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, energy: 20, diamonds: 10, chest: false },
  { day: 2, energy: 30, diamonds: 15, chest: false },
  { day: 3, energy: 40, diamonds: 20, chest: false },
  { day: 4, energy: 50, diamonds: 25, chest: false },
  { day: 5, energy: 60, diamonds: 30, chest: false },
  { day: 6, energy: 80, diamonds: 40, chest: false },
  { day: 7, energy: 100, diamonds: 50, chest: true }
];

export function getDailyReward(streak: number): DailyReward {
  const index = Math.max(0, (streak - 1) % DAILY_REWARDS.length);
  return DAILY_REWARDS[index];
}
