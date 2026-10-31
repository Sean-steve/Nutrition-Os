/**
 * Narrow external bridge contract — no raw clinical records, financial ledgers,
 * meal narratives, credentials, household private metrics, or account secrets.
 *
 * HOS is the runtime/consent and Daily Operating Plan authority. This engine
 * only accepts assertions signed by the separately provisioned Kernel bridge.
 */
import {z} from 'zod';

export const kernelScope=z.enum([
 'nutrition.signal.publish','nutrition.schedule.propose',
 'nutrition.context.fitness','nutrition.context.finance',
 'nutrition.context.calendar','nutrition.context.health','nutrition.context.family'
]);
export type KernelScope=z.infer<typeof kernelScope>;
export const kernelScopes=kernelScope.options;
export const kernelState=z.enum([
 'REGISTERED','VALIDATED','ENABLED','RUNNING','SUSPENDED','DISABLED','UNINSTALLED'
]);
export const kernelAuthority=z.object({
 assertionId:z.string().uuid(),
 engineState:kernelState,
 assertedAt:z.string().datetime({offset:true}),
 expiresAt:z.string().datetime({offset:true}),
 grants:z.array(z.object({scope:kernelScope,granted:z.boolean()}).strict()).max(7)
}).strict().superRefine((v,ctx)=>{
 if(new Set(v.grants.map(g=>g.scope)).size!==v.grants.length)
  ctx.addIssue({code:z.ZodIssueCode.custom,message:'Duplicate consent scopes are forbidden.'});
});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
 .refine(v=>!Number.isNaN(Date.parse(v+'T12:00:00Z')) && new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v);
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const uuid=z.string().uuid();
const workout=z.object({durationMinutes:z.number().int().min(0).max(600)}).strict();
const finance=z.object({headroomKes:z.number().finite().min(-10000000).max(10000000),currency:z.literal('KES')}).strict();
const calendar=z.object({day:date,startTime:time,endTime:time}).strict()
 .refine(v=>v.startTime<v.endTime,'End time must follow start time.');
const clinical=z.object({clinicalReviewRequired:z.boolean()}).strict();
const family=z.object({householdId:uuid,role:z.enum(['editor','viewer']),
 active:z.boolean(),expiresAt:z.string().datetime({offset:true})}).strict();
const decision=z.object({proposalId:uuid,decisionId:uuid,decision:z.enum(['accepted','rejected'])}).strict();
export const kernelInbound={
 'fitness.workout.completed':{scope:'nutrition.context.fitness',provider:'fitness',key:'last_workout_duration_minutes',ttlHours:48,schema:workout},
 'finance.food_budget.headroom_changed':{scope:'nutrition.context.finance',provider:'finance',key:'food_budget_headroom_kes',ttlHours:24,schema:finance},
 'calendar.nutrition_window.changed':{scope:'nutrition.context.calendar',provider:'calendar',key:'next_meal_window',ttlHours:24,schema:calendar},
 'health.nutrition_safety.changed':{scope:'nutrition.context.health',provider:'health',key:'clinical_review_required',ttlHours:24,schema:clinical},
 'family.membership.attested':{scope:'nutrition.context.family',provider:'family',key:'household_membership',ttlHours:24,schema:family},
 'kernel.plan.decision':{scope:'nutrition.schedule.propose',provider:'kernel',key:'schedule_decision',ttlHours:24,schema:decision}
} as const;
export type KernelEventName=keyof typeof kernelInbound;
export const kernelEventName=z.enum(Object.keys(kernelInbound) as [KernelEventName,...KernelEventName[]]);
export const kernelEvent=z.object({
 eventId:uuid,eventType:kernelEventName,
 version:z.literal(1),
 occurredAt:z.string().datetime({offset:true}),
 payload:z.unknown()
}).strict();
export const scheduleProposal=z.object({
 planId:uuid,day:date,startTime:time,endTime:time,
 reason:z.enum(['meal_preparation','meal_break','grocery_trip'])
}).strict().refine(v=>v.startTime<v.endTime,'End time must follow start time.');
export function validatedKernelEvent(input:unknown){
 const result=kernelEvent.parse(input);
 const contract=kernelInbound[result.eventType];
 const payload=contract.schema.parse(result.payload);
 return {event:result,contract,payload};
}
export function validLease(assertedAt:string,expiresAt:string,maxHours=24,now=Date.now()):boolean{
 const issued=Date.parse(assertedAt),until=Date.parse(expiresAt);
 return Number.isFinite(issued)&&Number.isFinite(until)&&issued<=now+2*60*1000 &&
  issued>=now-5*60*1000&&until>now&&until-issued<=maxHours*3600000;
}
export const nutritionManifest={
 id:'nutrition-os',name:'Nutrition OS — External Engine',version:'1.0.0',
 purpose:'Own logged nutrition, planning, pantry, and explainable nutrition facts; emit governed, consented signals.',
 owner:'Nutrition OS',status:'inactive',
 capabilities:['nutrition.observation.read_v1','nutrition.schedule.propose_v1','nutrition.kitchen.shared_view_v1'],
 dataOwned:['nutrition_profiles','nutrition_meals','nutrition_foods','nutrition_recipes','nutrition_inventory','nutrition_plans'],
 eventsPublished:['nutrition.observed_meals_changed.v1','nutrition.hydration_observed.v1','nutrition.schedule_proposed.v1'],
 eventsConsumed:Object.keys(kernelInbound),
 publishedSignals:['nutrition.observed_meals_count','nutrition.logged_energy_kcal','nutrition.logged_protein_g'],
 requiredSignals:[],
 dependencies:[],
 permissions:{
  dataRequested:['nutrition.context.fitness','nutrition.context.finance','nutrition.context.calendar','nutrition.context.health','nutrition.context.family'],
  dataProvided:['nutrition.signal.publish','nutrition.schedule.propose'],
  dataProhibited:['health.raw_records','finance.transactions','family.private_member_records','kernel.human_state.write','kernel.daily_plan.write']
 }
} as const;
