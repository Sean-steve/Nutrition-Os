import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';

/** Dedicated synthetic account, separate from existing empty-account tests. */
const token=process.env.E2E_FLOW_TOKEN;
const origin='http://127.0.0.1:3001/api/v1/nutrition';
const slug=()=>randomUUID().slice(0,8);
function today(){return new Date().toISOString().slice(0,10);}
function weekStart(day:string){
 const d=new Date(day+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 return d.toISOString().slice(0,10);
}
async function call(request:APIRequestContext,method:'GET'|'POST'|'PUT',path:string,data?:unknown){
 if(!token)throw Error('E2E_FLOW_TOKEN must belong to an independent synthetic tenant.');
 const result=await request.fetch(origin+path,{
  method,headers:{Authorization:'Bearer '+token,'idempotency-key':randomUUID()},
  ...(data===undefined?{}:{data})
 });
 const reply=await result.json();
 expect(result.ok(),path+' '+result.status()+' '+JSON.stringify(reply).slice(0,220)).toBeTruthy();
 return reply.data;
}
async function signIn(page:Page){
 if(!token)throw Error('E2E_FLOW_TOKEN missing');
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
 if(!token)throw Error('Missing isolated flow JWT');
 const date=today(),unique=slug(),name='L1 food '+unique,recipeName='L1 recipe '+unique;
 const food=await call(request,'POST','/foods',{name,servingLabel:'one test portion',
  energyKcal:210,proteinG:9,carbsG:32,fatG:4});
 const recipe=await call(request,'POST','/recipes',{name:recipeName,yieldServings:2,
  prepMinutes:12,instructions:'Synthetic test recipe only',
  ingredients:[{foodId:food.id,servings:2}]});
 const plan=await call(request,'POST','/plans',{weekStart:weekStart(date)});
 await call(request,'POST','/plans/'+plan.id+'/entries',{plannedOn:date,slot:'Dinner',
  recipeId:recipe.id,portions:1});
 await call(request,'POST','/plans/'+plan.id+'/approve',{});
 const meal=await call(request,'POST','/meals',{consumedOn:date,slot:'Dinner',
  name:'L1 observed '+unique,items:[{foodId:food.id,servings:1}]});
 expect(Number(meal.energy_kcal)).toBe(210);
 await call(request,'PUT','/hydration',{date,observedL:1.25});
 await call(request,'PUT','/budget',{amountKes:2000});
 const list=await call(request,'POST','/groceries/generate',{planId:plan.id,unitPricesKes:{[food.id]:90}});
 expect(list.id).toBeTruthy();
 expect(list.lines.length).toBe(1);
 await call(request,'PUT','/groceries/lines/'+list.lines[0].id+'/purchase',{purchased:true,actualPaidKes:90});
 await call(request,'POST','/groceries/lines/'+list.lines[0].id+'/receive',{location:'Pantry',acquiredOn:date});
 const inventory=await call(request,'GET','/inventory');
 expect(inventory.length).toBe(1);
 const house=await call(request,'POST','/family',{name:'L1 kitchen '+unique});
 expect(house.id).toBeTruthy();
 const state=await call(request,'GET','/state?date='+date);
 expect(state.intake.energyKcal).toBe(210);
 await signIn(page);
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
  ['Nutrition Goals','Profile & preferences'],
  ['Insights','Nutrition Intelligence'],
  ['Progress','Nutrition Progress'],
  ['Family Kitchen','Family Nutrition Command Center'],
  ['Nutrition Guide','Ask. Understand. Decide.'],
  ['My Profile','Profile & preferences'],
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
