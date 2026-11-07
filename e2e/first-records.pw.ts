import {test,expect} from '@playwright/test';
import {randomUUID,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';

/** First-run UI tests never share tenant/user identity with the existing suite. */
function localTestToken(){
 if(process.env.NODE_ENV==='production')throw Error('Development tokens forbidden in production.');
 let secret=process.env.LOCAL_IDENTITY_SECRET;
 if(!secret)secret=readFileSync('server/.env','utf8').match(/^LOCAL_IDENTITY_SECRET=(.+)$/m)?.[1]?.trim();
 if(!secret||secret.length<32)throw Error('Local development signing secret required.');
 const now=Math.floor(Date.now()/1000);
 const payload={iss:'nutrition-local-dev',aud:'nutrition-local',sub:randomUUID(),
  tenant_id:randomUUID(),scope:'nutrition:read nutrition:write',iat:now,exp:now+3600};
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const data=encode({typ:'JWT',alg:'HS256'})+'.'+encode(payload);
 return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');
}
test('a new account can add its first food and meal, then recover an already saved weekly plan',async({page,request})=>{
 const token=localTestToken();
 const unique=randomUUID().slice(0,8);
 await page.goto('/?mode=live#/meals');
 await page.getByPlaceholder(/Paste the token from/).fill(token);
 await page.getByRole('button',{name:/Open development workspace/}).click();
 await expect(page.locator('.lv-head h1')).toHaveText('Meal History & Corrections');
 await page.locator('.lv-head').getByRole('button',{name:'Log meal'}).click();

 const quick=page.getByRole('form',{name:'Create your first food'});
 await expect(quick).toBeVisible();
 await expect(page.getByRole('button',{name:'Confirm eaten & log'})).toBeDisabled();
 await quick.getByLabel('Food name').fill('First rice '+unique);
 await quick.getByLabel('One serving').fill('one cup cooked');
 await quick.getByLabel('Energy (kcal)').fill('210');
 await quick.getByLabel('Protein (g)').fill('4');
 await quick.getByLabel('Carbohydrate (g)').fill('45');
 await quick.getByLabel('Fat (g)').fill('1');
 await quick.getByRole('button',{name:/Save food and add to form/}).click();
 await expect(quick).toHaveCount(0);
 await expect(page.locator('#meal-food-0')).toContainText('First rice '+unique);
 await page.getByLabel('What did you eat?').fill('L1 breakfast '+unique);
 await expect(page.getByRole('button',{name:'Confirm eaten & log'})).toBeEnabled();
 await page.getByRole('button',{name:'Confirm eaten & log'}).click();
 await expect(page.getByText('L1 breakfast '+unique,{exact:true})).toBeVisible();

 await page.getByRole('button',{name:'Meal Planner',exact:true}).click();
 await expect(page.locator('.lv-head h1')).toHaveText('Weekly Meal Planning');
 const week=await page.locator('.lv-stats .lv-stat').first().locator('strong').innerText();
 // Simulate another tab creating this week's plan after the snapshot was read.
 const response=await request.post('http://127.0.0.1:3001/api/v1/nutrition/plans',{
  headers:{authorization:'Bearer '+token,'idempotency-key':randomUUID()},
  data:{weekStart:week}
 });
 expect(response.status()).toBe(201);
 const existing=(await response.json()).data.id;
 await page.getByRole('button',{name:'Create or open this week'}).first().click();
 await expect(page.getByText('Draft',{exact:true})).toBeVisible();
 await expect(page.getByText('This week already has a meal plan.')).toHaveCount(0);
 const fetched=await request.get('http://127.0.0.1:3001/api/v1/nutrition/plans?weekStart='+week,
  {headers:{authorization:'Bearer '+token}});
 expect(fetched.status()).toBe(200);
 const saved=(await fetched.json()).data;
 expect(saved).toHaveLength(1);
 expect(saved[0].id).toBe(existing);
 await expect(page.getByText('Create a recipe to plan a meal')).toBeVisible();
 await page.getByRole('button',{name:'Create recipe'}).click();
 await expect(page.locator('.lv-head h1')).toHaveText('Recipe Knowledge & Portions');

 await page.getByLabel('Recipe title').fill('Rice bowl '+unique);
 await page.getByRole('button',{name:'Ingredient',exact:true}).click();
 await page.getByRole('button',{name:'Create recipe',exact:true}).click();
 await expect(page.getByText('Rice bowl '+unique,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Meal Planner',exact:true}).click();
 await expect(page.getByText('Draft',{exact:true})).toBeVisible();
 await page.getByLabel('Recipe',{exact:true}).selectOption({label:'Rice bowl '+unique});
 await page.getByRole('button',{name:/Add to plan/}).click();
 await expect(page.getByText('Rice bowl '+unique,{exact:true})).toBeVisible();
});
