import {randomUUID} from 'node:crypto';
import type {SqlClient} from './db.js';
import type {Actor} from './auth.js';
const events=new Set([
 'nutrition.food.created','nutrition.recipe.created','nutrition.profile.updated',
 'nutrition.goal.created','nutrition.meal.logged','nutrition.meal.corrected','nutrition.meal.deleted',
 'nutrition.plan.created','nutrition.plan.entry_added','nutrition.plan.entry_removed','nutrition.plan.entry_lock_changed',
 'nutrition.plan.approved','nutrition.plan.reopened',
 'nutrition.inventory.lot_created','nutrition.inventory.movement_recorded','nutrition.inventory.transferred',
 'nutrition.groceries.generated','nutrition.groceries.purchase_recorded','nutrition.groceries.received',
 'nutrition.budget.updated'
]);
export function knownEvent(type:string):boolean{return events.has(type);}
export async function recordChange(db:SqlClient,actor:Actor,data:{
  type:string;aggregate:string;id:string;action:string;correlationId:string;metadata?:Record<string,string|number|boolean>;
}):Promise<void>{
  if(!knownEvent(data.type))throw new Error('Unregistered event type: '+data.type);
  const safe=data.metadata??{};
  if(Object.keys(safe).length>12 || Object.values(safe).some(x=>typeof x==='string'&&x.length>80))throw new Error('Invalid event metadata.');
  await db.query('INSERT INTO nutrition.event_outbox (id,tenant_id,user_id,event_type,event_version,aggregate_type,aggregate_id,data,correlation_id) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8)',
    [randomUUID(),actor.tenantId,actor.userId,data.type,data.aggregate,data.id,JSON.stringify(safe),data.correlationId]);
  await db.query('INSERT INTO nutrition.audit_event(tenant_id,user_id,action,resource,resource_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actor.tenantId,actor.userId,data.action,data.aggregate,data.id,data.correlationId]);
}
