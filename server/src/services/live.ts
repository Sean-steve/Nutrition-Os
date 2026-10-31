import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {recordChange} from '../events.js';
import {z} from 'zod';
import {dateSchema,foodInput,recipeInput,uuid} from '../domain.js';
import {ownedFood,notFound} from './foods.js';

const owner=(a:Actor)=>[a.tenantId,a.userId];
const n=(value:unknown)=>Number(value);
export const reviseFoodInput=foodInput.extend({expectedRevision:z.number().int().positive()}).strict();
export const reviseRecipeInput=recipeInput.extend({expectedRevision:z.number().int().positive()}).strict();
export const dailyWaterInput=z.object({date:dateSchema,observedL:z.number().finite().min(0).max(15)}).strict();
export const datesInput=z.object({from:dateSchema,to:dateSchema}).strict().refine(v=>v.to>=v.from&&
 (Date.parse(v.to+'T12:00:00Z')-Date.parse(v.from+'T12:00:00Z'))<=90*86400000,'Choose a range of 90 days or less.');
export const manualLineInput=z.object({foodId:uuid,quantityServings:z.number().finite().positive().max(100000),
 unitPriceKes:z.number().finite().nonnegative().max(1000000)}).strict();
export const lineEditInput=manualLineInput.omit({foodId:true}).strict();

