import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {Pool} from 'pg';
import type {FastifyInstance} from 'fastify';
import {buildApp} from './http.js';
import {loadConfig} from './config.js';
import {signLocalToken} from './auth.js';
const config=loadConfig({...process.env,NODE_ENV:'test',LOCAL_IDENTITY_ENABLED:'true',
 LOCAL_IDENTITY_SECRET:'phase-eight-performance-smoke-secret-1234',
 DATABASE_URL:process.env.DATABASE_URL??'postgresql://localhost/nutrition_os'});
const pool=new Pool({connectionString:config.databaseUrl,max:12});
const userId=randomUUID(),tenantId=randomUUID();
let app:FastifyInstance,token:string;
const root='/api/v1/nutrition';
const call=(path:string,method:'GET'|'POST'='GET',body?:unknown,key?:string)=>
 app.inject({method,url:root+path,headers:{authorization:'Bearer '+token,
  ...(key?{'idempotency-key':key}:{}),...(body?{'content-type':'application/json'}:{})},
  ...(body?{payload:JSON.stringify(body)}:{})});
beforeAll(async()=>{
 app=await buildApp({pool,config});
 token=await signLocalToken(config,{userId,tenantId,scopes:['nutrition:read','nutrition:write']});
});
afterAll(async()=>{await app?.close();await pool.end();});
describe('Phase 8 concurrency, privacy and API security smoke',()=>{
 it('sets no-store, anti-framing and no-referrer headers on health and private routes',async()=>{
  const ready=await app.inject('/health/ready');
  expect(ready.statusCode).toBe(200);
  expect(ready.json()).toMatchObject({status:'ready',database:true,migrations:true});
  for(const path of ['/health/live',root+'/foods']){
   const r=path.includes('/foods')?await call('/foods'):await app.inject(path);
   expect(r.headers['cache-control']).toContain('no-store');
   expect(r.headers['x-content-type-options']).toBe('nosniff');
   expect(r.headers['x-frame-options']).toBe('DENY');
   expect(r.headers['referrer-policy']).toBe('no-referrer');
  }
 });
 it('rejects forged subject headers and oversized payload without disclosing private data',async()=>{
  const unauth=await app.inject({method:'GET',url:root+'/meals',
   headers:{'x-user-id':userId,'x-tenant-id':tenantId}});
  expect(unauth.statusCode).toBe(401);
  expect(JSON.stringify(unauth.json())).not.toContain(userId);
  const oversized=await app.inject({method:'POST',url:root+'/foods',headers:{
   authorization:'Bearer '+token,'content-type':'application/json','idempotency-key':randomUUID()
  },payload:JSON.stringify({name:'x'.repeat(270000)})});
  expect(oversized.statusCode).toBe(413);
 });
 it('returns empty results for injection-shaped search text rather than escaping tenant RLS',async()=>{
  const r=await call('/foods?q='+encodeURIComponent("' OR 1=1 --"));
  expect(r.statusCode).toBe(200);
  expect(r.json().data).toHaveLength(0);
 });
 it('serializes 12 identical concurrent idempotent creates into one real food',async()=>{
  const key=randomUUID(),name='Concurrent lentils '+randomUUID().slice(0,8);
  const body={name,servingLabel:'cup',energyKcal:220,proteinG:13,carbsG:31,fatG:3};
  const calls=await Promise.all(Array.from({length:12},()=>call('/foods','POST',body,key)));
  expect(calls.every(x=>x.statusCode===201)).toBe(true);
  const ids=new Set(calls.map(x=>x.json().data.id));expect(ids.size).toBe(1);
  const foods=await call('/foods?q='+encodeURIComponent(name));
  expect(foods.json().data).toHaveLength(1);
 });
 it('bounds a 60-request mixed read burst for local CI only (not production load certification)',async()=>{
  const times:number[]=[];
  const batch=Array.from({length:60},(_,i)=>async()=>{
   const t=performance.now();
   const r=await call(i%2===0?'/foods':'/kernel/status');
   times.push(performance.now()-t);
   expect(r.statusCode).toBe(200);
  });
  await Promise.all(batch.map(f=>f()));
  const sorted=times.sort((a,b)=>a-b);
  const p95=sorted[Math.ceil(sorted.length*0.95)-1];
  expect(p95).toBeLessThan(3500);
  process.stdout.write('Phase 8 local read burst: 60 HTTP requests, p95='+Math.round(p95)+'ms (CI smoke only)\\n');
 });
});
