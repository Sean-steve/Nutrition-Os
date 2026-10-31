import type { FoodChoice, MealRecord } from './nutrition';

export interface NutritionProfile {
  displayName: string;
  dietStyle: 'flexible' | 'plant-focused' | 'vegetarian' | 'vegan' | 'other';
  excludedFoods: string;
  preferredMeals: number;
  units: 'metric' | 'imperial';
  onboardingComplete: boolean;
}

export interface NutritionTargets {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  hydrationL: number;
}

export interface RecipeIngredient { foodId: string; servings: number; }
export interface RecipeRecord {
  id: string;
  name: string;
  description: string;
  emoji: string;
  servings: number;
  prepMinutes: number;
  instructions: string;
  ingredients: RecipeIngredient[];
}

export const DEFAULT_PROFILE: NutritionProfile = {
  displayName: '',
  dietStyle: 'flexible',
  excludedFoods: '',
  preferredMeals: 3,
  units: 'metric',
  onboardingComplete: false,
};

export const DEFAULT_TARGETS: NutritionTargets = {
  energyKcal: 2300, proteinG: 140, carbsG: 325, fatG: 85, hydrationL: 2.5,
};

export type MacroTotals = Pick<MealRecord, 'energyKcal' | 'proteinG' | 'carbsG' | 'fatG'>;

export function validTargets(value: NutritionTargets): string | null {
  const limits: Array<[keyof NutritionTargets, number, number]> = [
    ['energyKcal', 500, 6000], ['proteinG', 1, 400], ['carbsG', 1, 1000],
    ['fatG', 1, 300], ['hydrationL', 0.2, 10],
  ];
  for (const [key, min, max] of limits) {
    if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) {
      return key + ' must be between ' + min + ' and ' + max + '.';
    }
  }
  return null;
}

export function validProfile(value: NutritionProfile): string | null {
  if (!value.displayName.trim() || value.displayName.trim().length > 60) return 'Enter a display name (1–60 characters).';
  if (!Number.isInteger(value.preferredMeals) || value.preferredMeals < 1 || value.preferredMeals > 6) return 'Choose between 1 and 6 meals.';
  if (value.excludedFoods.length > 250) return 'Dietary exclusions must be at most 250 characters.';
  return null;
}

export function safeServing(value: number): boolean {
  return Number.isFinite(value) && value >= 0.25 && value <= 10;
}

export function foodAmount(food: FoodChoice, servings: number): MacroTotals {
  if (!safeServing(servings)) throw new Error('Choose 0.25–10 servings.');
  return {
    energyKcal: Math.round(food.energyKcal * servings),
    proteinG: Math.round(food.proteinG * servings * 10) / 10,
    carbsG: Math.round(food.carbsG * servings * 10) / 10,
    fatG: Math.round(food.fatG * servings * 10) / 10,
  };
}

export function recipeAmount(recipe: RecipeRecord, library: readonly FoodChoice[], portions = 1): MacroTotals {
  if (!recipe.name.trim() || recipe.servings < 1 || recipe.servings > 30 ||
    !Number.isInteger(recipe.servings) || !safeServing(portions) || recipe.ingredients.length === 0) {
    throw new Error('Recipe name, yield, ingredients and portions must be valid.');
  }
  let energyKcal = 0, proteinG = 0, carbsG = 0, fatG = 0;
  for (const ingredient of recipe.ingredients) {
    const food = library.find(f => f.id === ingredient.foodId);
    if (!food || !safeServing(ingredient.servings)) throw new Error('Recipe ingredient not available or quantity invalid.');
    energyKcal += food.energyKcal * ingredient.servings;
    proteinG += food.proteinG * ingredient.servings;
    carbsG += food.carbsG * ingredient.servings;
    fatG += food.fatG * ingredient.servings;
  }
  const multiplier = portions / recipe.servings;
  return {
    energyKcal: Math.round(energyKcal * multiplier),
    proteinG: Math.round(proteinG * multiplier * 10) / 10,
    carbsG: Math.round(carbsG * multiplier * 10) / 10,
    fatG: Math.round(fatG * multiplier * 10) / 10,
  };
}

export function mealsOnDate(meals: readonly MealRecord[], date: string, sampleDate: string): MealRecord[] {
  return meals.filter(m => (m.recordedOn ?? sampleDate) === date);
}

export function observedDays(meals: readonly MealRecord[], sampleDate: string): Array<{ date: string; logged: number; energyKcal: number; proteinG: number }> {
  const map = new Map<string, { date: string; logged: number; energyKcal: number; proteinG: number }>();
  for (const meal of meals) {
    if (meal.status !== 'logged') continue;
    const date = meal.recordedOn ?? sampleDate;
    const row = map.get(date) ?? { date, logged: 0, energyKcal: 0, proteinG: 0 };
    row.logged += 1;
    row.energyKcal += meal.energyKcal;
    row.proteinG += meal.proteinG;
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
