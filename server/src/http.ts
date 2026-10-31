/** Versioned HTTP API. Every read/write runs in a tenant/user RLS transaction. */
import {createHash,randomUUID} from 'node:crypto';
import Fastify,{type FastifyRequest} from 'fastify';
import cors from '@fastify/cors';
import {z,ZodError} from 'zod';
import type {Pool} from 'pg';
import type {Config} from './config.js';
import type {Actor} from './auth.js';
import {ApiError,requireScope,verifyActor} from './auth.js';
import {scopedTransaction,type SqlClient} from './db.js';
import {
  budgetInput,dateSchema,entryInput,foodInput,goalInput,groceryPaid,groceryPrices,
  lotInput,mealInput,moveInput,planInput,profileInput,receiveInput,recipeInput,servings,uuid
} from './domain.js';
import {getFoods,ownedFood,putFood,getProfile,putProfile,getGoals,putGoal,getRecipes,putRecipe} from './services/foods.js';
import {createMeal,listMeals,getMeal,correctMeal,deleteMeal,observedState} from './services/meals.js';
import {listPlans,createPlan,createPlanEntry,deletePlanEntry,setPlanStatus,updatePlanEntryLock} from './services/plans.js';
import {getInventory,createLot,moveStock,transferStock,getBudget,putBudget,getGroceries,generateGroceries,recordPurchase,receiveGrocery} from './services/resources.js';
import {reviseFood,retireFood,reviseRecipe,retireRecipe,getWater,putWater,progress,newGroceryList,manualGroceryLine,editGroceryLine,deleteGroceryLine,stockMovements,
  reviseFoodInput,reviseRecipeInput,dailyWaterInput,datesInput,manualLineInput,lineEditInput} from './services/live.js';
import {getSharedBoard,createHousehold,inviteMember,acceptInvite,changeRole,sharePlan,saveTask,addSharedGrocery,checkSharedGrocery,
 householdCreate,memberInvite,memberRoleUpdate,householdTaskInput,householdGroceryInput,groceryCheckedInput,houseId,houseMemberId,houseItemId,sharePlanInput,acceptInviteInput
} from './services/household.js';
import {kernelAuthority,kernelEvent,scheduleProposal} from './kernel/contracts.js';
import {verifyKernelBridge,bridgeConfigured} from './kernel/identity.js';
import {assertAuthority,getStatus,getContext,getProposals,addProposal} from './kernel/services.js';
import {consumeKernelEvent} from './kernel/inbound.js';

