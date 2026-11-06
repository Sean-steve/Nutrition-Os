import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {randomUUID,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';

/** Dedicated synthetic account, separate from existing empty-account tests. */
function isolatedDevToken(){
 if(process.env.NODE_ENV==='production')throw Error('Synthetic local JWTs forbidden in production');
 // Each retry/project gets an independent synthetic tenant and subject.
 let secret=process.env.LOCAL_IDENTITY_SECRET;
 if(!secret){
  const localEnv=readFileSync('server/.env','utf8');
  secret=localEnv.match(/^LOCAL_IDENTITY_SECRET=(.+)$/m)?.[1]?.trim();
 }
 if(!secret||secret.length<32)throw Error('Phase L1 local JWT secret unavailable');
 const now=Math.floor(Date.now()/1000);
 const payload={iss:'nutrition-local-dev',aud:'nutrition-local',
  sub:randomUUID(),tenant_id:randomUUID(),
  scope:'nutrition:read nutrition:write',iat:now,exp:now+3600};
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const unsigned=encode({typ:'JWT',alg:'HS256'})+'.'+encode(payload);
 return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
}
const origin='http://127.0.0.1:3001/api/v1/nutrition';
const slug=()=>randomUUID().slice(0,8);
function today(){return new Date().toISOString().slice(0,10);}
function weekStart(day:string){
 const d=new Date(day+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 return d.toISOString().slice(0,10);
}
async function call(request:APIRequestContext,token:string,method:'GET'|'POST'|'PUT',path:string,data?:unknown){
 const result=await request.fetch(origin+path,{
  method,headers:{Authorization:'Bearer '+token,'idempotency-key':randomUUID()},
  ...(data===undefined?{}:{data})
 });
 const reply=await result.json();
 expect(result.ok(),path+' '+result.status()+' '+JSON.stringify(reply).slice(0,220)).toBeTruthy();
 return reply.data;
}
async function signIn(page:Page,token:string){
 await page.goto('/?mode=live');
 await expect(page.getByRole('heading',{name:'Your nutrition. Your records.'})).toBeVisible();
 await page.getByPlaceholder(/Paste the token from/).fill(token);
 await page.getByRole('button',{name:/Open development workspace/}).click();
 await expect(page.locator('.lv-live-tag')).toBeVisible({timeout:30000});
}
async function open(page:Page,label:string,heading:string){
 const menu=page.getByRole('button',{name:'Open navigation'});
 if(await menu.isVisible())await menu.click();
 await page.getByRole('button',{name:label,exact:true}).click();
 await expect(page.locator('.lv-head h1')).toHaveText(heading);
 await expect(page.getByText('Eggs & avocado toast')).toHaveCount(0);
}
test('full synthetic nutrition lifecycle is persisted and all authenticated screens are reachable',async({page,request})=>{
 const token=isolatedDevToken();
 const date=today(),unique=slug(),name='L1 food '+unique,recipeName='L1 recipe '+unique;
 const food=await call(request,token,'POST','/foods',{name,servingLabel:'one test portion',
  energyKcal:210,proteinG:9,carbsG:32,fatG:4});
 const recipe=await call(request,token,'POST','/recipes',{name:recipeName,yieldServings:2,
  prepMinutes:12,instructions:'Synthetic test recipe only',
  ingredients:[{foodId:food.id,servings:2}]});
 const plan=await call(request,token,'POST','/plans',{weekStart:weekStart(date)});
 await call(request,token,'POST','/plans/'+plan.id+'/entries',{plannedOn:date,slot:'Dinner',
  recipeId:recipe.id,portions:1});
 await call(request,token,'POST','/plans/'+plan.id+'/approve',{});
 const meal=await call(request,token,'POST','/meals',{consumedOn:date,slot:'Dinner',
  name:'L1 observed '+unique,items:[{foodId:food.id,servings:1}]});
 expect(Number(meal.energy_kcal)).toBe(210);
 await call(request,token,'PUT','/hydration',{date,observedL:1.25});
 await call(request,token,'PUT','/budget',{amountKes:2000});
 const list=await call(request,token,'POST','/groceries/generate',{planId:plan.id,unitPricesKes:{[food.id]:90}});
 expect(list.id).toBeTruthy();
 expect(list.lines.length).toBe(1);
 await call(request,token,'PUT','/groceries/lines/'+list.lines[0].id+'/purchase',{purchased:true,actualPaidKes:90});
 await call(request,token,'POST','/groceries/lines/'+list.lines[0].id+'/receive',{location:'Pantry',acquiredOn:date});
 const inventory=await call(request,token,'GET','/inventory');
 expect(inventory.length).toBe(1);
 const house=await call(request,token,'POST','/family',{name:'L1 kitchen '+unique});
 expect(house.id).toBeTruthy();
 const state=await call(request,token,'GET','/state?date='+date);
 expect(state.intake.energyKcal).toBe(210);
 await signIn(page,token);
 const routes=[
  ['Dashboard','Your day, backed by your records.'],
  ['Today','Today’s Nutrition Journal'],
  ['Meals','Meal History & Corrections'],
  ['Meal Planner','Weekly Meal Planning'],
  ['Food Library','Your Food Library'],
  ['Recipes','Recipe Knowledge & Portions'],
  ['Groceries','Groceries & Purchase Flow'],
  ['Inventory','Inventory & Stock Ledger'],
  ['Food Budget','Food Budget & Cost Tracking'],
  ['Waste & Expiry','Food Waste & Expiry'],
  ['Nutrition Goals','Goals & Requirements'],
  ['Insights','Nutrition Intelligence'],
  ['Progress','Nutrition Progress'],
  ['Family Kitchen','Family Nutrition Command Center'],
  ['Nutrition Guide','Ask. Understand. Decide.'],
  ['My Profile','Your Nutrition Profile'],
  ['Privacy','Privacy and Data Authority'],
  ['Integrations','Human Kernel Integration']
 ] as const;
 for(const [label,heading] of routes){
  await open(page,label,heading);
 }
 await open(page,'Food Library','Your Food Library');
 await expect(page.getByText(name,{exact:true})).toBeVisible();
 await open(page,'Recipes','Recipe Knowledge & Portions');
 await expect(page.getByText(recipeName,{exact:true})).toBeVisible();
 await open(page,'Meals','Meal History & Corrections');
 await expect(page.getByText('L1 observed '+unique,{exact:true})).toBeVisible();
 await open(page,'Family Kitchen','Family Nutrition Command Center');
 await expect(page.getByText('L1 kitchen '+unique,{exact:true})).toBeVisible();
 // Session token lives in memory; refresh must intentionally return to login.
 await page.reload();
 await expect(page.getByRole('heading',{name:'Your nutrition. Your records.'})).toBeVisible();
 await page.getByPlaceholder(/Paste the token from/).fill(token);
 await page.getByRole('button',{name:/Open development workspace/}).click();
 await expect(page.locator('.lv-live-tag')).toBeVisible({timeout:30000});
 await open(page,'Food Library','Your Food Library');
 await expect(page.getByText(name,{exact:true})).toBeVisible();
});
