/** Stock ledger, grocery planning, purchase confirmation and food-budget services. */
import type {z} from 'zod';
import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {recordChange} from '../events.js';
import {budgetInput,groceryPrices,lotInput,moveInput,receiveInput,round3} from '../domain.js';
import {notFound,ownedFood} from './foods.js';
const own=(a:Actor)=>[a.tenantId,a.userId];
const numeric=(x:unknown)=>Number(x);
export async function getInventory(db:SqlClient,a:Actor){
  const r=await db.query('SELECT l.*,COALESCE(SUM(m.delta_servings),0) AS balance FROM nutrition.inventory_lot l LEFT JOIN nutrition.inventory_movement m ON m.lot_id=l.id AND m.tenant_id=l.tenant_id AND m.user_id=l.user_id WHERE l.tenant_id=$1 AND l.user_id=$2 GROUP BY l.id ORDER BY l.created_at DESC LIMIT 200',
    own(a));
  return r.rows;
}
export async function createLot(db:SqlClient,a:Actor,v:z.infer<typeof lotInput>,corr:string){
  await ownedFood(db,a,v.foodId);
  const lot=(await db.query('INSERT INTO nutrition.inventory_lot(tenant_id,user_id,food_id,location,acquired_on,expires_on,unit_cost_kes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [...own(a),v.foodId,v.location,v.acquiredOn,v.expiresOn,v.unitCostKes])).rows[0];
  await db.query('INSERT INTO nutrition.inventory_movement(tenant_id,user_id,lot_id,happened_on,kind,delta_servings,note) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [...own(a),lot.id,v.acquiredOn,'PURCHASE',v.initialServings,'Explicit opening stock']);
  await recordChange(db,a,{type:'nutrition.inventory.lot_created',aggregate:'inventory_lot',id:lot.id,action:'inventory.lot_created',correlationId:corr});
  return {...lot,balance:v.initialServings};
}
async function lockLot(db:SqlClient,a:Actor,id:string){
  const row=(await db.query('SELECT * FROM nutrition.inventory_lot WHERE tenant_id=$1 AND user_id=$2 AND id=$3 FOR UPDATE',[...own(a),id])).rows[0];
  if(!row)throw notFound('Inventory lot');return row;
}
export async function moveStock(db:SqlClient,a:Actor,v:z.infer<typeof moveInput>,corr:string){
  const lot=await lockLot(db,a,v.lotId);
  if(v.kind==='EXPIRY'){
    if(!lot.expires_on || new Date(lot.expires_on).toISOString().slice(0,10)>v.happenedOn)
      throw new ApiError(422,'NOT_YET_EXPIRED','Use WASTE for early disposal; expiry event requires reached expiry date.');
  }
  const row=(await db.query('INSERT INTO nutrition.inventory_movement(tenant_id,user_id,lot_id,happened_on,kind,delta_servings,note) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [...own(a),v.lotId,v.happenedOn,v.kind,v.deltaServings,v.note])).rows[0];
  await recordChange(db,a,{type:'nutrition.inventory.movement_recorded',aggregate:'inventory_lot',id:v.lotId,action:'inventory.movement_recorded',correlationId:corr,
    metadata:{kind:v.kind}});
  return row;
}
export async function transferStock(db:SqlClient,a:Actor,sourceId:string,destination:'Pantry'|'Fridge'|'Freezer',servings:number,happenedOn:string,corr:string){
  const source=await lockLot(db,a,sourceId);
  if(source.location===destination)throw new ApiError(422,'SAME_LOCATION','Choose a different storage location.');
  const dest=(await db.query('INSERT INTO nutrition.inventory_lot(tenant_id,user_id,food_id,location,acquired_on,expires_on,unit_cost_kes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [...own(a),source.food_id,destination,happenedOn,source.expires_on,source.unit_cost_kes])).rows[0];
  await db.query('INSERT INTO nutrition.inventory_movement(tenant_id,user_id,lot_id,happened_on,kind,delta_servings,note) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [...own(a),sourceId,happenedOn,'TRANSFER_OUT',-servings,'Moved to '+destination]);
  await db.query('INSERT INTO nutrition.inventory_movement(tenant_id,user_id,lot_id,happened_on,kind,delta_servings,note) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [...own(a),dest.id,happenedOn,'TRANSFER_IN',servings,'Moved from '+source.location]);
  await recordChange(db,a,{type:'nutrition.inventory.transferred',aggregate:'inventory_lot',id:sourceId,action:'inventory.transferred',correlationId:corr,
    metadata:{to:destination,newLotId:dest.id}});
  return {sourceLotId:sourceId,destinationLotId:dest.id,servings};
}
export async function getBudget(db:SqlClient,a:Actor){
  const row=(await db.query('SELECT * FROM nutrition.food_budget WHERE tenant_id=$1 AND user_id=$2',own(a))).rows[0]??null;
  const spend=(await db.query('SELECT COALESCE(SUM(actual_paid_kes),0) AS amount FROM nutrition.grocery_line WHERE tenant_id=$1 AND user_id=$2 AND purchased=true AND actual_paid_kes IS NOT NULL',own(a))).rows[0];
  return {allocation:row,explicitRecordedPaidKes:numeric(spend.amount),source:'manually_entered_nutrition_example_not_finance_os'};
}
export async function putBudget(db:SqlClient,a:Actor,v:z.infer<typeof budgetInput>,corr:string){
  const row=(await db.query('INSERT INTO nutrition.food_budget(tenant_id,user_id,amount_kes) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id) DO UPDATE SET amount_kes=EXCLUDED.amount_kes,updated_at=now() RETURNING *',
    [...own(a),v.amountKes])).rows[0];
  await recordChange(db,a,{type:'nutrition.budget.updated',aggregate:'food_budget',id:a.userId,action:'budget.updated',correlationId:corr});
  return row;
}
export async function getGroceries(db:SqlClient,a:Actor){
  const lists=(await db.query('SELECT * FROM nutrition.grocery_list WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC,id DESC LIMIT 30',own(a))).rows;
  const lines=(await db.query('SELECT * FROM nutrition.grocery_line WHERE tenant_id=$1 AND user_id=$2 AND list_id=ANY($3::uuid[]) ORDER BY id',
    [...own(a),lists.map(l=>l.id)])).rows;
  return lists.map(l=>({...l,lines:lines.filter(line=>line.list_id===l.id)}));
}
async function lockGroceryLine(db:SqlClient,a:Actor,id:string){
  const row=(await db.query('SELECT * FROM nutrition.grocery_line WHERE tenant_id=$1 AND user_id=$2 AND id=$3 FOR UPDATE',[...own(a),id])).rows[0];
  if(!row)throw notFound('Grocery line');return row;
}
export async function generateGroceries(db:SqlClient,a:Actor,v:z.infer<typeof groceryPrices>,corr:string){
  const plan=(await db.query('SELECT * FROM nutrition.meal_plan WHERE tenant_id=$1 AND user_id=$2 AND id=$3 FOR UPDATE',
    [...own(a),v.planId])).rows[0];
  if(!plan)throw notFound('Meal plan');
  if(plan.status!=='approved')throw new ApiError(409,'PLAN_NOT_APPROVED','Only approved plans generate shopping needs.');
  const pending=(await db.query('SELECT 1 FROM nutrition.grocery_line WHERE tenant_id=$1 AND user_id=$2 AND purchased=true AND received=false LIMIT 1',own(a))).rows;
  if(pending.length)throw new ApiError(409,'PENDING_RECEIPTS','Receive or uncheck pending groceries before regeneration.');
  const entries=(await db.query('SELECT pm.planned_on,pm.portions,r.yield_servings,ri.food_id,ri.servings AS ingredient_servings FROM nutrition.planned_meal pm JOIN nutrition.recipe r ON r.id=pm.recipe_id AND r.tenant_id=pm.tenant_id AND r.user_id=pm.user_id JOIN nutrition.recipe_ingredient ri ON ri.recipe_id=r.id AND ri.tenant_id=r.tenant_id AND ri.user_id=r.user_id WHERE pm.tenant_id=$1 AND pm.user_id=$2 AND pm.plan_id=$3',
    [...own(a),v.planId])).rows;
  const needed=new Map<string,number>();
  let latest='';
  for(const row of entries){
    const date=new Date(row.planned_on).toISOString().slice(0,10);
    if(date>latest)latest=date;
    const quantity=round3(numeric(row.ingredient_servings)*numeric(row.portions)/numeric(row.yield_servings));
    needed.set(row.food_id,round3((needed.get(row.food_id)??0)+quantity));
  }
  const lotRows=(await db.query('SELECT l.id,l.food_id,l.expires_on,COALESCE(sum(m.delta_servings),0) balance FROM nutrition.inventory_lot l LEFT JOIN nutrition.inventory_movement m ON m.lot_id=l.id AND m.tenant_id=l.tenant_id AND m.user_id=l.user_id WHERE l.tenant_id=$1 AND l.user_id=$2 GROUP BY l.id',
    own(a))).rows;
  const stock=new Map<string,number>();
  for(const row of lotRows){
    if(row.expires_on && new Date(row.expires_on).toISOString().slice(0,10)<latest)continue;
    stock.set(row.food_id,round3((stock.get(row.food_id)??0)+Math.max(0,numeric(row.balance))));
  }
  for(const id of Object.keys(v.unitPricesKes))if(!needed.has(id))throw new ApiError(422,'UNKNOWN_PRICE_KEY','Only planned ingredient IDs can carry price assumptions.');
  const list=(await db.query('INSERT INTO nutrition.grocery_list(tenant_id,user_id,source_plan_id,source_plan_revision) VALUES($1,$2,$3,$4) RETURNING *',
    [...own(a),plan.id,plan.revision])).rows[0];
  const lines=[];
  for(const [foodId,quantity] of [...needed.entries()].sort((x,y)=>x[0].localeCompare(y[0]))){
    const offset=Math.min(quantity,stock.get(foodId)??0);
    const buy=round3(Math.max(0,quantity-offset));
    if(buy<=0)continue;
    const line=(await db.query('INSERT INTO nutrition.grocery_line(tenant_id,user_id,list_id,food_id,quantity_servings,needed_servings,stock_offset_servings,unit_price_kes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [...own(a),list.id,foodId,buy,quantity,offset,v.unitPricesKes[foodId]??0])).rows[0];
    lines.push(line);
  }
  await recordChange(db,a,{type:'nutrition.groceries.generated',aggregate:'grocery_list',id:list.id,action:'groceries.generated',correlationId:corr,
    metadata:{lines:lines.length,sourcePlanId:plan.id}});
  return {...list,lines};
}
export async function recordPurchase(db:SqlClient,a:Actor,id:string,purchased:boolean,actualPaidKes:number|null,corr:string){
  const line=await lockGroceryLine(db,a,id);
  if(line.received)throw new ApiError(409,'ALREADY_RECEIVED','Received stock cannot be silently unchecked.');
  const row=(await db.query('UPDATE nutrition.grocery_line SET purchased=$4,actual_paid_kes=$5 WHERE tenant_id=$1 AND user_id=$2 AND id=$3 RETURNING *',
    [...own(a),id,purchased,actualPaidKes])).rows[0];
  await recordChange(db,a,{type:'nutrition.groceries.purchase_recorded',aggregate:'grocery_list',id:line.list_id,action:'grocery.purchase_recorded',correlationId:corr,
    metadata:{lineId:id,purchased}});
  return row;
}
export async function receiveGrocery(db:SqlClient,a:Actor,id:string,v:z.infer<typeof receiveInput>,corr:string){
  const line=await lockGroceryLine(db,a,id);
  if(!line.purchased||line.received)throw new ApiError(409,'RECEIPT_INVALID','Purchase must be checked and not yet received.');
  const lot=(await db.query('INSERT INTO nutrition.inventory_lot(tenant_id,user_id,food_id,location,acquired_on,expires_on,unit_cost_kes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [...own(a),line.food_id,v.location,v.acquiredOn,v.expiresOn,line.unit_price_kes])).rows[0];
  await db.query('INSERT INTO nutrition.inventory_movement(tenant_id,user_id,lot_id,happened_on,kind,delta_servings,note) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [...own(a),lot.id,v.acquiredOn,'PURCHASE',line.quantity_servings,'Explicit grocery receipt']);
  await db.query('UPDATE nutrition.grocery_line SET received=true WHERE tenant_id=$1 AND user_id=$2 AND id=$3',[...own(a),id]);
  await recordChange(db,a,{type:'nutrition.groceries.received',aggregate:'grocery_list',id:line.list_id,action:'grocery.received',correlationId:corr,
    metadata:{lineId:id,inventoryLotId:lot.id}});
  return {received:true,lineId:id,lotId:lot.id,quantityServings:numeric(line.quantity_servings)};
}