export async function reviseFood(db:SqlClient,a:Actor,id:string,v:z.infer<typeof reviseFoodInput>,corr:string){
 const {expectedRevision,...input}=v;
 const row=(await db.query('UPDATE nutrition.food SET name=$4,serving_label=$5,energy_kcal=$6,protein_g=$7,carbs_g=$8,fat_g=$9,revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND revision=$10 AND deleted_at IS NULL RETURNING *',
 [...owner(a),id,input.name,input.servingLabel,input.energyKcal,input.proteinG,input.carbsG,input.fatG,expectedRevision])).rows[0];
 if(!row){await ownedFood(db,a,id);throw new ApiError(409,'REVISION_CONFLICT','Refresh this food before editing.');}
 await recordChange(db,a,{type:'nutrition.food.updated',aggregate:'food',id,action:'food.updated',correlationId:corr,metadata:{revision:row.revision}});
 return row;
}
export async function retireFood(db:SqlClient,a:Actor,id:string,corr:string){
 const row=(await db.query('UPDATE nutrition.food SET deleted_at=now(),revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND deleted_at IS NULL RETURNING id',
 [...owner(a),id])).rows[0];
 if(!row)throw notFound('Food');
 await recordChange(db,a,{type:'nutrition.food.retired',aggregate:'food',id,action:'food.retired',correlationId:corr});
 return {id,retired:true};
}
export async function reviseRecipe(db:SqlClient,a:Actor,id:string,v:z.infer<typeof reviseRecipeInput>,corr:string){
 const {expectedRevision,...input}=v;
 const existing=(await db.query('SELECT * FROM nutrition.recipe WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND deleted_at IS NULL FOR UPDATE',
 [...owner(a),id])).rows[0];
 if(!existing)throw notFound('Recipe');
 if(existing.version!==expectedRevision)throw new ApiError(409,'REVISION_CONFLICT','Refresh this recipe before editing.');
 if(new Set(input.ingredients.map(x=>x.foodId)).size!==input.ingredients.length)throw new ApiError(422,'DUPLICATE_INGREDIENT','Combine identical ingredient entries.');
 // Prevent changing a recipe underpinning a released plan; allow a new version instead.
 const approved=(await db.query("SELECT 1 FROM nutrition.planned_meal pm JOIN nutrition.meal_plan mp ON mp.id=pm.plan_id AND mp.tenant_id=pm.tenant_id AND mp.user_id=pm.user_id WHERE pm.tenant_id=$1 AND pm.user_id=$2 AND pm.recipe_id=$3 AND mp.status='approved' LIMIT 1",
 [...owner(a),id])).rows;
 if(approved.length)throw new ApiError(409,'RECIPE_IN_APPROVED_PLAN','Reopen or duplicate a recipe before changing an approved meal plan.');
 for(const ingredient of input.ingredients)await ownedFood(db,a,ingredient.foodId);
 const row=(await db.query('UPDATE nutrition.recipe SET name=$4,yield_servings=$5,prep_minutes=$6,instructions=$7,version=version+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3 RETURNING *',
 [...owner(a),id,input.name,input.yieldServings,input.prepMinutes,input.instructions])).rows[0];
 await db.query('DELETE FROM nutrition.recipe_ingredient WHERE tenant_id=$1 AND user_id=$2 AND recipe_id=$3',[...owner(a),id]);
 for(const ing of input.ingredients)await db.query('INSERT INTO nutrition.recipe_ingredient(tenant_id,user_id,recipe_id,food_id,servings) VALUES($1,$2,$3,$4,$5)',
 [...owner(a),id,ing.foodId,ing.servings]);
 await recordChange(db,a,{type:'nutrition.recipe.updated',aggregate:'recipe',id,action:'recipe.updated',correlationId:corr,metadata:{version:row.version}});
 return {...row,ingredients:input.ingredients};
}
export async function retireRecipe(db:SqlClient,a:Actor,id:string,corr:string){
 const row=(await db.query('UPDATE nutrition.recipe SET deleted_at=now(),updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND deleted_at IS NULL RETURNING id',
 [...owner(a),id])).rows[0];
 if(!row)throw notFound('Recipe');
 await recordChange(db,a,{type:'nutrition.recipe.retired',aggregate:'recipe',id,action:'recipe.retired',correlationId:corr});
 return {id,retired:true};
}
export async function getWater(db:SqlClient,a:Actor,date:string){
 const row=(await db.query('SELECT observed_on,observed_l,revision FROM nutrition.hydration_day WHERE tenant_id=$1 AND user_id=$2 AND observed_on=$3',
 [...owner(a),date])).rows[0];
 return row?{date,observedL:n(row.observed_l),revision:row.revision}:{date,observedL:null,revision:null};
}
export async function putWater(db:SqlClient,a:Actor,v:z.infer<typeof dailyWaterInput>,corr:string){
 const row=(await db.query('INSERT INTO nutrition.hydration_day(tenant_id,user_id,observed_on,observed_l) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,user_id,observed_on) DO UPDATE SET observed_l=EXCLUDED.observed_l,revision=nutrition.hydration_day.revision+1,updated_at=now() RETURNING observed_on,observed_l,revision',
 [...owner(a),v.date,v.observedL])).rows[0];
 await recordChange(db,a,{type:'nutrition.hydration.recorded',aggregate:'hydration_day',id:a.userId,action:'hydration.recorded',correlationId:corr,metadata:{date:v.date}});
 return {date:v.date,observedL:n(row.observed_l),revision:row.revision};
}
export async function progress(db:SqlClient,a:Actor,from:string,to:string){
 const meals=(await db.query('SELECT consumed_on,COUNT(*)::int AS logged_meals,SUM(energy_kcal) AS energy_kcal,SUM(protein_g) AS protein_g,SUM(carbs_g) AS carbs_g,SUM(fat_g) AS fat_g FROM nutrition.meal WHERE tenant_id=$1 AND user_id=$2 AND consumed_on BETWEEN $3 AND $4 AND deleted_at IS NULL GROUP BY consumed_on ORDER BY consumed_on',
 [...owner(a),from,to])).rows;
 const water=(await db.query('SELECT observed_on,observed_l FROM nutrition.hydration_day WHERE tenant_id=$1 AND user_id=$2 AND observed_on BETWEEN $3 AND $4 ORDER BY observed_on',
 [...owner(a),from,to])).rows;
 return {from,to,observations:meals.map(x=>({date:new Date(x.consumed_on).toISOString().slice(0,10),
  loggedMeals:x.logged_meals,energyKcal:n(x.energy_kcal),proteinG:n(x.protein_g),
  carbsG:n(x.carbs_g),fatG:n(x.fat_g)})),
  hydration:water.map(x=>({date:new Date(x.observed_on).toISOString().slice(0,10),observedL:n(x.observed_l)})),
  missingDates:'unknown',disclaimer:'Only explicitly recorded days are returned; the response does not infer unlogged intake.'};
}
async function activeList(db:SqlClient,a:Actor){
 const list=(await db.query("SELECT * FROM nutrition.grocery_list WHERE tenant_id=$1 AND user_id=$2 AND status='active' FOR UPDATE",
 owner(a))).rows[0];
 if(!list)throw new ApiError(404,'NO_ACTIVE_GROCERY_LIST','Create or generate a grocery list first.');
 return list;
}
export async function newGroceryList(db:SqlClient,a:Actor,corr:string){
 // Do not lose unresolved purchase receipts.
 const rows=(await db.query("SELECT 1 FROM nutrition.grocery_line l JOIN nutrition.grocery_list g ON g.id=l.list_id AND g.tenant_id=l.tenant_id AND g.user_id=l.user_id WHERE l.tenant_id=$1 AND l.user_id=$2 AND g.status='active' AND l.purchased=true AND l.received=false LIMIT 1",owner(a))).rows;
 if(rows.length)throw new ApiError(409,'PENDING_RECEIPTS','Receive pending purchased groceries before replacing the active list.');
 await db.query("UPDATE nutrition.grocery_list SET status='archived' WHERE tenant_id=$1 AND user_id=$2 AND status='active'",owner(a));
 const row=(await db.query('INSERT INTO nutrition.grocery_list(tenant_id,user_id,status) VALUES($1,$2,$3) RETURNING *',
 [...owner(a),'active'])).rows[0];
 await recordChange(db,a,{type:'nutrition.groceries.list_created',aggregate:'grocery_list',id:row.id,action:'groceries.list_created',correlationId:corr});
 return {...row,lines:[]};
}
export async function manualGroceryLine(db:SqlClient,a:Actor,v:z.infer<typeof manualLineInput>,corr:string){
 await ownedFood(db,a,v.foodId);
 const list=await activeList(db,a);
 const row=(await db.query('INSERT INTO nutrition.grocery_line(tenant_id,user_id,list_id,food_id,quantity_servings,unit_price_kes,source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
 [...owner(a),list.id,v.foodId,v.quantityServings,v.unitPriceKes,'manual'])).rows[0];
 await recordChange(db,a,{type:'nutrition.groceries.line_added',aggregate:'grocery_list',id:list.id,action:'groceries.line_added',correlationId:corr});
 return row;
}
export async function editGroceryLine(db:SqlClient,a:Actor,id:string,v:z.infer<typeof lineEditInput>,corr:string){
 const row=(await db.query('SELECT l.*,g.status FROM nutrition.grocery_line l JOIN nutrition.grocery_list g ON l.list_id=g.id AND l.tenant_id=g.tenant_id AND l.user_id=g.user_id WHERE l.tenant_id=$1 AND l.user_id=$2 AND l.id=$3 FOR UPDATE OF l',
 [...owner(a),id])).rows[0];
 if(!row)throw notFound('Grocery item');
 if(row.received||row.status!=='active'||row.purchased)throw new ApiError(409,'GROCERY_LOCKED','Only unchecked, unreceived items in the active list may be edited.');
 const updated=(await db.query('UPDATE nutrition.grocery_line SET quantity_servings=$4,unit_price_kes=$5 WHERE tenant_id=$1 AND user_id=$2 AND id=$3 RETURNING *',
 [...owner(a),id,v.quantityServings,v.unitPriceKes])).rows[0];
 await recordChange(db,a,{type:'nutrition.groceries.line_updated',aggregate:'grocery_list',id:row.list_id,action:'groceries.line_updated',correlationId:corr});
 return updated;
}
export async function deleteGroceryLine(db:SqlClient,a:Actor,id:string,corr:string){
 const row=(await db.query('SELECT l.*,g.status FROM nutrition.grocery_line l JOIN nutrition.grocery_list g ON l.list_id=g.id AND l.tenant_id=g.tenant_id AND l.user_id=g.user_id WHERE l.tenant_id=$1 AND l.user_id=$2 AND l.id=$3 FOR UPDATE OF l',
 [...owner(a),id])).rows[0];
 if(!row)throw notFound('Grocery item');
 if(row.purchased||row.received||row.status!=='active')throw new ApiError(409,'GROCERY_LOCKED','Purchased or archived grocery records cannot be deleted.');
 await db.query('DELETE FROM nutrition.grocery_line WHERE tenant_id=$1 AND user_id=$2 AND id=$3',[...owner(a),id]);
 await recordChange(db,a,{type:'nutrition.groceries.line_deleted',aggregate:'grocery_list',id:row.list_id,action:'groceries.line_deleted',correlationId:corr});
 return {id,deleted:true};
}
export async function stockMovements(db:SqlClient,a:Actor){
 return (await db.query('SELECT * FROM nutrition.inventory_movement WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 500',
 owner(a))).rows;
}
