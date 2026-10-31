/**
 * Privacy-filtered outbound HOS projection. This module does not deploy a
 * transport: production publishers MUST obtain HOS authorization independently,
 * use an approved HTTPS Event Mesh endpoint, and pass lifecycle/consent gates.
 *
 * No raw meal text, food IDs, profile, allergens, health records or finances
 * cross this boundary. Event IDs are stable for consumer deduplication.
 */
import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {requireGrant} from './services.js';
import type {KernelScope} from './contracts.js';

export type KernelExportEvent={
 id:string;tenant_id:string;user_id:string;event_type:string;
 event_version:number;aggregate_type:string;aggregate_id:string;
 data:Record<string,unknown>;created_at:string;correlation_id:string;
};
export type KernelEnvelope={
 event_id:string;source_engine:'nutrition-os';schema_version:1;event_type:string;
 subject_id:string;tenant_id:string;occurred_at:string;correlation_id:string;
 data:Record<string,unknown>;
};
const allowed:Record<string,KernelScope>={
 'nutrition.meal.logged':'nutrition.signal.publish',
 'nutrition.meal.corrected':'nutrition.signal.publish',
 'nutrition.meal.deleted':'nutrition.signal.publish',
 'nutrition.hydration.recorded':'nutrition.signal.publish',
 'nutrition.schedule.proposal.created':'nutrition.schedule.propose'
};
export function isExportable(type:string):boolean{return Object.hasOwn(allowed,type);}
function validEvent(x:KernelExportEvent,a:Actor){
 if(x.tenant_id!==a.tenantId||x.user_id!==a.userId)
  throw new ApiError(403,'OUTBOUND_SUBJECT_MISMATCH','Kernel export subject is not authorized.');
 if(x.event_version!==1||!isExportable(x.event_type))
  throw new ApiError(422,'KERNEL_EXPORT_UNSUPPORTED','Event is not on the minimal Kernel allowlist.');
}
export async function prepareKernelEnvelope(db:SqlClient,a:Actor,event:KernelExportEvent):Promise<KernelEnvelope>{
 validEvent(event,a);
 await requireGrant(db,a,allowed[event.event_type]);
 // Do not backfill any observations from before the current consent assertion.
 const grant=(await db.query('SELECT b.asserted_at,g.updated_at FROM nutrition.kernel_binding b '+
 'JOIN nutrition.kernel_grant g ON g.tenant_id=b.tenant_id AND g.user_id=b.user_id '+
 'WHERE b.tenant_id=$1 AND b.user_id=$2 AND g.scope=$3',
 [a.tenantId,a.userId,allowed[event.event_type]])).rows[0];
 if(!grant||new Date(event.created_at).getTime()<Math.max(Date.parse(grant.asserted_at),Date.parse(grant.updated_at)))
  throw new ApiError(403,'HISTORICAL_EXPORT_DENIED','Events preceding the current signed consent are not exportable.');
 let kind:string;
 let payload:Record<string,unknown>;
 if(event.event_type.startsWith('nutrition.meal.')){
  const row=(await db.query('SELECT consumed_on FROM nutrition.meal WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
   [a.tenantId,a.userId,event.aggregate_id])).rows[0];
  if(!row)throw new ApiError(404,'OBSERVATION_NOT_FOUND','Meal event no longer has an owned observation.');
  const day=new Date(row.consumed_on).toISOString().slice(0,10);
  const sums=(await db.query('SELECT count(*)::int AS count,COALESCE(sum(energy_kcal),0) AS energy,COALESCE(sum(protein_g),0) AS protein '+
   'FROM nutrition.meal WHERE tenant_id=$1 AND user_id=$2 AND consumed_on=$3 AND deleted_at IS NULL',
   [a.tenantId,a.userId,day])).rows[0];
  kind='nutrition.observed_meals_changed.v1';
  payload={date:day,observed_meals:sums.count,
   logged_energy_kcal:sums.count?Number(sums.energy):null,
   logged_protein_g:sums.count?Number(sums.protein):null,
   incomplete_logs_are_unknown:true,verified_nutrient_source:false};
 }else if(event.event_type==='nutrition.hydration.recorded'){
  const day=event.data.date;
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))
   throw new ApiError(422,'HYDRATION_DAY_UNKNOWN','Hydration event is missing an allowed day.');
  const row=(await db.query('SELECT observed_l FROM nutrition.hydration_day WHERE tenant_id=$1 AND user_id=$2 AND observed_on=$3',
   [a.tenantId,a.userId,day])).rows[0];
  if(!row)throw new ApiError(404,'HYDRATION_NOT_FOUND','No observed hydration value was found for this actor/day.');
  kind='nutrition.hydration_observed.v1';
  payload={date:day,observed_l:Number(row.observed_l),source:'explicit_user_record'};
 }else{
  const row=(await db.query('SELECT proposed_day,start_time,end_time,rationale_code,state FROM nutrition.kernel_schedule_proposal '+
   'WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
   [a.tenantId,a.userId,event.aggregate_id])).rows[0];
  if(!row||row.state!=='proposed')throw new ApiError(409,'PROPOSAL_NOT_PENDING','Only pending schedule proposals may be exported.');
  kind='nutrition.schedule_proposed.v1';
  payload={date:new Date(row.proposed_day).toISOString().slice(0,10),
    start_time:row.start_time,end_time:row.end_time,reason_code:row.rationale_code,proposal_id:event.aggregate_id,
    intent_only:true,no_global_calendar_write:true};
 }
 return {
  event_id:event.id,source_engine:'nutrition-os',schema_version:1,event_type:kind,
  subject_id:a.userId,tenant_id:a.tenantId,occurred_at:new Date(event.created_at).toISOString(),
  correlation_id:event.correlation_id,data:payload
 };
}
export type ApprovedKernelTransport=(event:KernelEnvelope)=>Promise<void>;
export async function publishWithApprovedTransport(db:SqlClient,a:Actor,event:KernelExportEvent,
 transport:ApprovedKernelTransport):Promise<KernelEnvelope>{
 const frame=await prepareKernelEnvelope(db,a,event);
 await transport(frame);
 return frame;
}
