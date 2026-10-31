import type {z} from 'zod';
import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {recordChange} from '../events.js';
import {foodInput,profileInput,goalInput,recipeInput} from '../domain.js';
const own=(a:Actor)=>[a.tenantId,a.userId];
export const notFound=(item:string)=>new ApiError(404,'NOT_FOUND',item+' not found in this workspace.');
export async function ownedFood(db:SqlClient,a:Actor,id:string){
  const rows=(await db.query('SELECT * FROM nutrition.food WHERE tenant_id=$1 AND user_id=$2 AND id=$3',[...own(a),id])).rows;
  if(!rows.length)throw notFound('Food');return rows[0];
}
export async function getFoods(db:SqlClient,a:Actor,q:string){
  return (await db.query('SELECT * FROM nutrition.food WHERE tenant_id=$1 AND user_id=$2 AND name ILIKE $3 ORDER BY name LIMIT 80',
    [...own(a),'%'+q.replace(/[\\%_]/g,'\\$&')+'%'])).rows;
}
export async function putFood(db:SqlClient,a:Actor,v:z.infer<typeof foodInput>,corr:string){
  const item=(await db.query('INSERT INTO nutrition.food(tenant_id,user_id,name,serving_label,energy_kcal,protein_g,carbs_g,fat_g) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [...own(a),v.name,v.servingLabel,v.energyKcal,v.proteinG,v.carbsG,v.fatG])).rows[0];
  await recordChange(db,a,{type:'nutrition.food.created',aggregate:'food',id:item.id,action:'food.created',correlationId:corr});
  return item;
}
export async function getProfile(db:SqlClient,a:Actor){
  return (await db.query('SELECT * FROM nutrition.profile WHERE tenant_id=$1 AND user_id=$2',own(a))).rows[0]??null;
}
export async function putProfile(db:SqlClient,a:Actor,v:z.infer<typeof profileInput>,corr:string){
  const result=await db.query('INSERT INTO nutrition.profile(tenant_id,user_id,display_name,diet_style,excluded_foods,preferences,targets) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,user_id) DO UPDATE SET display_name=EXCLUDED.display_name,diet_style=EXCLUDED.diet_style,excluded_foods=EXCLUDED.excluded_foods,preferences=EXCLUDED.preferences,targets=EXCLUDED.targets,updated_at=now() RETURNING *',
    [...own(a),v.displayName,v.dietStyle,v.excludedFoods,JSON.stringify(v.preferences),JSON.stringify(v.targets)]);
  await recordChange(db,a,{type:'nutrition.profile.updated',aggregate:'profile',id:a.userId,action:'profile.updated',correlationId:corr});
  return result.rows[0];
}
export async function getGoals(db:SqlClient,a:Actor){
  return (await db.query('SELECT * FROM nutrition.goal WHERE tenant_id=$1 AND user_id=$2 ORDER BY effective_from DESC',own(a))).rows;
}
export async function putGoal(db:SqlClient,a:Actor,v:z.infer<typeof goalInput>,corr:string){
  const row=(await db.query('INSERT INTO nutrition.goal(tenant_id,user_id,metric,target,unit,effective_from,effective_to) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [...own(a),v.metric,v.target,v.unit,v.effectiveFrom,v.effectiveTo])).rows[0];
  await recordChange(db,a,{type:'nutrition.goal.created',aggregate:'goal',id:row.id,action:'goal.created',correlationId:corr});
  return row;
}
export async function getRecipes(db:SqlClient,a:Actor){
  const recipes=(await db.query('SELECT * FROM nutrition.recipe WHERE tenant_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100',own(a))).rows;
  const ids=recipes.map(r=>r.id);
  const ingredients=(await db.query('SELECT * FROM nutrition.recipe_ingredient WHERE tenant_id=$1 AND user_id=$2 AND recipe_id=ANY($3::uuid[])',[...own(a),ids])).rows;
  return recipes.map(recipe=>({...recipe,ingredients:ingredients.filter(i=>i.recipe_id===recipe.id)}));
}
export async function putRecipe(db:SqlClient,a:Actor,v:z.infer<typeof recipeInput>,corr:string){
  if(new Set(v.ingredients.map(x=>x.foodId)).size!==v.ingredients.length)throw new ApiError(422,'DUPLICATE_INGREDIENT','Combine repeated food ingredients.');
  for(const ing of v.ingredients)await ownedFood(db,a,ing.foodId);
  const row=(await db.query('INSERT INTO nutrition.recipe(tenant_id,user_id,name,yield_servings,prep_minutes,instructions) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
    [...own(a),v.name,v.yieldServings,v.prepMinutes,v.instructions])).rows[0];
  for(const ing of v.ingredients)await db.query('INSERT INTO nutrition.recipe_ingredient(tenant_id,user_id,recipe_id,food_id,servings) VALUES($1,$2,$3,$4,$5)',
    [...own(a),row.id,ing.foodId,ing.servings]);
  await recordChange(db,a,{type:'nutrition.recipe.created',aggregate:'recipe',id:row.id,action:'recipe.created',correlationId:corr});
  return {...row,ingredients:v.ingredients};
}
