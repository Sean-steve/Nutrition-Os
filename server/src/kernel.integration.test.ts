import {createServer,type Server} from 'node:http';
import {type AddressInfo} from 'node:net';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {Pool} from 'pg';
import {generateKeyPair,exportJWK,SignJWT,type CryptoKey} from 'jose';
import {buildApp} from './http.js';
import type {FastifyInstance} from 'fastify';
import {loadConfig} from './config.js';
import {signLocalToken} from './auth.js';
import {scopedTransaction} from './db.js';
import {prepareKernelEnvelope,type KernelExportEvent} from './kernel/outbound.js';

const tenantId=randomUUID(),ownerId=randomUUID(),memberId=randomUUID(),outsiderId=randomUUID();
const userScopes=['nutrition:read','nutrition:write'];
const now=()=>new Date().toISOString();
const future=(hours=1)=>new Date(Date.now()+hours*3600000).toISOString();
const root='/api/v1/nutrition';
const localSecret='nutrition-local-signing-secret-for-phase-seven-testing';
let httpServer:Server,jwksUrl:string,privateKey:CryptoKey;
let app:FastifyInstance,pool:Pool,privileged:Pool,userToken:string,memberToken:string,outsiderToken:string;
async function signedService(subject:string=ownerId,scope='nutrition:kernel:govern nutrition:kernel:event',aud='nutrition-kernel-bridge'){
 return new SignJWT({tenant_id:tenantId,client_id:'humankernelos-bridge',scope})
  .setProtectedHeader({alg:'RS256',kid:'kernel-ci-key'})
  .setIssuer('http://localhost/kernel-ci').setAudience(aud)
  .setSubject(subject).setJti(randomUUID()).setIssuedAt().setExpirationTime('2m')
  .sign(privateKey);
}
async function hit(jwt:string,method:'GET'|'POST'|'PUT'|'PATCH',route:string,body?:unknown,key?:string){
 const isBody=body!==undefined;
 const result=await app.inject({method,url:root+route,headers:{
  authorization:'Bearer '+jwt,...(method!=='GET'?{'idempotency-key':key??randomUUID()}:{}),
  ...(isBody?{'content-type':'application/json'}:{})
 },...(isBody?{payload:JSON.stringify(body)}:{})});
 return {status:result.statusCode,body:result.json() as any};
}
function authority(grants:{scope:string;granted:boolean}[],state='RUNNING'){
 return {assertionId:randomUUID(),engineState:state,assertedAt:now(),expiresAt:future(),grants};
}
const scopes=['nutrition.signal.publish','nutrition.schedule.propose','nutrition.context.fitness',
 'nutrition.context.finance','nutrition.context.calendar','nutrition.context.health','nutrition.context.family'];
