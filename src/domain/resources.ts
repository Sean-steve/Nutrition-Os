/**
 * Phase 3 browser-only planning & resource domain.
 * Values are illustrative and never clinical, authoritative, or persisted.
 * Planned foods are never observed consumption; stock is exclusively ledger-derived.
 */
import type { FoodChoice, MealSlot } from './nutrition';
import type { RecipeRecord } from './personal';
import { recipeAmount, safeServing } from './personal';

export type PlanStatus = 'draft' | 'approved';
export interface PlannedMeal {
  id: string; date: string; slot: MealSlot; recipeId: string; portions: number; locked: boolean;
}
export interface WeeklyPlan {
  id: string; weekStart: string; status: PlanStatus; revision: number; entries: PlannedMeal[];
}
export type StorageLocation = 'Pantry' | 'Fridge' | 'Freezer';
export interface InventoryLot {
  id: string; foodId: string; location: StorageLocation; acquiredOn: string;
  expiresOn: string | null; unitPriceKes: number;
}
export type StockKind = 'PURCHASE'|'CONSUMPTION'|'WASTE'|'EXPIRY'|'ADJUSTMENT'|'TRANSFER_IN'|'TRANSFER_OUT';
export interface StockMovement {
  id: string; lotId: string; date: string; kind: StockKind; deltaServings: number; note: string;
}
export interface ShoppingLine {
  id: string; foodId: string; quantityServings: number; unitPriceKes: number;
  purchased: boolean; paidKes: number | null; received: boolean;
  source: 'plan' | 'manual'; neededServings: number; stockOffsetServings: number;
}
export interface GroceryList {
  id: string; sourcePlanId: string | null; sourceRevision: number | null;
  sourceStockEventCount:number|null; // detect pantry changes after requirement generation
  createdOn: string; lines: ShoppingLine[];
}
export interface PlanTotals { energyKcal: number; proteinG: number; estimatedCostKes: number; meals: number; }
export interface WasteStats { servings: number; estimatedCostKes: number; events: number; }
export const LOCATIONS: StorageLocation[] = ['Pantry','Fridge','Freezer'];
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function isoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value;
}
export function shiftDate(iso: string, days: number): string {
  if (!isoDate(iso) || !Number.isInteger(days)) throw new Error('Invalid calendar date.');
  const date = new Date(iso + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}
export function mondayOf(iso: string): string {
  if (!isoDate(iso)) throw new Error('Invalid calendar date.');
  const weekday = new Date(iso+'T12:00:00Z').getUTCDay();
  return shiftDate(iso, -(weekday + 6) % 7);
}
export function datesOfWeek(monday: string): string[] {
  if (mondayOf(monday) !== monday) throw new Error('Week must begin Monday.');
  return Array.from({length:7},(_,i)=>shiftDate(monday,i));
}
export function newWeeklyPlan(weekStart: string): WeeklyPlan {
  if (mondayOf(weekStart) !== weekStart) throw new Error('Plan must start on Monday.');
  return {id:'plan-'+weekStart,weekStart,status:'draft',revision:0,entries:[]};
}
export function editPlan(plan: WeeklyPlan, change: { action:'add'; entry:PlannedMeal } | {action:'remove'; id:string} | {action:'update'; entry:PlannedMeal} | {action:'toggleLock'; id:string}): WeeklyPlan {
  if (plan.status !== 'draft') throw new Error('Reopen the approved plan to edit it.');
  let entries = [...plan.entries];
  if (change.action==='add'||change.action==='update') {
    const e=change.entry;
    if (!datesOfWeek(plan.weekStart).includes(e.date) || !safeServing(e.portions) || !e.recipeId || !e.id) throw new Error('Invalid planned meal date, recipe, or servings.');
    if (change.action==='update') {
      const existing=entries.find(item=>item.id===e.id);
      if (!existing) throw new Error('Planned meal not found.');
      if (existing.locked) throw new Error('Unlock the meal before changing it.');
      entries=entries.filter(item=>item.id!==e.id);
    }
    if (entries.some(item=>item.id===e.id || (item.date===e.date && item.slot===e.slot))) throw new Error('This day already has a meal in that slot.');
    entries.push({...e,locked:change.action==='add' ? false : e.locked});
  } else {
    const current=entries.find(item=>item.id===change.id);
    if(!current) throw new Error('Planned meal not found.');
    if(change.action==='remove'){
      if(current.locked) throw new Error('Unlock the meal before removing it.');
      entries=entries.filter(item=>item.id!==change.id);
    } else entries=entries.map(item=>item.id===change.id?{...item,locked:!item.locked}:item);
  }
  return {...plan,revision:plan.revision+1,entries};
}
export function changePlanStatus(plan: WeeklyPlan, status: PlanStatus): WeeklyPlan {
  if (status==='approved' && plan.entries.length===0) throw new Error('Add at least one planned meal before approval.');
  if (status===plan.status) return plan;
  return {...plan,status,revision:plan.revision+1};
}
export function estimatedRecipeCost(recipe: RecipeRecord, prices: Record<string,number>): number {
  return round3(recipe.ingredients.reduce((total,i)=>total+(prices[i.foodId]??0)*i.servings,0) / recipe.servings);
}
export function summarizePlan(plan:WeeklyPlan,recipes:readonly RecipeRecord[],foods:readonly FoodChoice[],prices:Record<string,number>): PlanTotals {
  const result:PlanTotals={energyKcal:0,proteinG:0,estimatedCostKes:0,meals:plan.entries.length};
  for(const entry of plan.entries){
    const recipe=recipes.find(r=>r.id===entry.recipeId);
    if(!recipe) throw new Error('Planned recipe is not available.');
    const macros=recipeAmount(recipe,foods,entry.portions);
    result.energyKcal+=macros.energyKcal;
    result.proteinG+=macros.proteinG;
    result.estimatedCostKes+=estimatedRecipeCost(recipe,prices)*entry.portions;
  }
  return {...result,proteinG:round3(result.proteinG),estimatedCostKes:Math.round(result.estimatedCostKes)};
}
export function lotBalance(lotId:string,movements:readonly StockMovement[]):number{
  return round3(movements.filter(m=>m.lotId===lotId).reduce((sum,m)=>sum+m.deltaServings,0));
}
export function inventoryStock(lots:readonly InventoryLot[],movements:readonly StockMovement[]):Record<string,number> {
  const result:Record<string,number>={};
  for(const lot of lots) result[lot.foodId]=round3((result[lot.foodId]??0)+Math.max(0,lotBalance(lot.id,movements)));
  return result;
}
export function appendMovement(lots:readonly InventoryLot[],movements:readonly StockMovement[],movement:StockMovement):StockMovement[]{
  if(!lots.some(l=>l.id===movement.lotId)) throw new Error('Inventory lot does not exist.');
  if(movements.some(m=>m.id===movement.id)) throw new Error('Movement already recorded.');
  if(!isoDate(movement.date) || !Number.isFinite(movement.deltaServings) || Math.abs(movement.deltaServings)>1000 || Math.abs(movement.deltaServings)<0.001) throw new Error('Invalid inventory movement.');
  if(['PURCHASE','TRANSFER_IN'].includes(movement.kind) && movement.deltaServings<=0) throw new Error('Incoming stock must increase inventory.');
  if(['CONSUMPTION','WASTE','EXPIRY','TRANSFER_OUT'].includes(movement.kind) && movement.deltaServings>=0) throw new Error('Outgoing stock must reduce inventory.');
  if(lotBalance(movement.lotId,movements)+movement.deltaServings < -0.00001) throw new Error('Insufficient stock for this operation.');
  return [...movements,movement];
}
export function transferStock(lots:readonly InventoryLot[],movements:readonly StockMovement[],sourceId:string,destination:StorageLocation,quantity:number,date:string,id:string):{lots:InventoryLot[];movements:StockMovement[]} {
  const source=lots.find(l=>l.id===sourceId);
  if(!source||source.location===destination||!Number.isFinite(quantity)||quantity<=0||quantity>1000) throw new Error('Choose a different location and a valid quantity.');
  const dest:InventoryLot={...source,id:'lot-transfer-'+id,location:destination,acquiredOn:date};
  const newLots=[...lots,dest];
  let ledger=appendMovement(newLots,movements,{id:'out-'+id,lotId:source.id,date,kind:'TRANSFER_OUT',deltaServings:-quantity,note:'Transfer to '+destination});
  ledger=appendMovement(newLots,ledger,{id:'in-'+id,lotId:dest.id,date,kind:'TRANSFER_IN',deltaServings:quantity,note:'Transfer from '+source.location});
  return {lots:newLots,movements:ledger};
}
export function generateGroceries(plan:WeeklyPlan,recipes:readonly RecipeRecord[],lots:readonly InventoryLot[],movements:readonly StockMovement[],prices:Record<string,number>,createdOn:string):GroceryList {
  if(plan.status!=='approved') throw new Error('Approve the plan before generating groceries.');
  const needed:Record<string,number>={};
  for(const entry of plan.entries){
    const recipe=recipes.find(r=>r.id===entry.recipeId);
    if(!recipe) throw new Error('A planned recipe no longer exists.');
    for(const ing of recipe.ingredients){
      if(!safeServing(ing.servings)) throw new Error('Invalid planned ingredient quantity.');
      needed[ing.foodId]=round3((needed[ing.foodId]??0)+ing.servings*entry.portions/recipe.servings);
    }
  }
  // Conservatively do not subtract lots expiring before all planned meals are served.
  // A physical balance is not proof of food-safety suitability for a future meal.
  const lastMealDate=plan.entries.reduce((max,e)=>e.date>max?e.date:max,plan.weekStart);
  const stock:Record<string,number>={};
  for(const lot of lots){
    if(lot.expiresOn&&lot.expiresOn<lastMealDate)continue;
    stock[lot.foodId]=round3((stock[lot.foodId]??0)+Math.max(0,lotBalance(lot.id,movements)));
  }
  const lines:ShoppingLine[]=Object.entries(needed).map(([foodId,qty])=>{
    const offset=Math.min(qty,stock[foodId]??0);
    return {id:'need-'+foodId,foodId,quantityServings:round3(Math.max(0,qty-offset)),unitPriceKes:prices[foodId]??0,
      purchased:false,paidKes:null,received:false,source:'plan' as const,neededServings:qty,stockOffsetServings:offset};
  }).filter(line=>line.quantityServings>0.001).sort((a,b)=>a.foodId.localeCompare(b.foodId));
  return {id:'grocery-'+plan.id+'-rev'+plan.revision,sourcePlanId:plan.id,sourceRevision:plan.revision,sourceStockEventCount:movements.length,createdOn,lines};
}
export function estimateGroceries(list:GroceryList):number{
  return Math.round(list.lines.reduce((s,l)=>s+l.quantityServings*l.unitPriceKes,0));
}
export function recordedGrocerySpend(list:GroceryList):number{
  return Math.round(list.lines.reduce((s,l)=>s+(l.purchased?l.paidKes??0:0),0));
}
export function validateShoppingLine(line:ShoppingLine):boolean{
  return Boolean(line.id&&line.foodId&&Number.isFinite(line.quantityServings)&&line.quantityServings>0&&line.quantityServings<=1000&&
   Number.isFinite(line.unitPriceKes)&&line.unitPriceKes>=0&&line.unitPriceKes<=100000&&
   (line.paidKes===null||(Number.isFinite(line.paidKes)&&line.paidKes>=0&&line.paidKes<=1000000)));
}
export function getWasteStats(lots:readonly InventoryLot[],movements:readonly StockMovement[]):WasteStats {
  const costs=new Map(lots.map(l=>[l.id,l.unitPriceKes]));
  const waste=movements.filter(m=>m.kind==='WASTE'||m.kind==='EXPIRY');
  return {servings:round3(waste.reduce((s,m)=>s-m.deltaServings,0)),
    estimatedCostKes:Math.round(waste.reduce((s,m)=>s-m.deltaServings*(costs.get(m.lotId)??0),0)),events:waste.length};
}
export function daysUntil(iso:string,reference:string):number{
  if(!isoDate(iso)||!isoDate(reference)) throw new Error('Invalid expiry date.');
  const a=Date.parse(iso+'T12:00:00Z'),b=Date.parse(reference+'T12:00:00Z');
  return Math.round((a-b)/86400000);
}
export function rankRecipeCandidates(recipes:readonly RecipeRecord[],foods:readonly FoodChoice[],prices:Record<string,number>,stock:Record<string,number>,maxPrepMinutes:number):Array<{recipe:RecipeRecord;proteinG:number;estimatedCostKes:number;stockCoverage:number;score:number}> {
  if(!Number.isFinite(maxPrepMinutes)||maxPrepMinutes<0) return [];
  return recipes.filter(r=>r.prepMinutes<=maxPrepMinutes).map(recipe=>{
    const macro=recipeAmount(recipe,foods);
    const cost=estimatedRecipeCost(recipe,prices);
    const ingredients=recipe.ingredients;
    const coverage=ingredients.length?ingredients.filter(i=>(stock[i.foodId]??0)>=i.servings/recipe.servings).length/ingredients.length:0;
    const score=macro.proteinG*2 + coverage*25 - cost/30 - recipe.prepMinutes/5;
    return {recipe,proteinG:macro.proteinG,estimatedCostKes:Math.round(cost),stockCoverage:Math.round(coverage*100),score};
  }).sort((a,b)=>b.score-a.score);
}
