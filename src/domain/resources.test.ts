import {describe,expect,it} from 'vitest';
import {
  mondayOf,datesOfWeek,newWeeklyPlan,editPlan,changePlanStatus,lotBalance,appendMovement,
  generateGroceries,inventoryStock,estimateGroceries,recordedGrocerySpend,getWasteStats,transferStock,
  daysUntil,rankRecipeCandidates
} from './resources';
import type {InventoryLot,StockMovement,ShoppingLine} from './resources';
import type {RecipeRecord} from './personal';
import type {FoodChoice} from './nutrition';

const food:FoodChoice={id:'rice',name:'Rice',serving:'1 cup',emoji:'🍚',energyKcal:200,proteinG:4,carbsG:45,fatG:1};
const recipe:RecipeRecord={id:'r',name:'Rice bowl',emoji:'🍚',description:'',instructions:'',servings:2,prepMinutes:15,ingredients:[{foodId:'rice',servings:4}]};
const lot:InventoryLot={id:'l',foodId:'rice',location:'Pantry',unitPriceKes:80,acquiredOn:'2026-10-28',expiresOn:'2026-11-02'};
const purchase:StockMovement={id:'p',lotId:'l',date:'2026-10-28',deltaServings:3,kind:'PURCHASE',note:'initial'};

describe('phase 3 resource contracts',()=>{
  it('uses UTC calendar weekdays and seven exact ISO dates',()=>{
    expect(mondayOf('2026-10-31')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(datesOfWeek('2026-10-26')).toEqual(['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']);
    expect(()=>mondayOf('2026-02-30')).toThrow();
  });
  it('distinguishes draft from approved and preserves locked meals',()=>{
    const plan=newWeeklyPlan('2026-10-26');
    const entry={id:'a',date:'2026-10-31',slot:'Dinner' as const,recipeId:'r',portions:1,locked:false};
    const added=editPlan(plan,{action:'add',entry});
    expect(()=>editPlan(added,{action:'add',entry:{...entry,id:'b'}})).toThrow();
    const locked=editPlan(added,{action:'toggleLock',id:'a'});
    expect(()=>editPlan(locked,{action:'remove',id:'a'})).toThrow();
    const approved=changePlanStatus(locked,'approved');
    expect(()=>editPlan(approved,{action:'toggleLock',id:'a'})).toThrow();
    expect(changePlanStatus(approved,'draft').revision).toBeGreaterThan(approved.revision);
  });
  it('maintains nonnegative inventory via immutable ledger and controlled transfers',()=>{
    expect(lotBalance('l',[purchase])).toBe(3);
    const waste=appendMovement([lot],[purchase],{id:'w',lotId:'l',date:'2026-10-31',deltaServings:-1,kind:'WASTE',note:'spoiled'});
    expect(lotBalance('l',waste)).toBe(2);
    expect(()=>appendMovement([lot],waste,{id:'e',lotId:'l',date:'2026-10-31',deltaServings:-3,kind:'EXPIRY',note:''})).toThrow();
    expect(()=>appendMovement([lot],waste,waste[1])).toThrow();
    const transferred=transferStock([lot],waste,'l','Fridge',1,'2026-10-31','x');
    expect(inventoryStock(transferred.lots,transferred.movements).rice).toBe(2);
    expect(transferred.lots.at(-1)?.location).toBe('Fridge');
    expect(getWasteStats(transferred.lots,transferred.movements)).toEqual({servings:1,estimatedCostKes:80,events:1});
  });
  it('aggregates requirements once and deducts stock without conflating pantry and grocery expenses',()=>{
    let plan=newWeeklyPlan('2026-10-26');
    plan=editPlan(plan,{action:'add',entry:{id:'a',date:'2026-10-31',slot:'Dinner',recipeId:'r',portions:2,locked:false}});
    plan=editPlan(plan,{action:'add',entry:{id:'b',date:'2026-11-01',slot:'Lunch',recipeId:'r',portions:1,locked:false}});
    plan=changePlanStatus(plan,'approved');
    const list=generateGroceries(plan,[recipe],[lot],[purchase],{rice:80},'2026-10-31');
    expect(list.lines).toHaveLength(1);
    expect(list.lines[0].neededServings).toBe(6);
    expect(list.lines[0].stockOffsetServings).toBe(3);
    expect(list.lines[0].quantityServings).toBe(3);
    expect(estimateGroceries(list)).toBe(240);
    expect(list.sourceStockEventCount).toBe(1);
    expect(recordedGrocerySpend(list)).toBe(0);
    const purchased:ShoppingLine={...list.lines[0],purchased:true,paidKes:255};
    expect(recordedGrocerySpend({...list,lines:[purchased]})).toBe(255);
    expect(()=>generateGroceries(changePlanStatus(plan,'draft'),[recipe],[lot],[purchase],{},'2026-10-31')).toThrow();
  });
  it('does not treat an expiring lot as safe stock for meals later in the week',()=>{
    const soon={...lot,expiresOn:'2026-10-30'};
    let plan=newWeeklyPlan('2026-10-26');
    plan=editPlan(plan,{action:'add',entry:{id:'later',date:'2026-11-01',slot:'Dinner',recipeId:'r',portions:1,locked:false}});
    const list=generateGroceries(changePlanStatus(plan,'approved'),[recipe],[soon],[purchase],{rice:80},'2026-10-31');
    expect(list.lines[0].stockOffsetServings).toBe(0);
    expect(list.lines[0].quantityServings).toBe(2);
  });
  it('flags expiry relative to chosen date and orders feasible recommendations deterministically',()=>{
    expect(daysUntil('2026-11-02','2026-10-31')).toBe(2);
    expect(daysUntil('2026-10-29','2026-10-31')).toBe(-2);
    expect(rankRecipeCandidates([recipe],[food],{rice:80},{rice:5},20)).toHaveLength(1);
    expect(rankRecipeCandidates([recipe],[food],{rice:80},{},2)).toHaveLength(0);
  });
});