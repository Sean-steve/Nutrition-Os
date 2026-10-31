/** HOS governs lifecycle/consent; Nutrition OS owns only its scoped cache. */
import type {SqlClient} from '../db.js';
import type {Actor} from '../auth.js';
import {ApiError} from '../auth.js';
import {recordChange} from '../events.js';
import {kernelScopes,validLease,type KernelScope,type kernelAuthority,type scheduleProposal} from './contracts.js';
import type {z} from 'zod';
import type {BridgeActor} from './identity.js';

type Subject=Actor|BridgeActor;
const own=(a:Subject)=>[a.tenantId,a.userId];
const fail=(code:string,reason:string,status=403)=>new ApiError(status,code,reason);
const active=(state:string)=>state==='RUNNING'||state==='ENABLED';
const providerScope={fitness:'nutrition.context.fitness',finance:'nutrition.context.finance',
 calendar:'nutrition.context.calendar',health:'nutrition.context.health'} as const;
async function audit(db:SqlClient,a:Subject,action:string,corr:string,id:string|null=null){
 await db.query('INSERT INTO nutrition.audit_event(tenant_id,user_id,action,resource,resource_id,correlation_id) VALUES($1,$2,$3,$4,$5,$6)',
 [...own(a),action,'kernel_binding',id,corr]);
}
async function findBinding(db:SqlClient,a:Subject){
 return (await db.query('SELECT * FROM nutrition.kernel_binding WHERE tenant_id=$1 AND user_id=$2',own(a))).rows[0]??null;
}
export async function requireGrant(db:SqlClient,a:Subject,scope:KernelScope){
 const row=(await db.query(
 'SELECT b.engine_state,b.lease_expires_at,g.granted,g.lease_expires_at AS consent_expiry '+
 'FROM nutrition.kernel_binding b JOIN nutrition.kernel_grant g ON g.tenant_id=b.tenant_id AND g.user_id=b.user_id '+
 'WHERE b.tenant_id=$1 AND b.user_id=$2 AND g.scope=$3',
 [...own(a),scope])).rows[0];
 if(!row||!active(row.engine_state)||Date.parse(row.lease_expires_at)<=Date.now()||
   !row.granted||Date.parse(row.consent_expiry)<=Date.now())
  throw fail('KERNEL_CONSENT_REQUIRED','An operational, current Kernel lifecycle and explicit consent are required for '+scope+'.');
}
export async function getStatus(db:SqlClient,a:Actor,configured:boolean){
 const b=await findBinding(db,a);
 const grants=(await db.query('SELECT scope,granted,lease_expires_at FROM nutrition.kernel_grant WHERE tenant_id=$1 AND user_id=$2',own(a))).rows;
 const on=Boolean(b&&active(b.engine_state)&&Date.parse(b.lease_expires_at)>Date.now());
 return {engineId:'nutrition-os',bridgeConfigured:configured,authorityPresent:Boolean(b),
  engineState:b?.engine_state??'UNREGISTERED',active:on,authorityExpiresAt:b?.lease_expires_at??null,
  grants:kernelScopes.map(scope=>{
   const g=grants.find(v=>v.scope===scope);
   return {scope,granted:Boolean(on&&g?.granted&&Date.parse(g.lease_expires_at)>Date.now()),expiresAt:g?.lease_expires_at??null};
  }),
  liveKernelTransportConnected:false,
  notice:'A signed authority cache does not prove the independent HOS endpoints have been deployed.'
 };
}
export async function assertAuthority(db:SqlClient,a:BridgeActor,v:z.infer<typeof kernelAuthority>){
 if(!validLease(v.assertedAt,v.expiresAt))
  throw fail('INVALID_AUTHORITY_LEASE','Assertion must be recent and expire in at most 24 hours.',422);
 if(!active(v.engineState)&&v.grants.some(g=>g.granted))
  throw fail('INACTIVE_ENGINE_GRANT','Suspended or disabled engines cannot carry active grants.',422);
 const old=await findBinding(db,a);
 if(old){
  const issued=Date.parse(v.assertedAt),prior=Date.parse(old.asserted_at);
  if(issued<prior ||(issued===prior&&old.assertion_id!==v.assertionId))
   throw fail('STALE_KERNEL_AUTHORITY','Stale signed assertions cannot restore revoked consent.',409);
  if(old.assertion_id===v.assertionId)return {applied:false,duplicate:true,engineState:old.engine_state};
 }
 await db.query('INSERT INTO nutrition.kernel_binding(tenant_id,user_id,engine_state,assertion_id,asserted_at,lease_expires_at) '+
 'VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,user_id) DO UPDATE SET '+
 'engine_state=EXCLUDED.engine_state,assertion_id=EXCLUDED.assertion_id,asserted_at=EXCLUDED.asserted_at,'+
 'lease_expires_at=EXCLUDED.lease_expires_at,updated_at=now()',
 [...own(a),v.engineState,v.assertionId,v.assertedAt,v.expiresAt]);
 await db.query('DELETE FROM nutrition.kernel_grant WHERE tenant_id=$1 AND user_id=$2',own(a));
 for(const g of v.grants){
  await db.query('INSERT INTO nutrition.kernel_grant(tenant_id,user_id,scope,granted,lease_expires_at,assertion_id) VALUES($1,$2,$3,$4,$5,$6)',
  [...own(a),g.scope,g.granted,v.expiresAt,v.assertionId]);
 }
 const allowed=new Set(v.grants.filter(g=>g.granted&&active(v.engineState)).map(g=>g.scope));
 for(const [provider,scope] of Object.entries(providerScope)){
  if(!allowed.has(scope as KernelScope))
   await db.query('DELETE FROM nutrition.kernel_projection WHERE tenant_id=$1 AND user_id=$2 AND provider=$3',[...own(a),provider]);
 }
 if(!allowed.has('nutrition.context.family'))
  await db.query('DELETE FROM nutrition.kernel_family_attestation WHERE tenant_id=$1 AND user_id=$2',own(a));
 if(!allowed.has('nutrition.schedule.propose'))
  await db.query("UPDATE nutrition.kernel_schedule_proposal SET state='revoked',decided_at=now() WHERE tenant_id=$1 AND user_id=$2 AND state='proposed'",own(a));
 await audit(db,a,'kernel.authority_asserted',v.assertionId);
 return {applied:true,duplicate:false,engineState:v.engineState,authorityExpiresAt:v.expiresAt,activeGrants:[...allowed].sort()};
}
export async function getContext(db:SqlClient,a:Actor){
 const b=await findBinding(db,a);
 if(!b||!active(b.engine_state)||Date.parse(b.lease_expires_at)<=Date.now())
  return {context:{},sources:[],notice:'No active Kernel authority; no external context.'};
 const grants=(await db.query('SELECT scope FROM nutrition.kernel_grant WHERE tenant_id=$1 AND user_id=$2 AND granted AND lease_expires_at>now()',own(a))).rows.map(x=>x.scope);
 const allowed=new Set(grants);
 const rows=(await db.query('SELECT provider,signal_key,signal_value,observed_at,expires_at FROM nutrition.kernel_projection '+
 'WHERE tenant_id=$1 AND user_id=$2 AND expires_at>now()',own(a))).rows;
 const context:Record<string,{key:string;value:unknown;observedAt:string;expiresAt:string}>={};
 for(const v of rows){
  const scope=providerScope[v.provider as keyof typeof providerScope];
  if(scope&&allowed.has(scope))context[v.provider]={key:v.signal_key,value:v.signal_value,observedAt:v.observed_at,expiresAt:v.expires_at};
 }
 return {context,sources:Object.keys(context).sort(),
  notice:'Projections are minimal, consented and time-limited. Other engines remain the authorities for their original records.'};
}
export async function getProposals(db:SqlClient,a:Actor){
 return (await db.query('SELECT id,source_plan_id,proposed_day,start_time,end_time,rationale_code,state,kernel_decision_id,created_at,decided_at '+
 'FROM nutrition.kernel_schedule_proposal WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 80',own(a))).rows;
}
export async function addProposal(db:SqlClient,a:Actor,v:z.infer<typeof scheduleProposal>,corr:string){
 await requireGrant(db,a,'nutrition.schedule.propose');
 const plan=(await db.query('SELECT week_start,status FROM nutrition.meal_plan WHERE tenant_id=$1 AND user_id=$2 AND id=$3',
 [...own(a),v.planId])).rows[0];
 if(!plan||plan.status!=='approved')throw fail('PLAN_NOT_APPROVED','An approved owned plan is required.',409);
 const start=Date.parse(new Date(plan.week_start).toISOString().slice(0,10)+'T12:00:00Z');
 const day=Date.parse(v.day+'T12:00:00Z');
 if(day<start||day>start+6*86400000)throw fail('DATE_OUTSIDE_PLAN','Schedule proposals must belong to the approved plan week.',422);
 const row=(await db.query('INSERT INTO nutrition.kernel_schedule_proposal '+
 '(tenant_id,user_id,source_plan_id,proposed_day,start_time,end_time,rationale_code) '+
 'VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
 [...own(a),v.planId,v.day,v.startTime,v.endTime,v.reason])).rows[0];
 await recordChange(db,a,{type:'nutrition.schedule.proposal.created',
  aggregate:'kernel_schedule_proposal',id:row.id,action:'kernel.schedule_proposal_created',
  correlationId:corr,metadata:{reason:v.reason,day:v.day}});
 return {...row,notice:'Pending proposal only; HumanKernelOS is the authoritative Daily Operating Plan.'};
}
export {audit};
