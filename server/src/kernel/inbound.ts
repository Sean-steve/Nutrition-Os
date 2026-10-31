/** Source events are accepted only through verified short-lived Kernel service assertions.
 * The inbox and any projection change commit in one scoped DB transaction.
 * Receipts contain identifiers, never raw external health/finance/private messages.
 */
import {z} from 'zod';
import type {SqlClient} from '../db.js';
import type {BridgeActor} from './identity.js';
import {ApiError} from '../auth.js';
import {kernelInbound,validatedKernelEvent} from './contracts.js';
import {requireGrant,audit} from './services.js';

const own=(a:BridgeActor)=>[a.tenantId,a.userId];
const invalid=(code:string,message:string,status=422)=>new ApiError(status,code,message);
export async function consumeKernelEvent(db:SqlClient,a:BridgeActor,raw:unknown){
 const {event,contract,payload}=validatedKernelEvent(raw);
 const now=Date.now(),when=Date.parse(event.occurredAt);
 if(when>now+120000||when<now-7*86400000)
  throw invalid('KERNEL_EVENT_WINDOW','An inbound event must be from the last seven days, without future timestamps.');
 await requireGrant(db,a,contract.scope);
 // Never replay events from a prior consent epoch after Kernel renewed or revoked grants.
 const authority=(await db.query('SELECT asserted_at FROM nutrition.kernel_binding WHERE tenant_id=$1 AND user_id=$2',
  own(a))).rows[0];
 if(!authority||when<Date.parse(authority.asserted_at))
  throw invalid('KERNEL_EVENT_BEFORE_CONSENT','An external event cannot predate the current signed Kernel authority.',403);
 const insert=(await db.query('INSERT INTO nutrition.event_inbox '+
 '(tenant_id,user_id,source_event_id,source,event_type) VALUES($1,$2,$3,$4,$5) '+
 'ON CONFLICT DO NOTHING RETURNING id',
 [...own(a),event.eventId,'humankernelos-bridge',event.eventType])).rows[0];
 if(!insert)return {received:false,duplicate:true,eventId:event.eventId};
 if(event.eventType==='family.membership.attested'){
  const p=payload as z.infer<typeof kernelInbound['family.membership.attested']['schema']>;
  const member=(await db.query("SELECT role FROM nutrition.household_member WHERE tenant_id=$1 AND household_id=$2 AND member_user_id=$3 AND state='accepted'",
   [a.tenantId,p.householdId,a.userId])).rows[0];
  if(!member||member.role!==p.role)
   throw invalid('FAMILY_MEMBERSHIP_MISMATCH','Family assertion must match an accepted kitchen membership and role.',409);
  const expires=Math.min(Date.parse(p.expiresAt),Date.now()+24*3600000);
  if(p.active&&expires<=Date.now())throw invalid('FAMILY_ATTESTATION_EXPIRED','Active family membership requires future expiry.');
  await db.query('INSERT INTO nutrition.kernel_family_attestation '+
  '(tenant_id,user_id,household_id,role,active,expires_at,asserted_at,source_event_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) '+
  'ON CONFLICT(tenant_id,user_id,household_id) DO UPDATE SET role=EXCLUDED.role,active=EXCLUDED.active, '+
  'expires_at=EXCLUDED.expires_at,asserted_at=EXCLUDED.asserted_at,source_event_id=EXCLUDED.source_event_id,updated_at=now() ' +
  'WHERE EXCLUDED.asserted_at>nutrition.kernel_family_attestation.asserted_at ' +
  'OR (EXCLUDED.asserted_at=nutrition.kernel_family_attestation.asserted_at AND ' +
  'EXCLUDED.active=false AND nutrition.kernel_family_attestation.active=true)',
  [...own(a),p.householdId,p.role,p.active,new Date(Math.max(Date.now()+1000,expires)).toISOString(),event.occurredAt,event.eventId]);
 }else if(event.eventType==='kernel.plan.decision'){
  const p=payload as z.infer<typeof kernelInbound['kernel.plan.decision']['schema']>;
  const row=(await db.query('UPDATE nutrition.kernel_schedule_proposal SET state=$4,kernel_decision_id=$5,decided_at=now() '+
  "WHERE tenant_id=$1 AND user_id=$2 AND id=$3 AND state='proposed' RETURNING id",
  [...own(a),p.proposalId,p.decision,p.decisionId])).rows[0];
  if(!row)throw invalid('PROPOSAL_NOT_PENDING','Kernel cannot decide an absent, revoked or already decided proposal.',409);
 }else{
  let value:unknown;
  if(event.eventType==='fitness.workout.completed')
   value=(payload as z.infer<typeof kernelInbound['fitness.workout.completed']['schema']>).durationMinutes;
  else if(event.eventType==='finance.food_budget.headroom_changed')
   value=(payload as z.infer<typeof kernelInbound['finance.food_budget.headroom_changed']['schema']>).headroomKes;
  else if(event.eventType==='calendar.nutrition_window.changed')value=payload;
  else if(event.eventType==='health.nutrition_safety.changed')
   value=(payload as z.infer<typeof kernelInbound['health.nutrition_safety.changed']['schema']>).clinicalReviewRequired;
  else throw invalid('UNKNOWN_KERNEL_EVENT','This external context event is not supported.');
  const expires=when+contract.ttlHours*3600000;
  // Do not reassert stale context after its source-derived TTL.
  if(expires<=now)throw invalid('PROJECTION_STALE','The signed event is too old to represent current context.');
  const deadline=(await db.query('SELECT lease_expires_at FROM nutrition.kernel_binding WHERE tenant_id=$1 AND user_id=$2',own(a))).rows[0];
  const until=Math.min(expires,Date.parse(deadline.lease_expires_at));
  await db.query('INSERT INTO nutrition.kernel_projection '+
   '(tenant_id,user_id,provider,signal_key,signal_value,source_event_id,observed_at,expires_at) '+
   'VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,user_id,provider,signal_key) '+
   'DO UPDATE SET signal_value=EXCLUDED.signal_value,source_event_id=EXCLUDED.source_event_id, '+
   'observed_at=EXCLUDED.observed_at,expires_at=EXCLUDED.expires_at,updated_at=now() '+
   'WHERE EXCLUDED.observed_at>=nutrition.kernel_projection.observed_at',
   [...own(a),contract.provider,contract.key,JSON.stringify(value),event.eventId,event.occurredAt,new Date(until).toISOString()]);
 }
 await audit(db,a,'kernel.event_received',event.eventId);
 return {received:true,duplicate:false,eventId:event.eventId,eventType:event.eventType};
}
