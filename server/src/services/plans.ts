/** Plans are intent, not observed intake. Approved plans are not meals. */
import type {z} from 'zod';
import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {recordChange} from '../events.js';
import {entryInput,planInput,withinWeek} from '../domain.js';
import {notFound} from './foods.js';
const own=(a:Actor)=>[a.tenantId,a.userId];
const iso=(x:string|Date)=>typeof x==='string'?x.slice(0,10):x.toISOString().slice(0,10);
export async function listPlans(db:SqlClient,a:Actor,week:string|null){
  const plans=(await db.query('SELECT * FROM nutrition.meal_plan WHERE tenant_id=$1 AND user_id=$2 AND ($3::date IS NULL OR week_start=$3::date) ORDER BY week_start DESC LIMIT 40',
    [...own(a),week])).rows;
  const entries=(await db.query('SELECT * FROM nutrition.planned_meal WHERE tenant_id=$1 AND user_id=$2 AND plan_id=ANY($3::uuid[]) ORDER BY planned_on,slot',
    [...own(a),plans.map(p=>p.id)])).rows;
  return plans.map(p=>({...p,entries:entries.filter(x=>x.plan_id===p.id)}));
}
export async function createPlan(db:SqlClient,a:Actor,v:z.infer<typeof planInput>,corr:string){
  const row=(await db.query('INSERT INTO nutrition.meal_plan(tenant_id,user_id,week_start) VALUES($1,$2,$3) ON CONFLICT(tenant_id,user_id,week_start) DO NOTHING RETURNING *',
    [...own(a),v.weekStart])).rows[0];
  if(!row)throw new ApiError(409,'PLAN_EXISTS','This week already has a meal plan.');
  await recordChange(db,a,{type:'nutrition.plan.created',aggregate:'plan',id:row.id,action:'plan.created',correlationId:corr});
  return {...row,entries:[]};
}
async function lockedPlan(db:SqlClient,a:Actor,id:string){
  const row=(await db.query('SELECT * FROM nutrition.meal_plan WHERE tenant_id=$1 AND user_id=$2 AND id=$3 FOR UPDATE',
    [...own(a),id])).rows[0];
  if(!row)throw notFound('Plan');
  return row;
}
export async function createPlanEntry(db:SqlClient,a:Actor,id:string,v:z.infer<typeof entryInput>,corr:string){
  const plan=await lockedPlan(db,a,id);
  if(plan.status!=='draft')throw new ApiError(409,'APPROVED_PLAN','Reopen the plan to edit it.');
  if(!withinWeek(iso(plan.week_start),v.plannedOn))throw new ApiError(422,'INVALID_PLAN_DATE','Planned date must be within the plan week.');
  const recipe=(await db.query('SELECT id FROM nutrition.recipe WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
    [...own(a),v.recipeId])).rows[0];
  if(!recipe)throw notFound('Recipe');
  const row=(await db.query('INSERT INTO nutrition.planned_meal(tenant_id,user_id,plan_id,planned_on,slot,recipe_id,portions,locked) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [...own(a),id,v.plannedOn,v.slot,v.recipeId,v.portions,v.locked])).rows[0];
  await db.query('UPDATE nutrition.meal_plan SET revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
    [...own(a),id]);
  await recordChange(db,a,{type:'nutrition.plan.entry_added',aggregate:'plan',id,action:'plan.entry_added',correlationId:corr,
    metadata:{entryId:row.id}});
  return row;
}
export async function deletePlanEntry(db:SqlClient,a:Actor,id:string,entryId:string,corr:string){
  const plan=await lockedPlan(db,a,id);
  if(plan.status!=='draft')throw new ApiError(409,'APPROVED_PLAN','Reopen the plan to edit it.');
  const row=(await db.query('SELECT id,locked FROM nutrition.planned_meal WHERE tenant_id=$1 AND user_id=$2 AND plan_id=$3 AND id=$4 FOR UPDATE',
    [...own(a),id,entryId])).rows[0];
  if(!row)throw notFound('Planned meal');
  if(row.locked)throw new ApiError(409,'ENTRY_LOCKED','Unlock this planned meal first.');
  await db.query('DELETE FROM nutrition.planned_meal WHERE tenant_id=$1 AND user_id=$2 AND plan_id=$3 AND id=$4',
    [...own(a),id,entryId]);
  await db.query('UPDATE nutrition.meal_plan SET revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
    [...own(a),id]);
  await recordChange(db,a,{type:'nutrition.plan.entry_removed',aggregate:'plan',id,action:'plan.entry_removed',correlationId:corr});
  return {id:entryId,removed:true};
}
export async function updatePlanEntryLock(db:SqlClient,a:Actor,id:string,entryId:string,locked:boolean,corr:string){
  const plan=await lockedPlan(db,a,id);
  if(plan.status!=='draft')throw new ApiError(409,'APPROVED_PLAN','Reopen the plan to edit it.');
  const row=(await db.query('UPDATE nutrition.planned_meal SET locked=$5 WHERE tenant_id=$1 AND user_id=$2 AND plan_id=$3 AND id=$4 RETURNING *',
    [...own(a),id,entryId,locked])).rows[0];
  if(!row)throw notFound('Planned meal');
  await db.query('UPDATE nutrition.meal_plan SET revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
    [...own(a),id]);
  await recordChange(db,a,{type:'nutrition.plan.entry_lock_changed',aggregate:'plan',id,action:'plan.entry_lock_changed',correlationId:corr,metadata:{locked}});
  return row;
}
export async function setPlanStatus(db:SqlClient,a:Actor,id:string,status:'approved'|'draft',corr:string){
  const plan=await lockedPlan(db,a,id);
  if(plan.status===status)return plan;
  if(status==='approved'){
    const r=await db.query('SELECT count(*)::int AS count FROM nutrition.planned_meal WHERE tenant_id=$1 AND user_id=$2 AND plan_id=$3',
      [...own(a),id]);
    if(r.rows[0].count===0)throw new ApiError(422,'EMPTY_PLAN','A plan must contain meals before approval.');
  }
  const row=(await db.query('UPDATE nutrition.meal_plan SET status=$4,revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND id=$3 RETURNING *',
    [...own(a),id,status])).rows[0];
  await recordChange(db,a,{type:status==='approved'?'nutrition.plan.approved':'nutrition.plan.reopened',aggregate:'plan',id,action:'plan.status',correlationId:corr});
  return row;
}
