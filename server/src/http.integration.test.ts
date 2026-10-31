import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {Pool} from 'pg';
import {buildApp} from './http.js';
import {loadConfig} from './config.js';
import {signLocalToken} from './auth.js';
import {assertNoBypassRls,scopedTransaction} from './db.js';
const url=process.env.DATABASE_URL;
const secret='test-local-nutrition-identity-secret-long-enough-123456';
const config=loadConfig({...process.env,NODE_ENV:'test',DATABASE_URL:url??'postgresql://localhost/no_database',
  LOCAL_IDENTITY_ENABLED:'true',LOCAL_IDENTITY_SECRET:secret});
const pool=new Pool({connectionString:config.databaseUrl});
const tenantId=randomUUID(),tenantTwo=randomUUID(),userId=randomUUID(),userTwo=randomUUID();
let app:FastifyInstance,token:string,other:string,otherTenant:string,readonlyToken:string;
const route='/api/v1/nutrition';
async function call(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,body?:unknown,key?:string,jwt=token){
  const result=await app.inject({method,url:route+path,
    headers:{authorization:'Bearer '+jwt,...(key?{'idempotency-key':key}:{}),...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{payload:JSON.stringify(body)})});
  return {status:result.statusCode,data:result.json() as any};
}
const key=()=>randomUUID();
beforeAll(async()=>{
  await assertNoBypassRls(pool);
  app=await buildApp({pool,config});
  token=await signLocalToken(config,{userId,tenantId,scopes:['nutrition:read','nutrition:write']});
  other=await signLocalToken(config,{userId:userTwo,tenantId,scopes:['nutrition:read','nutrition:write']});
  otherTenant=await signLocalToken(config,{userId,tenantId:tenantTwo,scopes:['nutrition:read','nutrition:write']});
  readonlyToken=await signLocalToken(config,{userId:userTwo,tenantId,scopes:['nutrition:read']});
});
afterAll(async()=>{await app?.close();await pool.end();});
describe('versioned nutrition API backed by PostgreSQL and tenant RLS',()=>{
  let foodId:string,recipeId:string,planId:string,mealId:string,lotId:string,lineId:string;
  it('requires signed identity and idempotency and never accepts spoofed headers',async()=>{
    const missing=await app.inject({method:'GET',url:route+'/foods',headers:{'x-user-id':userId,'x-tenant-id':tenantId}});
    expect(missing.statusCode).toBe(401);
    const noKey=await call('POST','/foods',{name:'Rice',servingLabel:'cup',energyKcal:150,proteinG:3,carbsG:30,fatG:1});
    expect(noKey.status).toBe(428);
    const denied=await call('POST','/foods',{name:'Food',servingLabel:'cup',energyKcal:150,proteinG:3,carbsG:30,fatG:1},key(),readonlyToken);
    expect(denied.status).toBe(403);
  });
  it('creates unverified food once and isolates both user and tenant',async()=>{
    const k=key(),body={name:'Demo cooked rice',servingLabel:'one cup',energyKcal:150,proteinG:3,carbsG:30,fatG:1};
    const first=await call('POST','/foods',body,k);
    expect(first.status).toBe(201);expect(first.data.data.verified).toBe(false);foodId=first.data.data.id;
    const replay=await call('POST','/foods',body,k);
    expect(replay.status).toBe(201);expect(replay.data.data.id).toBe(foodId);
    expect((await call('POST','/foods',{...body,name:'Other item'},k)).status).toBe(409);
    expect((await call('GET','/foods/'+foodId,undefined,undefined,other)).status).toBe(404);
    expect((await call('GET','/foods/'+foodId,undefined,undefined,otherTenant)).status).toBe(404);
    const out=await scopedTransaction(pool,{userId:userTwo,tenantId,scopes:new Set(['nutrition:read'])},async db=>
      (await db.query('SELECT count(*)::int AS count FROM nutrition.food WHERE id=$1',[foodId])).rows[0].count);
    expect(out).toBe(0);
  });
  it('creates owned recipe, plans independently of observed consumption',async()=>{
    const recipe=await call('POST','/recipes',{name:'Example rice bowl',yieldServings:2,ingredients:[{foodId,servings:2}],prepMinutes:15},key());
    expect(recipe.status).toBe(201);recipeId=recipe.data.data.id;
    const p=await call('POST','/plans',{weekStart:'2026-10-26'},key());
    expect(p.status).toBe(201);planId=p.data.data.id;
    const entry=await call('POST','/plans/'+planId+'/entries',{plannedOn:'2026-10-31',slot:'Dinner',recipeId,portions:1},key());
    expect(entry.status).toBe(201);
    const approved=await call('POST','/plans/'+planId+'/approve',{},key());
    expect(approved.status).toBe(200);
    expect((await call('POST','/plans/'+planId+'/entries',{plannedOn:'2026-10-31',slot:'Breakfast',recipeId,portions:1},key())).status).toBe(409);
    const noIntake=await call('GET','/state?date=2026-10-31');
    expect(noIntake.status).toBe(200);expect(noIntake.data.data.intake).toBeNull();
    expect(noIntake.data.data.observationStatus).toBe('unknown');
  });
  it('creates immutable meal snapshots, corrections and read-only observed state',async()=>{
    const m=await call('POST','/meals',{consumedOn:'2026-10-31',slot:'Dinner',name:'Rice observed',items:[{foodId,servings:1.5}]},key());
    expect(m.status).toBe(201);mealId=m.data.data.id;
    expect(Number(m.data.data.energy_kcal)).toBe(225);
    const state=await call('GET','/state?date=2026-10-31');
    expect(state.data.data.intake.energyKcal).toBe(225);
    expect(state.data.data.observationStatus).toBe('partial_recorded');
    const corrected=await call('PUT','/meals/'+mealId,{consumedOn:'2026-10-31',slot:'Dinner',name:'Corrected rice log',
      items:[{foodId,servings:1}],expectedRevision:1},key());
    expect(corrected.status).toBe(200);expect(corrected.data.data.revision).toBe(2);
    const repeated=await call('PUT','/meals/'+mealId,{consumedOn:'2026-10-31',slot:'Dinner',name:'Old revision',
      items:[{foodId,servings:1}],expectedRevision:1},key());
    expect(repeated.status).toBe(409);
    const details=await call('GET','/meals/'+mealId);
    expect(details.data.data.items[0].snapshot_source).toBe('user_unverified');
    expect((await call('GET','/state?date=2026-10-31')).data.data.intake.energyKcal).toBe(150);
  });
  it('enforces atomic inventory movements, approval-aware groceries and receipt deduplication',async()=>{
    const l=await call('POST','/inventory/lots',{foodId,location:'Pantry',acquiredOn:'2026-10-28',expiresOn:'2026-12-01',unitCostKes:80,initialServings:1},key());
    expect(l.status).toBe(201);lotId=l.data.data.id;
    expect((await call('POST','/inventory/movements',{lotId,happenedOn:'2026-10-31',kind:'WASTE',deltaServings:-2},key())).status).toBe(409);
    const movement=await call('POST','/inventory/movements',{lotId,happenedOn:'2026-10-31',kind:'CONSUMPTION',deltaServings:-0.5},key());
    expect(movement.status).toBe(201);
    const list=await call('POST','/groceries/generate',{planId,unitPricesKes:{[foodId]:100}},key());
    expect(list.status).toBe(201);expect(list.data.data.lines.length).toBe(1);
    lineId=list.data.data.lines[0].id;
    expect(Number(list.data.data.lines[0].quantity_servings)).toBe(0.5);
    const paid=await call('PUT','/groceries/lines/'+lineId+'/purchase',{purchased:true,actualPaidKes:67},key());
    expect(paid.status).toBe(200);
    expect((await call('POST','/groceries/generate',{planId},key())).status).toBe(409);
    const received=await call('POST','/groceries/lines/'+lineId+'/receive',{location:'Fridge',acquiredOn:'2026-10-31'},key());
    expect(received.status).toBe(201);
    expect((await call('POST','/groceries/lines/'+lineId+'/receive',{location:'Fridge',acquiredOn:'2026-10-31'},key())).status).toBe(409);
    const budget=await call('GET','/budget');expect(budget.data.data.explicitRecordedPaidKes).toBe(67);
    const inv=await call('GET','/inventory');
    expect(inv.data.data.length).toBe(2);
  });
  it('records minimal event metadata atomically without containing meal narratives',async()=>{
    const privileged=new Pool({connectionString:process.env.MIGRATION_DATABASE_URL});
    try{
      const e=await privileged.query('SELECT event_type,data FROM nutrition.event_outbox WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at',[tenantId,userId]);
      expect(e.rows.some(x=>x.event_type==='nutrition.meal.logged')).toBe(true);
      expect(e.rows.some(x=>x.event_type==='nutrition.groceries.received')).toBe(true);
      const payloads=JSON.stringify(e.rows.map(x=>x.data));
      expect(payloads).not.toMatch(/Corrected rice log|Rice observed|excludedFoods|medical/);
      const n=e.rows.filter(x=>x.event_type==='nutrition.food.created');
      expect(n.length).toBe(1);
    }finally{await privileged.end();}
  });
});
