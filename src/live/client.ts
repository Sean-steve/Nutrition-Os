/** Phase 6 Nutrition OS HTTP transport.
 *  JWT is MEMORY ONLY; no cookies, localStorage, URL token, or demo fallback.
 *  All writes are explicitly authorized by the signed-in actor on the server.
 */
export type Session={userId:string;tenantId:string;scopes:string[];identitySource:string};
export type ServerFood={id:string;name:string;serving_label:string;energy_kcal:string|number;protein_g:string|number;carbs_g:string|number;fat_g:string|number;source:string;verified:boolean;revision:number;deleted_at?:string|null};
export type ServerIngredient={food_id:string;servings:string|number;recipe_id?:string};
export type ServerRecipe={id:string;name:string;yield_servings:string|number;prep_minutes:number;instructions:string;version:number;ingredients:ServerIngredient[]};
export type ServerMeal={id:string;consumed_on:string;slot:'Breakfast'|'Lunch'|'Snack'|'Dinner';name:string;note:string;energy_kcal:string|number;protein_g:string|number;carbs_g:string|number;fat_g:string|number;revision:number;items?:ServerMealItem[]};
export type ServerMealItem={id:string;food_id:string;servings:string|number;snapshot_name:string;snapshot_serving_label:string;snapshot_source:string;snapshot_energy_kcal:string|number;snapshot_protein_g:string|number;snapshot_carbs_g:string|number;snapshot_fat_g:string|number};
export type ServerGoal={id:string;metric:string;target:string|number;unit:string;effective_from:string;effective_to:string|null};
export type ServerProfile={display_name:string;diet_style:string;excluded_foods:string;preferences:Record<string,unknown>;targets:Record<string,number>;updated_at:string};
export type ServerPlanEntry={id:string;planned_on:string;slot:ServerMeal['slot'];recipe_id:string;portions:string|number;locked:boolean};
export type ServerPlan={id:string;week_start:string;status:'draft'|'approved';revision:number;entries:ServerPlanEntry[]};
export type ServerLot={id:string;food_id:string;location:'Pantry'|'Fridge'|'Freezer';acquired_on:string;expires_on:string|null;unit_cost_kes:string|number;balance:string|number};
export type ServerMovement={id:string;lot_id:string;happened_on:string;kind:string;delta_servings:string|number;note:string;created_at:string};
export type ServerGroceryLine={id:string;food_id:string;quantity_servings:string|number;unit_price_kes:string|number;needed_servings:string|number;stock_offset_servings:string|number;purchased:boolean;actual_paid_kes:string|number|null;received:boolean;source:'plan'|'manual'};
export type ServerGroceryList={id:string;source_plan_id:string|null;source_plan_revision:number|null;status:'active'|'archived';created_at:string;lines:ServerGroceryLine[]};
export type BudgetResult={allocation:{amount_kes:string|number}|null;explicitRecordedPaidKes:number;source:string};
export type WaterDay={date:string;observedL:number|null;revision:number|null};
export type Observation={date:string;loggedMeals:number;energyKcal:number;proteinG:number;carbsG:number;fatG:number};
export type HistoryResult={from:string;to:string;observations:Observation[];hydration:{date:string;observedL:number}[];missingDates:'unknown';disclaimer:string};
export type StateResult={date:string;observedMeals:number;observationStatus:'unknown'|'partial_recorded';intake:{energyKcal:number;proteinG:number;carbsG:number;fatG:number}|null;disclaimer:string};
export type InsightResult={date:string;kind:'observation'|'missing_data';state:StateResult;explanation:string;provenance:string;confidence:'limited'};
export type FamilyMember={member_user_id:string;alias:string;role:'editor'|'viewer';state:'invited'|'accepted'};
export type SharedMeal={id:string;meal_date:string;slot:ServerMeal['slot'];title:string;portions:string|number};
export type SharedTask={id:string;meal_id:string;assigned_user_id:string;note:string;status:'planned'|'preparing'|'completed'};
export type SharedGrocery={id:string;title:string;quantity:string;estimate_kes:string|number;checked:boolean};
export type HouseholdBoard={id:string;name:string;role:'owner'|'editor'|'viewer';ownerUserId:string;members:FamilyMember[];meals:SharedMeal[];tasks:SharedTask[];groceries:SharedGrocery[]};
export type FamilyResult={boards:HouseholdBoard[];invites:{household_id:string;owner_user_id:string;alias:string;role:'editor'|'viewer';state:'invited'}[];disclaimer:string};
export type LiveSnapshot={session:Session;profile:ServerProfile|null;foods:ServerFood[];recipes:ServerRecipe[];goals:ServerGoal[];
  meals:ServerMeal[];plans:ServerPlan[];inventory:ServerLot[];movements:ServerMovement[];groceries:ServerGroceryList[];
  budget:BudgetResult;water:WaterDay;progress:HistoryResult;state:StateResult;insight:InsightResult;family:FamilyResult};
