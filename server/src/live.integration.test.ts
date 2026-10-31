import {afterAll,beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import type {FastifyInstance} from 'fastify';
import {buildApp} from './http.js';
import {loadConfig} from './config.js';
import {signLocalToken} from './auth.js';
import {scopedTransaction} from './db.js';
const config=loadConfig({...process.env,NODE_ENV:'test',
 DATABASE_URL:process.env.DATABASE_URL??'postgresql://localhost/nutrition_os',
 LOCAL_IDENTITY_ENABLED:'true',LOCAL_IDENTITY_SECRET:'local-identity-test-secret-must-be-32-chars-minimum'});
const pool=new Pool({connectionString:config.databaseUrl});
const tenant=randomUUID(),otherTenant=randomUUID(),ownerId=randomUUID(),memberId=randomUUID(),outsiderId=randomUUID();
let app:FastifyInstance,owner:string,member:string,outsider:string,other:string;
const base='/api/v1/nutrition';
const newKey=()=>randomUUID();
async function req(jwt:string,method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',path:string,body?:unknown){
 const r=await app.inject({method,url:base+path,headers:{
 authorization:'Bearer '+jwt,...(method==='GET'?{}:{'idempotency-key':newKey()})
 },...(body===undefined?{}:{payload:JSON.stringify(body),headers:{authorization:'Bearer '+jwt,'idempotency-key':newKey(),'content-type':'application/json'}})});
 return {status:r.statusCode,json:r.json() as any};
}
beforeAll(async()=>{
 app=await buildApp({pool,config});
 const s=['nutrition:read','nutrition:write'];
 owner=await signLocalToken(config,{tenantId:tenant,userId:ownerId,scopes:s});
 member=await signLocalToken(config,{tenantId:tenant,userId:memberId,scopes:s});
 outsider=await signLocalToken(config,{tenantId:tenant,userId:outsiderId,scopes:s});
 other=await signLocalToken(config,{tenantId:otherTenant,userId:memberId,scopes:s});
});
afterAll(async()=>{await app?.close();await pool.end();});
describe('Phase 6 authenticated personal and shared integration',()=>{
 let foodId:string,recipeId:string,planId:string,houseId:string,sharedMealId:string;
 it('session derives trusted identity, and new account never receives sample records',async()=>{
   const session=await req(owner,'GET','/session');
   expect(session.status).toBe(200);
   expect(session.json.data).toMatchObject({userId:ownerId,tenantId:tenant,identitySource:'development_signed_token'});
   expect((await req(owner,'GET','/foods')).json.data).toHaveLength(0);
   expect((await req(owner,'GET','/meals')).json.data).toHaveLength(0);
   expect((await req(owner,'GET','/hydration?date=2026-10-31')).json.data.observedL).toBeNull();
   expect((await req(owner,'GET','/progress?from=2026-10-01&to=2026-10-31')).json.data.observations).toHaveLength(0);
 });
 it('food and recipe CRUD protect revision/history; hydration is durable and observed only',async()=>{
   const food=await req(owner,'POST','/foods',{name:'Recorded millet',servingLabel:'one cup',energyKcal:210,proteinG:6,carbsG:43,fatG:2});
   expect(food.status).toBe(201);foodId=food.json.data.id;
   const edit=await req(owner,'PUT','/foods/'+foodId,{name:'Recorded millet cooked',servingLabel:'one cup',energyKcal:220,proteinG:7,carbsG:42,fatG:2,expectedRevision:1});
   expect(edit.status).toBe(200);expect(edit.json.data.revision).toBe(2);
   expect((await req(owner,'PUT','/foods/'+foodId,{name:'Stale',servingLabel:'cup',energyKcal:1,proteinG:1,carbsG:1,fatG:1,expectedRevision:1})).status).toBe(409);
   const recipe=await req(owner,'POST','/recipes',{name:'Home millet',yieldServings:2,prepMinutes:15,instructions:'Prepare safely',ingredients:[{foodId,servings:2}]});
   expect(recipe.status).toBe(201);recipeId=recipe.json.data.id;
   const updated=await req(owner,'PUT','/recipes/'+recipeId,{name:'Home millet stew',yieldServings:2,prepMinutes:18,instructions:'Cook thoroughly',ingredients:[{foodId,servings:2}],expectedRevision:1});
   expect(updated.status).toBe(200);expect(updated.json.data.version).toBe(2);
   const hydration=await req(owner,'PUT','/hydration',{date:'2026-10-31',observedL:1.5});
   expect(hydration.status).toBe(200);expect((await req(owner,'GET','/hydration?date=2026-10-31')).json.data.observedL).toBe(1.5);
   expect((await req(member,'GET','/hydration?date=2026-10-31')).json.data.observedL).toBeNull();
   expect((await req(owner,'GET','/progress?from=2026-10-01&to=2026-10-31')).json.data.hydration).toHaveLength(1);
   expect((await req(owner,'GET','/progress?from=2025-01-01&to=2026-10-31')).status).toBe(422);
 });
 it('owner creates approved plan, with explicit private-to-shared publishing only',async()=>{
  const plan=await req(owner,'POST','/plans',{weekStart:'2026-10-26'});expect(plan.status).toBe(201);planId=plan.json.data.id;
  const entry=await req(owner,'POST','/plans/'+planId+'/entries',{plannedOn:'2026-10-31',slot:'Dinner',recipeId,portions:2});
  expect(entry.status).toBe(201);
  expect((await req(owner,'POST','/plans/'+planId+'/approve',{})).status).toBe(200);
  const house=await req(owner,'POST','/family',{name:'Family kitchen'});expect(house.status).toBe(201);houseId=house.json.data.id;
  const ownerBoard=await req(owner,'GET','/family');
  expect(ownerBoard.json.data.boards[0].meals).toHaveLength(0);
  expect((await req(member,'GET','/family')).json.data.boards).toHaveLength(0);
  expect((await req(outsider,'GET','/family')).json.data.boards).toHaveLength(0);
  const shared=await req(owner,'POST','/family/'+houseId+'/share-plan',{planId});
  expect(shared.status).toBe(201);expect(shared.json.data.sharedMeals).toBe(1);
  sharedMealId=(await req(owner,'GET','/family')).json.data.boards[0].meals[0].id;
 });
 it('signed subject must accept invitation; viewer has no mutation permission',async()=>{
   const invite=await req(owner,'POST','/family/'+houseId+'/invites',{userId:memberId,alias:'Member M',role:'viewer'});
   expect(invite.status).toBe(201);expect(invite.json.data.state).toBe('invited');
   const pending=await req(member,'GET','/family');
   expect(pending.json.data.invites).toHaveLength(1);
   expect(pending.json.data.boards).toHaveLength(0);
   expect((await req(outsider,'POST','/family/'+houseId+'/accept',{})).status).toBe(404);
   expect((await req(member,'POST','/family/'+houseId+'/accept',{})).status).toBe(200);
   const memberBoard=(await req(member,'GET','/family')).json.data.boards[0];
   expect(memberBoard).toBeTruthy();expect(memberBoard.meals).toHaveLength(1);
   expect(JSON.stringify(memberBoard)).not.toMatch(/observed_l|protein_g|energy_kcal|targets|excluded_foods|actual_paid_kes/);
   expect((await req(member,'POST','/family/'+houseId+'/groceries',{title:'Onions',quantity:'2 kg',estimateKes:100})).status).toBe(403);
   expect((await req(other,'GET','/family')).json.data.boards).toHaveLength(0);
   expect((await req(outsider,'GET','/family')).json.data.boards).toHaveLength(0);
 });
 it('role update is owner-only and editor operates only on permitted shared logistics',async()=>{
   expect((await req(member,'PATCH','/family/'+houseId+'/members/'+memberId,{role:'editor'})).status).toBe(403);
   const editRole=await req(owner,'PATCH','/family/'+houseId+'/members/'+memberId,{role:'editor'});
   expect(editRole.status).toBe(200);
   const task=await req(member,'PUT','/family/'+houseId+'/tasks',{mealId:sharedMealId,assignedUserId:memberId,note:'Prepare vegetables',status:'planned'});
   expect(task.status).toBe(200);
   const grocery=await req(member,'POST','/family/'+houseId+'/groceries',{title:'Greens',quantity:'2 bunches',estimateKes:100});
   expect(grocery.status).toBe(201);
   expect((await req(member,'PATCH','/family/'+houseId+'/groceries/'+grocery.json.data.id,{checked:true})).status).toBe(200);
   const outsiderWrite=await req(outsider,'POST','/family/'+houseId+'/groceries',{title:'Leak',quantity:'1',estimateKes:1});
   expect(outsiderWrite.status).toBe(404);
   const board=(await req(owner,'GET','/family')).json.data.boards[0];
   expect(board.groceries[0].checked).toBe(true);
 });
 it('direct RLS prevents viewer from writing kitchen rows or elevating own role',async()=>{
   const viewerId=randomUUID();
   const viewer=await signLocalToken(config,{tenantId:tenant,userId:viewerId,scopes:['nutrition:read','nutrition:write']});
   expect((await req(owner,'POST','/family/'+houseId+'/invites',{userId:viewerId,alias:'Viewer',role:'viewer'})).status).toBe(201);
   expect((await req(viewer,'POST','/family/'+houseId+'/accept',{})).status).toBe(200);
   const viewerActor={tenantId:tenant,userId:viewerId,scopes:new Set(['nutrition:read','nutrition:write'])};
   await expect(scopedTransaction(pool,viewerActor,db=>db.query('INSERT INTO nutrition.household_grocery(tenant_id,household_id,title,quantity,estimate_kes) VALUES($1,$2,$3,$4,$5)',
     [tenant,houseId,'Forbidden','1',1]))).rejects.toMatchObject({code:'42501'});
   await expect(scopedTransaction(pool,viewerActor,db=>db.query('UPDATE nutrition.household_member SET role=$4 WHERE tenant_id=$1 AND household_id=$2 AND member_user_id=$3',
     [tenant,houseId,viewerId,'editor']))).rejects.toMatchObject({code:'42501'});
 });
 it('manual groceries, balance and amount histories remain independent from the shared kitchen',async()=>{
   const empty=await req(owner,'POST','/groceries/lists',{});expect(empty.status).toBe(201);
   const item=await req(owner,'POST','/groceries/lines',{foodId,quantityServings:3,unitPriceKes:50});
   expect(item.status).toBe(201);
   expect((await req(owner,'PUT','/groceries/lines/'+item.json.data.id,{quantityServings:2,unitPriceKes:60})).status).toBe(200);
   expect((await req(owner,'PUT','/groceries/lines/'+item.json.data.id+'/purchase',{purchased:true,actualPaidKes:125})).status).toBe(200);
   expect((await req(owner,'POST','/groceries/lines/'+item.json.data.id+'/receive',{location:'Pantry',acquiredOn:'2026-10-31'})).status).toBe(201);
   const budget=(await req(owner,'GET','/budget')).json.data;
   expect(budget.explicitRecordedPaidKes).toBe(125);
   const family=(await req(member,'GET','/family')).json.data;
   expect(family.boards).toHaveLength(1);
   // UUIDs may incidentally contain the digits of a private payment amount.
   // Check for private fields and structurally unauthorized money projections,
   // rather than substring matching arbitrary identifiers.
   const fields=JSON.stringify(family);
   expect(fields).not.toMatch(/"actual_paid_kes"|"actualPaidKes"|"payment_id"|"finance_transaction_id"|"personalBudgetKes"/);
   for(const board of family.boards){
     for(const line of board.groceries){
       expect(line).not.toHaveProperty('actual_paid_kes');
       expect(line).not.toHaveProperty('actualPaidKes');
       expect(line).not.toHaveProperty('payment_id');
     }
   }
   const inventory=await req(owner,'GET','/inventory/movements');
   expect(inventory.status).toBe(200);expect(inventory.json.data.length).toBeGreaterThan(0);
   expect((await req(member,'GET','/inventory')).json.data).toHaveLength(0);
 });
});
