import {describe,expect,it} from 'vitest';
import {answerGuided,classifyIntent,deriveInsights,eligibleStock,previewCandidates,type DecisionContext} from './intelligence';
import {sampleMeals,sampleFoodChoices,SAMPLE_DATE} from '../data/sample';
import {sampleRecipes} from '../data/personalFixtures';
import {DEFAULT_PROFILE,DEFAULT_TARGETS} from './personal';
import {sampleInventoryLots,sampleStockMovements,sampleGroceriesGenerated,sampleWeeklyPlan,sampleFoodBudgetKes,sampleUnitPricesKes} from '../data/resourceFixtures';
const ctx:DecisionContext={asOf:SAMPLE_DATE,meals:sampleMeals,profile:DEFAULT_PROFILE,targets:DEFAULT_TARGETS,
  recipes:sampleRecipes,foods:sampleFoodChoices,plans:[sampleWeeklyPlan],
  lots:sampleInventoryLots,movements:sampleStockMovements,groceries:sampleGroceriesGenerated,
  budgetKes:sampleFoodBudgetKes,prices:sampleUnitPricesKes};
describe('nutrition intelligence preview',()=>{
 it('uses recorded intake only and cites evidence',()=>{
  const ins=deriveInsights(ctx);
  expect(ins.find(x=>x.id==='logged-intake')?.evidence.length).toBeGreaterThan(0);
  expect(ins.find(x=>x.id==='limited-history')).toBeDefined();
  expect(ins.find(x=>x.id==='observed-trend')).toBeUndefined();
 });
 it('never translates missing logs into deficiency',()=>{
  const none={...ctx,asOf:'2026-11-04'};
  expect(deriveInsights(none).find(x=>x.id==='intake-not-observed')).toBeDefined();
  expect(answerGuided(none,'How much protein did I eat?').message).toMatch(/no basis to conclude intake was zero/i);
 });
 it('suppresses meal suggestions when an exclusion is present',()=>{
  const exclusions={...ctx,profile:{...ctx.profile,excludedFoods:'peanuts'}};
  expect(previewCandidates(exclusions)).toHaveLength(0);
  expect(answerGuided(exclusions,'suggest dinner').message).toMatch(/not suggest/i);
  expect(previewCandidates({...ctx,profile:{...ctx.profile,dietStyle:'vegan'}})).toHaveLength(0);
 });
 it('filters expired stock from availability explanations',()=>{
  const x={...ctx,asOf:'2026-11-10'};
  expect(eligibleStock(x).sukuma).toBeUndefined();
  expect(eligibleStock(x).rice).toBeGreaterThan(0);
 });
 it('ranks reproducible, source-tagged options only',()=>{
  const options=previewCandidates(ctx);
  expect(options.length).toBeGreaterThan(0);
  expect(options[0].evidence.some(e=>e.kind==='estimate')).toBe(true);
  expect(options.every(o=>o.confidence==='limited')).toBe(true);
 });
 it('blocks sensitive requests before other intent routing',()=>{
  for(const question of ['nutrition for newborn','pregnancy protein target','I have diabetes and need calories','severe peanut allergy','toddler food']) {
    expect(classifyIntent(question)).toBe('safety');
    expect(answerGuided(ctx,question).guardrail).toBe('sensitive');
  }
 });
 it('enforces family scope even for requests about personal logs',()=>{
  expect(answerGuided(ctx,'protein target','household').message).toMatch(/not another person/i);
  expect(answerGuided(ctx,'family groceries','household').guardrail).toBe('limited');
 });
 it('never writes state and gives no auto-action permissions',()=>{
  const before=JSON.stringify(ctx);
  answerGuided(ctx,'Can you plan dinner?');deriveInsights(ctx);previewCandidates(ctx);
  expect(JSON.stringify(ctx)).toBe(before);
 });
});
