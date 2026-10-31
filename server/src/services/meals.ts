/** Explicitly confirmed meal intake and immutable food-composition snapshots. */
import type {z} from 'zod';
import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {recordChange} from '../events.js';
import {mealInput,round3,type Macros} from '../domain.js';
import {ownedFood,notFound} from './foods.js';
const own=(a:Actor)=>[a.tenantId,a.userId];
type Input=z.infer<typeof mealInput>;
type Snapshot={foodId:string;servings:number;food:Record<string,unknown>;macros:Macros};
const numeric=(x:unknown)=>Number(x);
async function snapshots(db:SqlClient,a:Actor,items:Input['items']):Promise<Snapshot[]>{
  const result:Snapshot[]=[];
  for(const entry of items){
    const food=await ownedFood(db,a,entry.foodId);
    const nutrients={energyKcal:numeric(food.energy_kcal),proteinG:numeric(food.protein_g),carbsG:numeric(food.carbs_g),fatG:numeric(food.fat_g)};
    result.push({...entry,food,macros:{
      energyKcal:round3(nutrients.energyKcal*entry.servings),
      proteinG:round3(nutrients.proteinG*entry.servings),
      carbsG:round3(nutrients.carbsG*entry.servings),
      fatG:round3(nutrients.fatG*entry.servings)
    }});
  }
  return result;
}
function aggregate(items:Snapshot[]):Macros{
  return items.reduce((s,x)=>({
    energyKcal:round3(s.energyKcal+x.macros.energyKcal),
    proteinG:round3(s.proteinG+x.macros.proteinG),
    carbsG:round3(s.carbsG+x.macros.carbsG),
    fatG:round3(s.fatG+x.macros.fatG)
  }),{energyKcal:0,proteinG:0,carbsG:0,fatG:0});
}
async function storeItems(db:SqlClient,a:Actor,mealId:string,items:Snapshot[]){
  for(const item of items)await db.query('INSERT INTO nutrition.meal_item(tenant_id,user_id,meal_id,food_id,servings,snapshot_name,snapshot_serving_label,snapshot_source,snapshot_energy_kcal,snapshot_protein_g,snapshot_carbs_g,snapshot_fat_g) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    [...own(a),mealId,item.foodId,item.servings,item.food.name,item.food.serving_label,item.food.source,
      item.macros.energyKcal,item.macros.proteinG,item.macros.carbsG,item.macros.fatG]);
}
export async function createMeal(db:SqlClient,a:Actor,v:Input,corr:string){
  const items=await snapshots(db,a,v.items),total=aggregate(items);
  const row=(await db.query('INSERT INTO nutrition.meal(tenant_id,user_id,consumed_on,slot,name,note,energy_kcal,protein_g,carbs_g,fat_g) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [...own(a),v.consumedOn,v.slot,v.name,v.note,total.energyKcal,total.proteinG,total.carbsG,total.fatG])).rows[0];
  await storeItems(db,a,row.id,items);
  await recordChange(db,a,{type:'nutrition.meal.logged',aggregate:'meal',id:row.id,action:'meal.logged',correlationId:corr,metadata:{day:v.consumedOn,items:items.length}});
  return {...row,items:items.map(i=>({foodId:i.foodId,servings:i.servings,macros:i.macros}))};
}
export async function listMeals(db:SqlClient,a:Actor,date:string|null){
  return (await db.query('SELECT * FROM nutrition.meal WHERE tenant_id=$1 AND user_id=$2 AND deleted_at IS NULL AND ($3::date IS NULL OR consumed_on=$3::date) ORDER BY consumed_on DESC,created_at DESC LIMIT 150',
    [...own(a),date])).rows;
}
export async function getMeal(db:SqlClient,a:Actor,id:string){
  const meal=(await db.query('SELECT * FROM nutrition.meal WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND deleted_at IS NULL',[...own(a),id])).rows[0];
  if(!meal)throw notFound('Meal');
  const items=(await db.query('SELECT * FROM nutrition.meal_item WHERE tenant_id=$1 AND user_id=$2 AND meal_id=$3 ORDER BY id',[...own(a),id])).rows;
  return {...meal,items};
}
export async function correctMeal(db:SqlClient,a:Actor,id:string,v:Input,revision:number,corr:string){
  const row=(await db.query('SELECT id,revision FROM nutrition.meal WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND deleted_at IS NULL FOR UPDATE',[...own(a),id])).rows[0];
  if(!row)throw notFound('Meal');
  if(row.revision!==revision)throw new ApiError(409,'REVISION_CONFLICT','Refresh the meal before editing it.');
  const items=await snapshots(db,a,v.items),total=aggregate(items);
  await db.query('DELETE FROM nutrition.meal_item WHERE tenant_id=$1 AND user_id=$2 AND meal_id=$3',[...own(a),id]);
  await storeItems(db,a,id,items);
  const updated=(await db.query('UPDATE nutrition.meal SET consumed_on=$4,slot=$5,name=$6,note=$7,energy_kcal=$8,protein_g=$9,carbs_g=$10,fat_g=$11,revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3 RETURNING *',
    [...own(a),id,v.consumedOn,v.slot,v.name,v.note,total.energyKcal,total.proteinG,total.carbsG,total.fatG])).rows[0];
  await recordChange(db,a,{type:'nutrition.meal.corrected',aggregate:'meal',id,action:'meal.corrected',correlationId:corr,metadata:{revision:updated.revision}});
  return updated;
}
export async function deleteMeal(db:SqlClient,a:Actor,id:string,corr:string){
  const row=(await db.query('UPDATE nutrition.meal SET deleted_at=now(),revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND deleted_at IS NULL RETURNING id',[...own(a),id])).rows[0];
  if(!row)throw notFound('Meal');
  await recordChange(db,a,{type:'nutrition.meal.deleted',aggregate:'meal',id,action:'meal.deleted',correlationId:corr});
  return {id,deleted:true};
}
export async function observedState(db:SqlClient,a:Actor,date:string){
  const row=(await db.query('SELECT COUNT(*)::int AS count,SUM(energy_kcal) AS energy,SUM(protein_g) AS protein,SUM(carbs_g) AS carbs,SUM(fat_g) AS fat FROM nutrition.meal WHERE tenant_id=$1 AND user_id=$2 AND consumed_on=$3 AND status=$4 AND deleted_at IS NULL',
    [...own(a),date,'logged'])).rows[0];
  const observed=row.count>0;
  return {date,observedMeals:row.count,observationStatus:observed?'partial_recorded':'unknown',
    intake:observed?{energyKcal:numeric(row.energy),proteinG:numeric(row.protein),carbsG:numeric(row.carbs),fatG:numeric(row.fat)}:null,
    disclaimer:'Logged meals are partial records; missing intake is unknown, not zero or a diagnosed deficiency.'};
}