export class LiveApiError extends Error{
 constructor(public status:number,public code:string,message:string,public correlationId:string|null){super(message);this.name='LiveApiError';}
}
export function apiOrigin():string{
  const url=(import.meta.env.VITE_NUTRITION_API_URL as string|undefined)?.trim()??'';
  if(!url)return '';
  const parsed=new URL(url);
  if(!['http:','https:'].includes(parsed.protocol))throw new Error('API protocol must be HTTPS or local HTTP.');
  // A public production frontend must never downgrade credentials to HTTP.
  if(parsed.protocol==='http:' && !['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))
    throw new Error('Nonlocal API endpoints must use HTTPS.');
  return parsed.origin+parsed.pathname.replace(/\/$/,'');
}
export function encodeQuery(q:Record<string,string>):string{
 const s=new URLSearchParams(q);return '?'+s.toString();
}
export function dateOnly(value:string):string {return value.slice(0,10);}
export const asNumber=(value:number|string|null|undefined)=>value===null||value===undefined?0:Number(value);
export const money=(value:number|string|null|undefined)=>'KES '+asNumber(value).toLocaleString('en-KE',{maximumFractionDigits:2});
export function newRequestKey():string{
  const cryptoAPI=globalThis.crypto;
  if(!cryptoAPI?.randomUUID)throw new Error('Secure browser randomUUID is required for idempotent writes.');
  return cryptoAPI.randomUUID();
}
export class NutritionClient {
 constructor(private token:string,private onUnauthorized:()=>void,private origin=apiOrigin()){}
 private async raw<T>(method:string,path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  const url=this.origin+'/api/v1/nutrition'+path;
  const response=await fetch(url,{method,signal,cache:'no-store',credentials:'omit',redirect:'error',
   headers:{'Authorization':'Bearer '+this.token,'Accept':'application/json',
    ...(body!==undefined?{'Content-Type':'application/json','Idempotency-Key':newRequestKey()}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  let parsed:unknown=null;
  try{parsed=await response.json();}catch{if(!response.ok)throw new LiveApiError(response.status,'BAD_RESPONSE','The service returned an unreadable response.',null);}
  if(!response.ok){
   const obj=parsed as {error?:{code?:string;message?:string;correlationId?:string}}|null;
   if(response.status===401)this.onUnauthorized();
   throw new LiveApiError(response.status,obj?.error?.code??'HTTP_ERROR',obj?.error?.message??'Unable to complete the request.',obj?.error?.correlationId??null);
  }
  if(typeof parsed!=='object'||parsed===null||!('data' in parsed))throw new LiveApiError(502,'INVALID_RESPONSE','Response did not match the Nutrition OS envelope.',null);
  return (parsed as {data:T}).data;
 }
 get<T>(path:string,signal?:AbortSignal):Promise<T>{return this.raw<T>('GET',path,undefined,signal);}
 post<T>(path:string,payload:unknown):Promise<T>{return this.raw<T>('POST',path,payload);}
 put<T>(path:string,payload:unknown):Promise<T>{return this.raw<T>('PUT',path,payload);}
 patch<T>(path:string,payload:unknown):Promise<T>{return this.raw<T>('PATCH',path,payload);}
 delete<T>(path:string):Promise<T>{return this.raw<T>('DELETE',path,{});}
 async load(date:string,signal?:AbortSignal):Promise<LiveSnapshot>{
  const till=date,from=new Date(date+'T12:00:00Z');
  from.setUTCDate(from.getUTCDate()-89);
  const start=from.toISOString().slice(0,10);
  const [session,profile,foods,recipes,goals,meals,plans,inventory,movements,groceries,budget,water,progress,state,insight,family]=await Promise.all([
    this.get<Session>('/session',signal),this.get<ServerProfile|null>('/profile',signal),this.get<ServerFood[]>('/foods',signal),
    this.get<ServerRecipe[]>('/recipes',signal),this.get<ServerGoal[]>('/goals',signal),this.get<ServerMeal[]>('/meals',signal),
    this.get<ServerPlan[]>('/plans',signal),this.get<ServerLot[]>('/inventory',signal),this.get<ServerMovement[]>('/inventory/movements',signal),
    this.get<ServerGroceryList[]>('/groceries',signal),this.get<BudgetResult>('/budget',signal),
    this.get<WaterDay>('/hydration'+encodeQuery({date}),signal),this.get<HistoryResult>('/progress'+encodeQuery({from:start,to:till}),signal),
    this.get<StateResult>('/state'+encodeQuery({date}),signal),this.get<InsightResult>('/insights'+encodeQuery({date}),signal),
    this.get<FamilyResult>('/family',signal)
  ]);
  return {session,profile,foods,recipes,goals,meals,plans,inventory,movements,groceries,budget,water,progress,state,insight,family};
 }
 clear(){this.token='';}
}
