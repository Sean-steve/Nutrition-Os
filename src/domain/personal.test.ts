import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, DEFAULT_TARGETS, foodAmount, mealsOnDate, observedDays, recipeAmount, safeServing, validProfile, validTargets } from './personal';
import type { FoodChoice, MealRecord } from './nutrition';

const egg: FoodChoice = { id:'egg', name:'Egg', serving:'1 egg', emoji:'🥚', energyKcal:70, proteinG:6, carbsG:1, fatG:5 };
const meal: MealRecord = {id:'m1',slot:'Breakfast',name:'Egg',details:'Sample',time:'07:30',emoji:'🥚',energyKcal:70,proteinG:6,carbsG:1,fatG:5,status:'logged'};

describe('personal nutrition preview domain',()=>{
  it('calculates portions deterministically without mutating food definitions',()=>{
    expect(foodAmount(egg,2)).toEqual({energyKcal:140,proteinG:12,carbsG:2,fatG:10});
    expect(egg.energyKcal).toBe(70);
    expect(()=>foodAmount(egg,-1)).toThrow();
    expect(safeServing(Number.NaN)).toBe(false);
  });
  it('scales recipe nutritional snapshots by portion and recipe yield',()=>{
    const recipe={id:'r1',name:'Eggs',description:'',emoji:'🍳',servings:2,prepMinutes:10,instructions:'Cook',ingredients:[{foodId:'egg',servings:4}]};
    expect(recipeAmount(recipe,[egg],1)).toEqual({energyKcal:140,proteinG:12,carbsG:2,fatG:10});
    expect(()=>recipeAmount({...recipe,ingredients:[{foodId:'missing',servings:1}]},[egg])).toThrow();
  });
  it('does not treat missing days as zero observed intake',()=>{
    const sampleDay='2026-10-31';
    expect(mealsOnDate([meal],'2026-11-01',sampleDay)).toHaveLength(0);
    expect(observedDays([meal,{...meal,id:'future',recordedOn:'2026-11-01',status:'planned'}],sampleDay)).toHaveLength(1);
  });
  it('enforces sensible preview validation rather than generating personal medical targets',()=>{
    expect(validTargets(DEFAULT_TARGETS)).toBeNull();
    expect(validTargets({...DEFAULT_TARGETS,proteinG:Infinity})).not.toBeNull();
    expect(validTargets({...DEFAULT_TARGETS,hydrationL:-2})).not.toBeNull();
    expect(validProfile({...DEFAULT_PROFILE,displayName:'Sample'})).toBeNull();
    expect(validProfile(DEFAULT_PROFILE)).not.toBeNull();
  });
});