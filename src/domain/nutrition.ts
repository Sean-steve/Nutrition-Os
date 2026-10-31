/** Frontend preview-only nutrition calculations; not clinical nutrition advice. */
export type MealStatus = 'logged' | 'planned' | 'suggested';
export type MealSlot = 'Breakfast' | 'Lunch' | 'Snack' | 'Dinner';
export interface MealRecord {
  id: string;
  slot: MealSlot;
  name: string;
  details: string;
  time: string;
  emoji: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: MealStatus;
}
export interface FoodChoice {
  id: string;
  name: string;
  serving: string;
  emoji: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  priceKes: number;
  emoji: string;
  purchased: boolean;
}
export interface NutritionTotals {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedCount: number;
  hasObservations: boolean;
}
export const DAILY_EXAMPLE_TARGETS = {
  energyKcal: 2300,
  proteinG: 140,
  carbsG: 325,
  fatG: 85,
  fiberG: 30,
  hydrationL: 2.5,
} as const;

export function clampProgress(value: number, target: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, value) / target) * 100)));
}
export function calculateLoggedTotals(meals: readonly MealRecord[]): NutritionTotals {
  const logged = meals.filter((meal) => meal.status === 'logged');
  return {
    energyKcal: logged.reduce((sum, m) => sum + m.energyKcal, 0),
    proteinG: logged.reduce((sum, m) => sum + m.proteinG, 0),
    carbsG: logged.reduce((sum, m) => sum + m.carbsG, 0),
    fatG: logged.reduce((sum, m) => sum + m.fatG, 0),
    loggedCount: logged.length,
    hasObservations: logged.length > 0,
  };
}
export function remaining(value: number, target: number): number {
  return Math.max(0, Math.round((target - value) * 10) / 10);
}
export function calculateTrackingAlignment(energyPct: number, proteinPct: number, waterPct: number): number {
  return Math.round((energyPct + proteinPct + waterPct) / 3);
}
export function formatKes(value: number): string {
  return 'KES ' + Math.max(0, value).toLocaleString('en-KE');
}