declare module 'fastify' {interface FastifyRequest {nutritionActor?:Actor;}}
type Response={status:number;body:unknown};
const paramsId=z.object({id:uuid});
const paramsEntry=z.object({id:uuid,entryId:uuid});
const version='/api/v1/nutrition';
function actorOf(req:FastifyRequest):Actor{
  if(!req.nutritionActor)throw new ApiError(401,'UNAUTHENTICATED','Verified identity required.');
  return req.nutritionActor;
}
function correlation(req:FastifyRequest):string{
  const candidate=req.headers['x-correlation-id'];
  return typeof candidate==='string'&&uuid.safeParse(candidate).success?candidate:randomUUID();
}
function parse<T extends z.ZodTypeAny>(schema:T,value:unknown):z.infer<T>{return schema.parse(value);}
async function read<T>(pool:Pool,req:FastifyRequest,scope:string,fn:(db:SqlClient,a:Actor)=>Promise<T>):Promise<T>{
  const a=actorOf(req);requireScope(a,scope);return scopedTransaction(pool,a,db=>fn(db,a));
}
function canonical(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object'){
    return '{'+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b))
      .map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  }
  return JSON.stringify(value)??'null';
}
async function mutate(pool:Pool,req:FastifyRequest,scope:string,fn:(db:SqlClient,a:Actor,corr:string)=>Promise<unknown>,status=201):Promise<Response>{
  const a=actorOf(req);requireScope(a,scope);
  const raw=req.headers['idempotency-key'];
  if(typeof raw!=='string'||!/^[A-Za-z0-9._-]{8,120}$/.test(raw))throw new ApiError(428,'IDEMPOTENCY_REQUIRED','Provide an Idempotency-Key of 8–120 safe characters.');
  const method=req.method,path=req.url.split('?')[0],digest=createHash('sha256').update(canonical(req.body??null)).digest('hex');
  return scopedTransaction(pool,a,async db=>{
    const ins=await db.query('INSERT INTO nutrition.idempotency_receipt(tenant_id,user_id,method,path,idempotency_key,request_sha256) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING idempotency_key',
      [a.tenantId,a.userId,method,path,raw,digest]);
    if(!ins.rows.length){
      const receipt=(await db.query('SELECT request_sha256,response_status,response_body FROM nutrition.idempotency_receipt WHERE tenant_id=$1 AND user_id=$2 AND method=$3 AND path=$4 AND idempotency_key=$5 FOR UPDATE',
        [a.tenantId,a.userId,method,path,raw])).rows[0];
      if(!receipt||receipt.request_sha256!==digest)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This key has already been used with different request content.');
      if(receipt.response_status!==null)return {status:receipt.response_status,body:receipt.response_body};
      throw new ApiError(409,'IDEMPOTENCY_IN_PROGRESS','Retry after the prior request commits.');
    }
    const result=await fn(db,a,correlation(req));
    const body={data:result};
    await db.query('UPDATE nutrition.idempotency_receipt SET response_status=$6,response_body=$7 WHERE tenant_id=$1 AND user_id=$2 AND method=$3 AND path=$4 AND idempotency_key=$5',
      [a.tenantId,a.userId,method,path,raw,status,JSON.stringify(body)]);
    return {status,body};
  });
}
export async function buildApp(opts:{pool:Pool;config:Config}){
  const {pool,config}=opts;
  const app=Fastify({logger:false,bodyLimit:1024*256,disableRequestLogging:true});
  await app.register(cors,{origin:config.corsOrigins.length?config.corsOrigins:false,credentials:false});
  // API endpoints carry private responses and must never be cached or framed.
  app.addHook('onSend',async (request,reply,payload)=>{
    reply.header('Cache-Control','no-store, private');
    reply.header('Pragma','no-cache');
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('Referrer-Policy','no-referrer');
    reply.header('X-Frame-Options','DENY');
    reply.header('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if(request.protocol==='https')reply.header('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    return payload;
  });
  app.setErrorHandler((error,req,reply)=>{
    let status=500,code='INTERNAL_ERROR',message='An unexpected error occurred.';
    if(error instanceof ApiError){status=error.statusCode;code=error.code;message=error.message;}
    else if(error instanceof ZodError){status=422;code='VALIDATION_ERROR';message='Request validation failed.';}
    else if(error!==null&&typeof error==='object'&&'code' in error){
      const pg=(error as {code?:string}).code;
      if(pg==='23505'){status=409;code='CONFLICT';message='This record already exists.';}
      else if(pg==='23514'||pg==='23503'){status=409;code='INTEGRITY_CONFLICT';message='The requested change violates an ownership or resource constraint.';}
    }
    // No database error details, JWT contents, nutrient/health payloads or stack traces in responses.
    reply.code(status).send({error:{code,message,correlationId:correlation(req)}});
  });
  app.addHook('onRequest',async req=>{
    const path=req.url.split('?')[0];
    const servicePath=path===version+'/kernel/authority'||path===version+'/kernel/events';
    if(path.startsWith(version+'/')&&!servicePath)req.nutritionActor=await verifyActor(req,config);
  });
  app.get('/health/live',async()=>({status:'alive',service:'nutrition-os-api'}));
  app.get('/health/ready',async(_req,reply)=>{
    try{
      await pool.query('SELECT 1');
      // No migration-role privileges are granted to the HTTP pool.
      // Verify the schema signature with catalog lookups instead.
      const schema=await pool.query("SELECT " +
        "to_regclass('nutrition.profile') IS NOT NULL AS core,"+
        "to_regclass('nutrition.hydration_day') IS NOT NULL AS live,"+
        "to_regclass('nutrition.kernel_binding') IS NOT NULL AS kernel");
      if(!schema.rows[0]?.core||!schema.rows[0]?.live||!schema.rows[0]?.kernel)
        throw new Error('Required schema objects missing');
      return {status:'ready',database:true,migrations:true};
    }catch{
      reply.code(503);return {status:'unavailable',database:false,migrations:false};
    }
  });
  app.get(version+'/session',async req=>{
    const actor=actorOf(req);requireScope(actor,'nutrition:read');
    return {data:{userId:actor.userId,tenantId:actor.tenantId,
      scopes:[...actor.scopes].sort(),identitySource:config.localIdentityEnabled?'development_signed_token':'kernel_verified_jwks'}};
  });
  app.get(version+'/profile',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>getProfile(db,a))}));
  app.put(version+'/profile',async(req,reply)=>{
    const v=parse(profileInput,req.body);const r=await mutate(pool,req,'nutrition:profile:write',(db,a,c)=>putProfile(db,a,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.get(version+'/foods',async req=>{
    const q=parse(z.object({q:z.string().max(120).optional()}),req.query);
    return {data:await read(pool,req,'nutrition:read',(db,a)=>getFoods(db,a,q.q??''))};
  });
  app.get(version+'/foods/:id',async req=>{
    const {id}=parse(paramsId,req.params);
    return {data:await read(pool,req,'nutrition:read',(db,a)=>ownedFood(db,a,id))};
  });
  app.post(version+'/foods',async(req,reply)=>{
    const v=parse(foodInput,req.body);const r=await mutate(pool,req,'nutrition:foods:write',(db,a,c)=>putFood(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.get(version+'/recipes',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>getRecipes(db,a))}));
  app.post(version+'/recipes',async(req,reply)=>{
    const v=parse(recipeInput,req.body);const r=await mutate(pool,req,'nutrition:recipes:write',(db,a,c)=>putRecipe(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.get(version+'/goals',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>getGoals(db,a))}));
  app.post(version+'/goals',async(req,reply)=>{
    const v=parse(goalInput,req.body);const r=await mutate(pool,req,'nutrition:goals:write',(db,a,c)=>putGoal(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.get(version+'/meals',async req=>{
    const q=parse(z.object({date:dateSchema.optional()}),req.query);
    return {data:await read(pool,req,'nutrition:read',(db,a)=>listMeals(db,a,q.date??null))};
  });
  app.get(version+'/meals/:id',async req=>{
    const {id}=parse(paramsId,req.params);return {data:await read(pool,req,'nutrition:read',(db,a)=>getMeal(db,a,id))};
  });
  app.post(version+'/meals',async(req,reply)=>{
    const v=parse(mealInput,req.body);const r=await mutate(pool,req,'nutrition:meals:write',(db,a,c)=>createMeal(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.put(version+'/meals/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);
    const v=parse(mealInput.extend({expectedRevision:z.number().int().positive()}),req.body);
    const {expectedRevision,...input}=v;
    const r=await mutate(pool,req,'nutrition:meals:write',(db,a,c)=>correctMeal(db,a,id,input,expectedRevision,c),200);
    return reply.code(r.status).send(r.body);
  });
  app.delete(version+'/meals/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const r=await mutate(pool,req,'nutrition:meals:write',(db,a,c)=>deleteMeal(db,a,id,c),200);
    return reply.code(r.status).send(r.body);
  });
  app.get(version+'/state',async req=>{
    const q=parse(z.object({date:dateSchema}),req.query);
    return {data:await read(pool,req,'nutrition:read',(db,a)=>observedState(db,a,q.date))};
  });
  app.get(version+'/insights',async req=>{
    const q=parse(z.object({date:dateSchema}),req.query);
    const state=await read(pool,req,'nutrition:read',(db,a)=>observedState(db,a,q.date));
    return {data:{date:q.date,kind:state.observedMeals?'observation':'missing_data',state,
      explanation:state.observedMeals?'Only explicitly logged nutrients were summed; incomplete intake remains unknown.':'No meals recorded; no deficiency or zero-intake inference.',
      provenance:'unverified_user_food_snapshots',confidence:'limited'}};
  });
  app.get(version+'/plans',async req=>{
    const q=parse(z.object({weekStart:dateSchema.optional()}),req.query);
    return {data:await read(pool,req,'nutrition:read',(db,a)=>listPlans(db,a,q.weekStart??null))};
  });
  app.post(version+'/plans',async(req,reply)=>{
    const v=parse(planInput,req.body);const r=await mutate(pool,req,'nutrition:plans:write',(db,a,c)=>createPlan(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.post(version+'/plans/:id/entries',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const v=parse(entryInput,req.body);
    const r=await mutate(pool,req,'nutrition:plans:write',(db,a,c)=>createPlanEntry(db,a,id,v,c));return reply.code(r.status).send(r.body);
  });
  app.delete(version+'/plans/:id/entries/:entryId',async(req,reply)=>{
    const {id,entryId}=parse(paramsEntry,req.params);
    const r=await mutate(pool,req,'nutrition:plans:write',(db,a,c)=>deletePlanEntry(db,a,id,entryId,c),200);
    return reply.code(r.status).send(r.body);
  });
  app.patch(version+'/plans/:id/entries/:entryId/lock',async(req,reply)=>{
    const {id,entryId}=parse(paramsEntry,req.params);const v=parse(z.object({locked:z.boolean()}).strict(),req.body);
    const r=await mutate(pool,req,'nutrition:plans:write',(db,a,c)=>updatePlanEntryLock(db,a,id,entryId,v.locked,c),200);return reply.code(r.status).send(r.body);
  });
  app.post(version+'/plans/:id/approve',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const r=await mutate(pool,req,'nutrition:plans:write',(db,a,c)=>setPlanStatus(db,a,id,'approved',c),200);return reply.code(r.status).send(r.body);
  });
  app.post(version+'/plans/:id/reopen',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const r=await mutate(pool,req,'nutrition:plans:write',(db,a,c)=>setPlanStatus(db,a,id,'draft',c),200);return reply.code(r.status).send(r.body);
  });
  app.get(version+'/inventory',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>getInventory(db,a))}));
  app.post(version+'/inventory/lots',async(req,reply)=>{
    const v=parse(lotInput,req.body);const r=await mutate(pool,req,'nutrition:inventory:write',(db,a,c)=>createLot(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.post(version+'/inventory/movements',async(req,reply)=>{
    const v=parse(moveInput,req.body);const r=await mutate(pool,req,'nutrition:inventory:write',(db,a,c)=>moveStock(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.post(version+'/inventory/transfers',async(req,reply)=>{
    const v=parse(z.object({sourceLotId:uuid,destination:z.enum(['Pantry','Fridge','Freezer']),servings,happenedOn:dateSchema}).strict(),req.body);
    const r=await mutate(pool,req,'nutrition:inventory:write',(db,a,c)=>transferStock(db,a,v.sourceLotId,v.destination,v.servings,v.happenedOn,c));
    return reply.code(r.status).send(r.body);
  });
  app.get(version+'/budget',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>getBudget(db,a))}));
  app.put(version+'/budget',async(req,reply)=>{
    const v=parse(budgetInput,req.body);const r=await mutate(pool,req,'nutrition:budget:write',(db,a,c)=>putBudget(db,a,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.get(version+'/groceries',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>getGroceries(db,a))}));
  app.post(version+'/groceries/generate',async(req,reply)=>{
    const v=parse(groceryPrices,req.body);
    const r=await mutate(pool,req,'nutrition:groceries:write',(db,a,c)=>generateGroceries(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.put(version+'/groceries/lines/:id/purchase',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const v=parse(groceryPaid,req.body);
    const r=await mutate(pool,req,'nutrition:groceries:write',(db,a,c)=>recordPurchase(db,a,id,v.purchased,v.actualPaidKes,c),200);
    return reply.code(r.status).send(r.body);
  });
  app.post(version+'/groceries/lines/:id/receive',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const v=parse(receiveInput,req.body);
    const r=await mutate(pool,req,'nutrition:groceries:write',(db,a,c)=>receiveGrocery(db,a,id,v,c));
    return reply.code(r.status).send(r.body);
  });
  // Phase 6: full authenticated frontend integration endpoints.
  app.put(version+'/foods/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params),v=parse(reviseFoodInput,req.body);
    const r=await mutate(pool,req,'nutrition:foods:write',(db,a,c)=>reviseFood(db,a,id,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.delete(version+'/foods/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const r=await mutate(pool,req,'nutrition:foods:write',(db,a,c)=>retireFood(db,a,id,c),200);return reply.code(r.status).send(r.body);
  });
  app.put(version+'/recipes/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params),v=parse(reviseRecipeInput,req.body);
    const r=await mutate(pool,req,'nutrition:recipes:write',(db,a,c)=>reviseRecipe(db,a,id,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.delete(version+'/recipes/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);const r=await mutate(pool,req,'nutrition:recipes:write',(db,a,c)=>retireRecipe(db,a,id,c),200);return reply.code(r.status).send(r.body);
  });
  app.get(version+'/hydration',async req=>{
    const v=parse(z.object({date:dateSchema}).strict(),req.query);
    return {data:await read(pool,req,'nutrition:read',(db,a)=>getWater(db,a,v.date))};
  });
  app.put(version+'/hydration',async(req,reply)=>{
    const v=parse(dailyWaterInput,req.body);
    const r=await mutate(pool,req,'nutrition:hydration:write',(db,a,c)=>putWater(db,a,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.get(version+'/progress',async req=>{
    const v=parse(datesInput,req.query);
    return {data:await read(pool,req,'nutrition:read',(db,a)=>progress(db,a,v.from,v.to))};
  });
  app.get(version+'/inventory/movements',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>stockMovements(db,a))}));
  app.post(version+'/groceries/lists',async(req,reply)=>{
    parse(z.object({}).strict(),req.body);
    const r=await mutate(pool,req,'nutrition:groceries:write',(db,a,c)=>newGroceryList(db,a,c));return reply.code(r.status).send(r.body);
  });
  app.post(version+'/groceries/lines',async(req,reply)=>{
    const v=parse(manualLineInput,req.body);
    const r=await mutate(pool,req,'nutrition:groceries:write',(db,a,c)=>manualGroceryLine(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.put(version+'/groceries/lines/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params),v=parse(lineEditInput,req.body);
    const r=await mutate(pool,req,'nutrition:groceries:write',(db,a,c)=>editGroceryLine(db,a,id,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.delete(version+'/groceries/lines/:id',async(req,reply)=>{
    const {id}=parse(paramsId,req.params);
    const r=await mutate(pool,req,'nutrition:groceries:write',(db,a,c)=>deleteGroceryLine(db,a,id,c),200);return reply.code(r.status).send(r.body);
  });
  // Families: only sanitized shared logistics, never personal meal observations.
  app.get(version+'/family',async req=>({data:await read(pool,req,'nutrition:read',(db,a)=>getSharedBoard(db,a))}));
  app.post(version+'/family',async(req,reply)=>{
    const v=parse(householdCreate,req.body);const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>createHousehold(db,a,v,c));return reply.code(r.status).send(r.body);
  });
  app.post(version+'/family/:id/invites',async(req,reply)=>{
    const {id}=parse(houseId,req.params),v=parse(memberInvite,req.body);
    const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>inviteMember(db,a,id,v,c));return reply.code(r.status).send(r.body);
  });
  app.post(version+'/family/:id/accept',async(req,reply)=>{
    const {id}=parse(houseId,req.params);parse(acceptInviteInput,req.body);
    const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>acceptInvite(db,a,id,c),200);return reply.code(r.status).send(r.body);
  });
  app.patch(version+'/family/:id/members/:memberId',async(req,reply)=>{
    const {id,memberId}=parse(houseMemberId,req.params),v=parse(memberRoleUpdate,req.body);
    const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>changeRole(db,a,id,memberId,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.post(version+'/family/:id/share-plan',async(req,reply)=>{
    const {id}=parse(houseId,req.params),v=parse(sharePlanInput,req.body);
    const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>sharePlan(db,a,id,v.planId,c));return reply.code(r.status).send(r.body);
  });
  app.put(version+'/family/:id/tasks',async(req,reply)=>{
    const {id}=parse(houseId,req.params),v=parse(householdTaskInput,req.body);
    const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>saveTask(db,a,id,v,c),200);return reply.code(r.status).send(r.body);
  });
  app.post(version+'/family/:id/groceries',async(req,reply)=>{
    const {id}=parse(houseId,req.params),v=parse(householdGroceryInput,req.body);
    const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>addSharedGrocery(db,a,id,v,c));return reply.code(r.status).send(r.body);
  });
  app.patch(version+'/family/:id/groceries/:itemId',async(req,reply)=>{
    const {id,itemId}=parse(houseItemId,req.params),v=parse(groceryCheckedInput,req.body);
    const r=await mutate(pool,req,'nutrition:household:write',(db,a,c)=>checkSharedGrocery(db,a,id,itemId,v.checked,c),200);return reply.code(r.status).send(r.body);
  });
  // Phase 7 — independently verified Kernel service assertions and personal read models.
  app.get(version+'/kernel/status',async req=>({data:await read(pool,req,'nutrition:read',
    (db,a)=>getStatus(db,a,bridgeConfigured(config)))}));
  app.get(version+'/kernel/context',async req=>({data:await read(pool,req,'nutrition:read',
    (db,a)=>getContext(db,a))}));
  app.get(version+'/kernel/proposals',async req=>({data:await read(pool,req,'nutrition:read',
    (db,a)=>getProposals(db,a))}));
  app.post(version+'/kernel/proposals',async(req,reply)=>{
    const v=parse(scheduleProposal,req.body);
    const r=await mutate(pool,req,'nutrition:plans:write',(db,a,c)=>addProposal(db,a,v,c));
    return reply.code(r.status).send(r.body);
  });
  app.post(version+'/kernel/authority',async(req,reply)=>{
    const actor=await verifyKernelBridge(req,config,'nutrition:kernel:govern');
    const v=parse(kernelAuthority,req.body);
    const result=await scopedTransaction(pool,{...actor,scopes:actor.scopes},db=>assertAuthority(db,actor,v));
    return reply.code(200).send({data:result});
  });
  app.post(version+'/kernel/events',async(req,reply)=>{
    const actor=await verifyKernelBridge(req,config,'nutrition:kernel:event');
    const v=parse(kernelEvent,req.body);
    const result=await scopedTransaction(pool,{...actor,scopes:actor.scopes},db=>consumeKernelEvent(db,actor,v));
    return reply.code(result.duplicate?200:202).send({data:result});
  });
  return app;
}
