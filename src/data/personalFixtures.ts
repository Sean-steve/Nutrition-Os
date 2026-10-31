/** Explicitly illustrative recipe fixtures; never user-owned or medically verified. */
import type { RecipeRecord } from '../domain/personal';
export const sampleRecipes: RecipeRecord[] = [
  {id:'example-chicken-bowl',name:'Chicken & greens bowl',description:'A simple protein-forward dinner idea',emoji:'🍗',servings:2,prepMinutes:25,instructions:'Prepare rice; cook chicken fully; steam greens and serve.',ingredients:[{foodId:'chicken',servings:2},{foodId:'rice',servings:2},{foodId:'sukuma',servings:2}]},
  {id:'example-githeri',name:'Githeri & avocado',description:'An everyday Kenyan staple bowl',emoji:'🥘',servings:2,prepMinutes:20,instructions:'Heat the githeri and add avocado before serving.',ingredients:[{foodId:'githeri',servings:2},{foodId:'avocado',servings:1}]},
];