let acceptedAuthority:ReturnType<typeof authority>;
beforeAll(async()=>{
 const pair=await generateKeyPair('RS256');privateKey=pair.privateKey;
 const pub={...(await exportJWK(pair.publicKey)),kid:'kernel-ci-key',use:'sig',alg:'RS256'};
 httpServer=createServer((_req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({keys:[pub]}));});
 await new Promise<void>(resolve=>httpServer.listen(0,'127.0.0.1',resolve));
 jwksUrl='http://127.0.0.1:'+(httpServer.address() as AddressInfo).port+'/jwks';
 const config=loadConfig({...process.env,NODE_ENV:'test',LOCAL_IDENTITY_ENABLED:'true',LOCAL_IDENTITY_SECRET:localSecret,
 KERNEL_BRIDGE_JWKS_URL:jwksUrl,KERNEL_BRIDGE_ISSUER:'http://localhost/kernel-ci',
 KERNEL_BRIDGE_AUDIENCE:'nutrition-kernel-bridge',DATABASE_URL:process.env.DATABASE_URL??'postgresql://localhost/nutrition_os'});
 pool=new Pool({connectionString:config.databaseUrl});
 privileged=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
 app=await buildApp({pool,config});
 userToken=await signLocalToken(config,{tenantId,userId:ownerId,scopes:userScopes});
 memberToken=await signLocalToken(config,{tenantId,userId:memberId,scopes:userScopes});
 outsiderToken=await signLocalToken(config,{tenantId,userId:outsiderId,scopes:userScopes});
});
afterAll(async()=>{
 delete process.env.KERNEL_FAMILY_AUTHORITY_REQUIRED;
 await app?.close();await pool?.end();await privileged?.end();
 await new Promise<void>(resolve=>httpServer.close(()=>resolve()));
});
describe('Phase 7 Kernel trust / consent / event bridge / schedule authority',()=>{
 let planId:string,householdId:string,proposalId:string,mealId:string;
 it('does not trust normal user JWT or forged service issuer/audience',async()=>{
  expect((await hit(userToken,'POST','/kernel/authority',authority([]))).status).toBe(401);
  expect((await hit(userToken,'POST','/kernel/events',{eventId:randomUUID(),eventType:'fitness.workout.completed',
   version:1,occurredAt:now(),payload:{durationMinutes:30}})).status).toBe(401);
  expect((await hit(await signedService(ownerId,undefined,'wrong-audience'),'POST','/kernel/authority',authority([]))).status).toBe(401);
  expect((await hit(await signedService(ownerId,'nutrition:kernel:govern'),'POST','/kernel/events',{})).status).toBe(403);
  const initial=await hit(userToken,'GET','/kernel/status');
  expect(initial.status).toBe(200);expect(initial.body.data.active).toBe(false);
  const noContext=await hit(userToken,'GET','/kernel/context');
  expect(noContext.body.data.sources).toEqual([]);
  expect((await hit(userToken,'POST','/kernel/proposals',{planId:randomUUID(),day:'2026-10-31',startTime:'12:00',
   endTime:'13:00',reason:'meal_break'})).status).toBe(403);
 });
 it('applies real signed lifecycle/consent without self-enabling and rejects duplicate/stale grants',async()=>{
  acceptedAuthority=authority(scopes.map(scope=>({scope,granted:true})));
  const service=await signedService();
  const applied=await hit(service,'POST','/kernel/authority',acceptedAuthority);
  expect(applied.status).toBe(200);expect(applied.body.data.applied).toBe(true);
  const dup=await hit(service,'POST','/kernel/authority',acceptedAuthority);
  expect(dup.status).toBe(200);expect(dup.body.data.duplicate).toBe(true);
  const status=await hit(userToken,'GET','/kernel/status');
  expect(status.body.data.active).toBe(true);expect(status.body.data.grants.every((g:any)=>g.granted)).toBe(true);
  expect((await hit(outsiderToken,'GET','/kernel/status')).body.data.active).toBe(false);
  const stale={...acceptedAuthority,assertionId:randomUUID(),assertedAt:new Date(Date.now()-60000).toISOString()};
  expect((await hit(service,'POST','/kernel/authority',stale)).status).toBe(409);
  expect((await hit(userToken,'POST','/kernel/authority',acceptedAuthority)).status).toBe(401);
 });
 it('only ingests strict event projections with signed consent and inbox deduplication',async()=>{
  const service=await signedService();
  const event={eventId:randomUUID(),eventType:'fitness.workout.completed',version:1,
   occurredAt:now(),payload:{durationMinutes:47}};
  const received=await hit(service,'POST','/kernel/events',event);
  expect(received.status).toBe(202);expect(received.body.data.received).toBe(true);
  expect((await hit(service,'POST','/kernel/events',event)).body.data.duplicate).toBe(true);
  expect((await hit(userToken,'GET','/kernel/context')).body.data.context.fitness.value).toBe(47);
  const wrong={...event,eventId:randomUUID(),payload:{durationMinutes:47,diagnosis:'private'}};
  expect((await hit(service,'POST','/kernel/events',wrong)).status).toBe(422);
  const finance={eventId:randomUUID(),eventType:'finance.food_budget.headroom_changed',version:1,
   occurredAt:now(),payload:{headroomKes:3700,currency:'KES'}};
  expect((await hit(service,'POST','/kernel/events',finance)).status).toBe(202);
  const health={eventId:randomUUID(),eventType:'health.nutrition_safety.changed',version:1,
   occurredAt:now(),payload:{clinicalReviewRequired:true}};
  expect((await hit(service,'POST','/kernel/events',health)).status).toBe(202);
  const context=(await hit(userToken,'GET','/kernel/context')).body.data;
  expect(context.context.finance.value).toBe(3700);
  expect(context.context.health.value).toBe(true);
  expect(JSON.stringify(context)).not.toMatch(/diagnosis|patient|bankAccount/);
  expect((await hit(outsiderToken,'GET','/kernel/context')).body.data.sources).toHaveLength(0);
 });
 it('issues schedule proposals as pending intents, accepts only signed Kernel decisions',async()=>{
  const food=await hit(userToken,'POST','/foods',{name:'User rice',servingLabel:'cup',
   energyKcal:100,proteinG:3,carbsG:20,fatG:1});
  const recipe=await hit(userToken,'POST','/recipes',{name:'Rice meal',yieldServings:2,prepMinutes:15,
   ingredients:[{foodId:food.body.data.id,servings:2}]});
  const plan=await hit(userToken,'POST','/plans',{weekStart:'2026-10-26'});
  expect(plan.status).toBe(201);planId=plan.body.data.id;
  expect((await hit(userToken,'POST','/plans/'+planId+'/entries',{plannedOn:'2026-10-31',
   slot:'Lunch',recipeId:recipe.body.data.id,portions:1})).status).toBe(201);
  expect((await hit(userToken,'POST','/plans/'+planId+'/approve',{})).status).toBe(200);
  const proposal={planId,day:'2026-10-31',startTime:'12:00',endTime:'12:30',reason:'meal_break'};
  const key=randomUUID();
  const pending=await hit(userToken,'POST','/kernel/proposals',proposal,key);
  expect(pending.status).toBe(201);expect(pending.body.data.state).toBe('proposed');proposalId=pending.body.data.id;
  expect((await hit(userToken,'POST','/kernel/proposals',proposal,key)).body.data.id).toBe(proposalId);
  expect((await hit(userToken,'GET','/kernel/proposals')).body.data[0].state).toBe('proposed');
  expect((await hit(userToken,'POST','/kernel/events',{eventId:randomUUID(),eventType:'kernel.plan.decision',
   version:1,occurredAt:now(),payload:{proposalId,decisionId:randomUUID(),decision:'accepted'}})).status).toBe(401);
  const service=await signedService();
  const decision={eventId:randomUUID(),eventType:'kernel.plan.decision',version:1,
   occurredAt:now(),payload:{proposalId,decisionId:randomUUID(),decision:'accepted'}};
  expect((await hit(service,'POST','/kernel/events',decision)).status).toBe(202);
  expect((await hit(userToken,'GET','/kernel/proposals')).body.data[0].state).toBe('accepted');
  expect((await hit(service,'POST','/kernel/events',{...decision,eventId:randomUUID(),
   payload:{...decision.payload,decisionId:randomUUID(),decision:'rejected'}})).status).toBe(409);
  const m=await hit(userToken,'POST','/meals',{consumedOn:'2026-10-31',slot:'Lunch',name:'Rice actually eaten',
   items:[{foodId:food.body.data.id,servings:1}]});
  expect(m.status).toBe(201);mealId=m.body.data.id;
 });
 it('exports only scoped, nonretrospective observations without meal text, and leaves HOS transport unconnected',async()=>{
  const event=(await privileged.query("SELECT * FROM nutrition.event_outbox WHERE tenant_id=$1 AND user_id=$2 AND event_type='nutrition.meal.logged' AND aggregate_id=$3 ORDER BY created_at DESC LIMIT 1",
   [tenantId,ownerId,mealId])).rows[0] as KernelExportEvent;
  expect(event).toBeTruthy();
  const frame=await scopedTransaction(privileged,{tenantId,userId:ownerId,scopes:new Set(userScopes)},db=>
   prepareKernelEnvelope(db,{tenantId,userId:ownerId,scopes:new Set(userScopes)},event));
  expect(frame.event_type).toBe('nutrition.observed_meals_changed.v1');
  expect(frame.data.logged_energy_kcal).toBe(100);
  expect(JSON.stringify(frame)).not.toContain('Rice actually eaten');
  expect(JSON.stringify(frame)).not.toContain('User rice');
  const status=(await hit(userToken,'GET','/kernel/status')).body.data;
  expect(status.liveKernelTransportConnected).toBe(false);
  const wrong=await scopedTransaction(privileged,{tenantId,userId:ownerId,scopes:new Set(userScopes)},db=>
   prepareKernelEnvelope(db,{tenantId,userId:ownerId,scopes:new Set(userScopes)},
   {...event,event_type:'nutrition.profile.updated'})).catch(e=>e as Error);
  expect(wrong).toMatchObject({code:'KERNEL_EXPORT_UNSUPPORTED'});
 });
 it('enforces signed Family OS attestations in strict mode and immediately revokes access',async()=>{
  process.env.KERNEL_FAMILY_AUTHORITY_REQUIRED='true';
  const house=await hit(userToken,'POST','/family',{name:'Kernel verified family kitchen'});
  expect(house.status).toBe(201);householdId=house.body.data.id;
  expect((await hit(userToken,'POST','/family/'+householdId+'/invites',{userId:memberId,alias:'Member',
   role:'viewer'})).status).toBe(201);
  expect((await hit(memberToken,'POST','/family/'+householdId+'/accept',{})).status).toBe(200);
  expect((await hit(memberToken,'GET','/family')).body.data.boards).toHaveLength(0);
  const service=await signedService(memberId);
  const grant=authority([{scope:'nutrition.context.family',granted:true}]);
  expect((await hit(service,'POST','/kernel/authority',grant)).status).toBe(200);
  const attested={eventId:randomUUID(),eventType:'family.membership.attested',version:1,
   occurredAt:now(),payload:{householdId,role:'viewer',active:true,expiresAt:future()}};
  expect((await hit(service,'POST','/kernel/events',attested)).status).toBe(202);
  expect((await hit(memberToken,'GET','/family')).body.data.boards).toHaveLength(1);
  const revoked={...attested,eventId:randomUUID(),payload:{...attested.payload,active:false}};
  expect((await hit(service,'POST','/kernel/events',revoked)).status).toBe(202);
  expect((await hit(memberToken,'GET','/family')).body.data.boards).toHaveLength(0);
  // Application user cannot bypass the DB by reading family rows directly.
  await expect(scopedTransaction(pool,{tenantId,userId:memberId,scopes:new Set(userScopes)},db=>
   db.query('SELECT id FROM nutrition.household WHERE id=$1',[householdId]))).resolves.toMatchObject({rowCount:0});
  delete process.env.KERNEL_FAMILY_AUTHORITY_REQUIRED;
 });
 it('revocation removes previously shared external context and disables proposals',async()=>{
  const service=await signedService();
  const v={...authority([],'DISABLED'),assertedAt:new Date(Date.now()+2000).toISOString()};
  expect((await hit(service,'POST','/kernel/authority',v)).status).toBe(200);
  const status=(await hit(userToken,'GET','/kernel/status')).body.data;
  expect(status.active).toBe(false);expect(status.grants.every((x:any)=>!x.granted)).toBe(true);
  expect((await hit(userToken,'GET','/kernel/context')).body.data.sources).toHaveLength(0);
  expect((await hit(userToken,'POST','/kernel/proposals',{planId,day:'2026-10-31',startTime:'12:00',
   endTime:'12:30',reason:'meal_break'})).status).toBe(403);
 });
});
