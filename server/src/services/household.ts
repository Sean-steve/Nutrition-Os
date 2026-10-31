import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {recordChange} from '../events.js';
import type {z} from 'zod';
import {z as schema} from 'zod';
import {uuid} from '../domain.js';
const notFound=()=>new ApiError(404,'HOUSEHOLD_NOT_FOUND','Shared household was not found or access was not granted.');
const denied=()=>new ApiError(403,'HOUSEHOLD_ROLE_DENIED','Shared household operation is not permitted.');
export const householdCreate=schema.object({name:schema.string().trim().min(1).max(120)}).strict();
export const memberInvite=schema.object({userId:uuid,alias:schema.string().trim().min(1).max(70),role:schema.enum(['editor','viewer'])}).strict();
export const memberRoleUpdate=schema.object({role:schema.enum(['editor','viewer'])}).strict();
export const householdTaskInput=schema.object({
 mealId:uuid,assignedUserId:uuid,note:schema.string().max(160).default(''),status:schema.enum(['planned','preparing','completed'])
}).strict();
export const householdGroceryInput=schema.object({
 title:schema.string().trim().min(1).max(140),quantity:schema.string().trim().min(1).max(80),
 estimateKes:schema.number().finite().nonnegative().max(1000000)
}).strict();
export const groceryCheckedInput=schema.object({checked:schema.boolean()}).strict();
const own=(a:Actor)=>[a.tenantId,a.userId];
export async function accessibleHousehold(db:SqlClient,a:Actor,id:string){
 const rows=(await db.query('SELECT * FROM nutrition.household WHERE tenant_id=$1 AND id=$2',[a.tenantId,id])).rows;
 if(!rows.length)throw notFound();
 return rows[0] as {id:string;tenant_id:string;owner_user_id:string;name:string};
}
export async function getSharedBoard(db:SqlClient,a:Actor){
 // Visible households exclude pending invites; invitees must accept explicitly.
 const h=(await db.query('SELECT * FROM nutrition.household WHERE tenant_id=$1 ORDER BY created_at LIMIT 15',[a.tenantId])).rows;
 const invites=(await db.query('SELECT household_id,owner_user_id,alias,role,state FROM nutrition.household_member WHERE tenant_id=$1 AND member_user_id=$2 AND state=$3 ORDER BY created_at',
  [...own(a),'invited'])).rows;
 const boards=[];
 for(const house of h){
  const member=(await db.query('SELECT role FROM nutrition.household_member WHERE tenant_id=$1 AND household_id=$2 AND member_user_id=$3 AND state=$4',
   [a.tenantId,house.id,a.userId,'accepted'])).rows[0];
  const role=house.owner_user_id===a.userId?'owner':member?.role??null;
  if(!role)continue;
  const members=(await db.query('SELECT member_user_id,alias,role,state FROM nutrition.household_member WHERE tenant_id=$1 AND household_id=$2 ORDER BY created_at',
   [a.tenantId,house.id])).rows;
  const meals=(await db.query('SELECT id,meal_date,slot,title,portions FROM nutrition.household_meal WHERE tenant_id=$1 AND household_id=$2 ORDER BY meal_date,slot',
   [a.tenantId,house.id])).rows;
  const tasks=(await db.query('SELECT id,meal_id,assigned_user_id,note,status FROM nutrition.household_task WHERE tenant_id=$1 AND household_id=$2 ORDER BY updated_at DESC',
   [a.tenantId,house.id])).rows;
  const groceries=(await db.query('SELECT id,title,quantity,estimate_kes,checked FROM nutrition.household_grocery WHERE tenant_id=$1 AND household_id=$2 ORDER BY created_at',
   [a.tenantId,house.id])).rows;
  // No personal intake, targets, medical profiles, or actual paid amounts projected.
  boards.push({id:house.id,name:house.name,role,ownerUserId:house.owner_user_id,
    members:role==='owner'?members:members.filter(m=>m.state==='accepted'),
    meals,tasks,groceries});
 }
 return {boards,invites,disclaimer:'Only explicitly shared kitchen logistics. Private nutrition and payments stay outside this projection.'};
}
export async function createHousehold(db:SqlClient,a:Actor,input:z.infer<typeof householdCreate>,corr:string){
 const row=(await db.query('INSERT INTO nutrition.household(tenant_id,owner_user_id,name) VALUES($1,$2,$3) RETURNING id,name,owner_user_id',
 [...own(a),input.name])).rows[0];
 await recordChange(db,a,{type:'nutrition.household.created',aggregate:'household',id:row.id,action:'household.created',correlationId:corr});
 return row;
}
export async function inviteMember(db:SqlClient,a:Actor,id:string,input:z.infer<typeof memberInvite>,corr:string){
 const h=await accessibleHousehold(db,a,id);
 if(h.owner_user_id!==a.userId)throw denied();
 if(input.userId===a.userId)throw new ApiError(422,'SELF_INVITE','Owner already belongs to this household.');
 const count=(await db.query('SELECT count(*)::int n FROM nutrition.household_member WHERE tenant_id=$1 AND household_id=$2',
  [a.tenantId,id])).rows[0].n;
 if(count>=24)throw new ApiError(409,'HOUSEHOLD_FULL','Household participant limit reached.');
 const row=(await db.query('INSERT INTO nutrition.household_member(tenant_id,household_id,owner_user_id,member_user_id,alias,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING member_user_id,alias,role,state',
  [a.tenantId,id,a.userId,input.userId,input.alias,input.role])).rows[0];
 await recordChange(db,a,{type:'nutrition.household.invited',aggregate:'household',id,action:'household.member_invited',correlationId:corr});
 return row;
}
export async function acceptInvite(db:SqlClient,a:Actor,id:string,corr:string){
 const row=(await db.query("UPDATE nutrition.household_member SET state='accepted' WHERE tenant_id=$1 AND household_id=$2 AND member_user_id=$3 AND state='invited' RETURNING household_id,role,state",
  [a.tenantId,id,a.userId])).rows[0];
 if(!row)throw notFound();
 await recordChange(db,a,{type:'nutrition.household.accepted',aggregate:'household',id,action:'household.invite_accepted',correlationId:corr});
 return row;
}
export async function changeRole(db:SqlClient,a:Actor,id:string,memberId:string,input:z.infer<typeof memberRoleUpdate>,corr:string){
 const h=await accessibleHousehold(db,a,id);if(h.owner_user_id!==a.userId)throw denied();
 const row=(await db.query('UPDATE nutrition.household_member SET role=$4 WHERE tenant_id=$1 AND household_id=$2 AND member_user_id=$3 RETURNING member_user_id,role,state',
 [a.tenantId,id,memberId,input.role])).rows[0];
 if(!row)throw notFound();
 await recordChange(db,a,{type:'nutrition.household.role_changed',aggregate:'household',id,action:'household.role_changed',correlationId:corr});
 return row;
}
export async function canEdit(db:SqlClient,a:Actor,id:string){
 const h=await accessibleHousehold(db,a,id);
 if(h.owner_user_id===a.userId)return h;
 const member=(await db.query('SELECT role FROM nutrition.household_member WHERE tenant_id=$1 AND household_id=$2 AND member_user_id=$3 AND state=$4',
 [a.tenantId,id,a.userId,'accepted'])).rows[0];
 if(member?.role!=='editor')throw denied();
 return h;
}
export async function sharePlan(db:SqlClient,a:Actor,id:string,planId:string,corr:string){
 const h=await accessibleHousehold(db,a,id);
 // Only plan owner may explicitly publish a sanitized meal schedule.
 if(h.owner_user_id!==a.userId)throw denied();
 const plan=(await db.query('SELECT id,status FROM nutrition.meal_plan WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
 [...own(a),planId])).rows[0];
 if(!plan||plan.status!=='approved')throw new ApiError(409,'PLAN_NOT_APPROVED','Only your approved plan can be explicitly shared.');
 const entries=(await db.query('SELECT pm.id,pm.planned_on,pm.slot,pm.portions,r.name FROM nutrition.planned_meal pm JOIN nutrition.recipe r ON r.id=pm.recipe_id AND r.tenant_id=pm.tenant_id AND r.user_id=pm.user_id WHERE pm.tenant_id=$1 AND pm.user_id=$2 AND pm.plan_id=$3 ORDER BY pm.planned_on',
 [...own(a),planId])).rows;
 for(const e of entries){
  await db.query('INSERT INTO nutrition.household_meal(tenant_id,household_id,source_entry_id,meal_date,slot,title,portions) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,household_id,source_entry_id) DO UPDATE SET meal_date=EXCLUDED.meal_date,slot=EXCLUDED.slot,title=EXCLUDED.title,portions=EXCLUDED.portions',
  [a.tenantId,id,e.id,e.planned_on,e.slot,e.name,e.portions]);
 }
 await recordChange(db,a,{type:'nutrition.household.plan_shared',aggregate:'household',id,action:'household.plan_shared',correlationId:corr,metadata:{entries:entries.length}});
 return {sharedMeals:entries.length};
}
export async function saveTask(db:SqlClient,a:Actor,id:string,input:z.infer<typeof householdTaskInput>,corr:string){
 const h=await canEdit(db,a,id);
 const meal=(await db.query('SELECT id FROM nutrition.household_meal WHERE tenant_id=$1 AND household_id=$2 AND id=$3',
 [a.tenantId,id,input.mealId])).rows[0];
 if(!meal)throw notFound();
 if(input.assignedUserId!==h.owner_user_id){
  const m=(await db.query('SELECT member_user_id FROM nutrition.household_member WHERE tenant_id=$1 AND household_id=$2 AND member_user_id=$3 AND state=$4',
  [a.tenantId,id,input.assignedUserId,'accepted'])).rows[0];
  if(!m)throw new ApiError(422,'INVALID_ASSIGNEE','Select an accepted household participant.');
 }
 const row=(await db.query('INSERT INTO nutrition.household_task(tenant_id,household_id,meal_id,assigned_user_id,note,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,household_id,meal_id) DO UPDATE SET assigned_user_id=EXCLUDED.assigned_user_id,note=EXCLUDED.note,status=EXCLUDED.status,updated_at=now() RETURNING id,meal_id,assigned_user_id,note,status',
 [a.tenantId,id,input.mealId,input.assignedUserId,input.note,input.status])).rows[0];
 await recordChange(db,a,{type:'nutrition.household.task_saved',aggregate:'household',id,action:'household.task_saved',correlationId:corr});
 return row;
}
export async function addSharedGrocery(db:SqlClient,a:Actor,id:string,input:z.infer<typeof householdGroceryInput>,corr:string){
 await canEdit(db,a,id);
 const row=(await db.query('INSERT INTO nutrition.household_grocery(tenant_id,household_id,title,quantity,estimate_kes) VALUES($1,$2,$3,$4,$5) RETURNING id,title,quantity,estimate_kes,checked',
 [a.tenantId,id,input.title,input.quantity,input.estimateKes])).rows[0];
 await recordChange(db,a,{type:'nutrition.household.grocery_added',aggregate:'household',id,action:'household.grocery_added',correlationId:corr});
 return row;
}
export async function checkSharedGrocery(db:SqlClient,a:Actor,id:string,itemId:string,checked:boolean,corr:string){
 await canEdit(db,a,id);
 const row=(await db.query('UPDATE nutrition.household_grocery SET checked=$4 WHERE tenant_id=$1 AND household_id=$2 AND id=$3 RETURNING id,title,quantity,estimate_kes,checked',
 [a.tenantId,id,itemId,checked])).rows[0];
 if(!row)throw notFound();
 await recordChange(db,a,{type:'nutrition.household.grocery_checked',aggregate:'household',id,action:'household.grocery_checked',correlationId:corr});
 return row;
}
export const houseId=schema.object({id:uuid});
export const houseMemberId=schema.object({id:uuid,memberId:uuid});
export const houseItemId=schema.object({id:uuid,itemId:uuid});
export const sharePlanInput=schema.object({planId:uuid}).strict();
export const acceptInviteInput=schema.object({}).strict();
