/**
 * SAMPLE FIXTURES — no values here belong to a real person or family.
 * These demo-only records are never transmitted or stored.
 */
import type { FoodChoice, GroceryItem, MealRecord } from '../domain/nutrition';

export const SAMPLE_DATE = '2026-10-31';

export const sampleMeals: MealRecord[] = [
  { id: 'm-breakfast', slot: 'Breakfast', name: 'Eggs & avocado toast', details: '2 eggs, wholegrain bread, avocado', time: '07:30', emoji: '🍳', energyKcal: 620, proteinG: 24, carbsG: 58, fatG: 31, status: 'logged' },
  { id: 'm-lunch', slot: 'Lunch', name: 'Grilled chicken bowl', details: 'Chicken, rice & vegetables', time: '12:45', emoji: '🍗', energyKcal: 720, proteinG: 42, carbsG: 96, fatG: 19, status: 'logged' },
  { id: 'm-snack', slot: 'Snack', name: 'Yoghurt, banana & nuts', details: 'Sample afternoon snack', time: '15:30', emoji: '🥣', energyKcal: 500, proteinG: 16, carbsG: 59, fatG: 22, status: 'logged' },
  { id: 'm-dinner', slot: 'Dinner', name: 'Chicken + rice + greens', details: 'Planned · not yet logged', time: '19:00', emoji: '🥗', energyKcal: 440, proteinG: 38, carbsG: 41, fatG: 13, status: 'planned' },
];

export const sampleFoodChoices: FoodChoice[] = [
  { id: 'eggs', name: '2 boiled eggs', serving: '2 eggs', emoji: '🥚', energyKcal: 156, proteinG: 13, carbsG: 1, fatG: 11 },
  { id: 'banana', name: 'Banana', serving: '1 medium', emoji: '🍌', energyKcal: 105, proteinG: 1, carbsG: 27, fatG: 0 },
  { id: 'yoghurt', name: 'Plain yoghurt', serving: '1 cup', emoji: '🥛', energyKcal: 150, proteinG: 9, carbsG: 12, fatG: 8 },
  { id: 'ugali', name: 'Ugali & sukuma wiki', serving: '1 plate', emoji: '🥬', energyKcal: 340, proteinG: 9, carbsG: 62, fatG: 7 },
  { id: 'beans', name: 'Beans & avocado', serving: '1 bowl', emoji: '🫘', energyKcal: 420, proteinG: 18, carbsG: 51, fatG: 16 },
];

export const sampleRecommendations = [
  { id: 'chicken', title: 'Chicken + rice + greens', emoji: '🍗', energyKcal: 440, proteinG: 38, minutes: 20, tags: ['Higher protein', 'Easy prep'] },
  { id: 'eggs', title: 'Eggs + sukuma wiki + ugali', emoji: '🍳', energyKcal: 480, proteinG: 29, minutes: 15, tags: ['Local favourite', 'Budget-friendly'] },
  { id: 'beans', title: 'Beans & avocado bowl', emoji: '🥑', energyKcal: 460, proteinG: 24, minutes: 15, tags: ['Plant-based', 'High fibre'] },
  { id: 'tilapia', title: 'Tilapia & vegetable plate', emoji: '🐟', energyKcal: 510, proteinG: 45, minutes: 25, tags: ['Protein-rich', 'Balanced'] },
] as const;

export const sampleGroceries: GroceryItem[] = [
  { id: 'chicken', name: 'Chicken', quantity: '2 kg', priceKes: 2200, emoji: '🍗', purchased: false },
  { id: 'eggs', name: 'Eggs', quantity: '30 pcs', priceKes: 450, emoji: '🥚', purchased: true },
  { id: 'spinach', name: 'Sukuma wiki & spinach', quantity: '4 bunches', priceKes: 240, emoji: '🥬', purchased: false },
  { id: 'rice', name: 'Rice', quantity: '2 kg', priceKes: 480, emoji: '🍚', purchased: false },
  { id: 'tomatoes', name: 'Tomatoes & onions', quantity: '1 kg each', priceKes: 340, emoji: '🍅', purchased: false },
  { id: 'milk', name: 'Milk & yoghurt', quantity: 'Assorted', priceKes: 1140, emoji: '🥛', purchased: false },
];

export const sampleWeeklyProgress = [
  { label: 'Mon', pct: 86 }, { label: 'Tue', pct: 75 }, { label: 'Wed', pct: 92 },
  { label: 'Thu', pct: 79 }, { label: 'Fri', pct: 71 }, { label: 'Sat', pct: 82 }, { label: 'Sun', pct: null },
];

export const sampleRoadmap: Record<string, { phase: string; description: string; highlights: string[] }> = {
  today: { phase: 'Phase 2', description: 'The complete daily nutrition timeline and meal capture workflow.', highlights: ['Meal logging & editing', 'Water tracking', 'Photo / voice capture interfaces'] },
  meals: { phase: 'Phase 2', description: 'A searchable meal history with recipes and portion-aware nutrition calculations.', highlights: ['Meal detail & history', 'Food catalogue', 'Reusable recipes'] },
  planner: { phase: 'Phase 3', description: 'Adaptive daily and weekly nutrition planning.', highlights: ['Weekly meal grid', 'Plan approval & swaps', 'Goal and budget optimisation'] },
  foods: { phase: 'Phase 2', description: 'Food knowledge, serving conversion and local Kenyan ingredients.', highlights: ['Searchable food database', 'Recipes', 'Nutrition provenance'] },
  groceries: { phase: 'Phase 3', description: 'A budget-aware shopping workflow linked to meal plans.', highlights: ['Consolidated lists', 'KES budget constraints', 'Shopping history'] },
  inventory: { phase: 'Phase 3', description: 'Manage pantry, fridge and food expiry intelligently.', highlights: ['Stock ledger', 'Expiry alerts', 'Waste tracking'] },
  goals: { phase: 'Phase 2', description: 'Nutrition requirements and goal progress.', highlights: ['Time-bound goals', 'Nutrient targets', 'Goal history'] },
  insights: { phase: 'Phase 4', description: 'Explainable nutrition trends and recommendations.', highlights: ['Pattern detection', 'Recommendation evidence', 'Confidence and uncertainty'] },
  progress: { phase: 'Phase 2', description: 'Daily, weekly and monthly nutrition progress.', highlights: ['Nutrient trends', 'Consistency', 'Personal reviews'] },
  family: { phase: 'Phase 4', description: 'Household nutrition without leaking private member health data.', highlights: ['Shared meal plan', 'Shared groceries', 'Household cost & inventory'] },
  assistant: { phase: 'Phase 4', description: 'Policy-controlled conversational nutrition assistant.', highlights: ['Explainable responses', 'Permission-bound tools', 'Safety checks'] },
  integrations: { phase: 'Phase 7', description: 'Authorized communication with Personal Kernel engines.', highlights: ['Kernel identity', 'Finance/Fitness/Calendar signals', 'Consent-led contracts'] },
  privacy: { phase: 'Phase 7', description: 'User data sovereignty and consent controls.', highlights: ['Permission center', 'Data export & erasure', 'Audit trail'] },
  settings: { phase: 'Phase 2+', description: 'Product settings and accessibility preferences.', highlights: ['Units & preferences', 'Notification controls', 'Profile configuration'] },
};
