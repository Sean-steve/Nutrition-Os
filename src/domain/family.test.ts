import {describe,expect,it} from 'vitest';
import {addMember,changeMember,familyProjection,saveTask,setPreferenceSharing,type FamilyWorkspaceState} from './family';
import {sampleWeeklyPlan,sampleGroceriesGenerated,sampleInventoryLots,sampleStockMovements} from '../data/resourceFixtures';
const base:FamilyWorkspaceState={members:[
  {id:'self',alias:'Household owner',role:'owner',active:true},
  {id:'member-a',alias:'Member A',role:'editor',active:true},
  {id:'member-b',alias:'Member B',role:'viewer',active:true}],tasks:[],shareMyPreferences:false};
describe('household shared information only',()=>{
 it('projects only shared data; no private nutrition observations or names',()=>{
  const p=familyProjection(base,[sampleWeeklyPlan],sampleGroceriesGenerated,sampleInventoryLots,sampleStockMovements,'member-b');
  expect(p.memberNutritionVisibility).toBe('none');
  expect(JSON.stringify(p)).not.toMatch(/proteinG|calorie|dietStyle|excludedFoods|medical|health|personalMeal/);
  expect(p.plannedMealCount).toBeGreaterThan(0);
  expect(()=>familyProjection(base,[sampleWeeklyPlan],sampleGroceriesGenerated,sampleInventoryLots,sampleStockMovements,'outsider')).toThrow();
 });
 it('allows owners to invite a viewer but cannot promote another owner or remove owner',()=>{
  const next=addMember(base,'self',{id:'member-c',alias:'New member',role:'viewer',active:true});
  expect(next.members.length).toBe(4);
  expect(()=>addMember(base,'member-b',{id:'x',alias:'X',role:'viewer',active:true})).toThrow();
  expect(()=>addMember(base,'self',{id:'x',alias:'X',role:'owner',active:true})).toThrow();
  expect(()=>changeMember(base,'self','self',{active:false})).toThrow();
 });
 it('restricts kitchen task mutations and validates approved meals',()=>{
  const t={id:'task-1',planEntryId:'plan-meal-1',memberId:'member-b',status:'planned' as const,note:'Cook sample dinner'};
  expect(()=>saveTask(base,'member-b',t,[sampleWeeklyPlan])).toThrow();
  expect(saveTask(base,'member-a',t,[sampleWeeklyPlan]).tasks).toHaveLength(1);
  expect(()=>saveTask(base,'member-a',{...t,planEntryId:'absent'},[sampleWeeklyPlan])).toThrow();
  expect(()=>saveTask(base,'member-a',t,[{...sampleWeeklyPlan,status:'draft'}])).toThrow();
 });
 it('preference-sharing consent is off until explicitly enabled and never exposes preferences',()=>{
  expect(base.shareMyPreferences).toBe(false);
  expect(()=>setPreferenceSharing(base,'member-a',true)).toThrow();
  const next=setPreferenceSharing(base,'self',true);
  expect(next.shareMyPreferences).toBe(true);
  const projection=familyProjection(next,[sampleWeeklyPlan],sampleGroceriesGenerated,sampleInventoryLots,sampleStockMovements,'member-a');
  expect(JSON.stringify(projection)).not.toMatch(/shareMyPreferences|personal/);
 });
});
