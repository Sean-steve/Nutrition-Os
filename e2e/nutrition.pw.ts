import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

const developmentToken=process.env.E2E_TEST_TOKEN;
async function openWorkspace(page:import('@playwright/test').Page){
 if(!developmentToken)throw Error('CI must provision a temporary development token.');
 await page.goto('/?mode=live');
 await expect(page.getByRole('heading',{name:'Your nutrition. Your records.'})).toBeVisible();
 await page.getByPlaceholder(/Paste the token from/).fill(developmentToken);
 await page.getByRole('button',{name:/Open development workspace/}).click();
 await expect(page.locator('.lv-live-tag')).toBeVisible({timeout:30000});
}
async function navigate(page:import('@playwright/test').Page,name:string){
 const button=page.getByRole('button',{name,exact:true});
 if(!await button.isVisible())await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('button',{name,exact:true}).click();
}
test('static preview remains visibly sample-only',async({page})=>{
 await page.goto('/?mode=preview');
 await expect(page.locator('.preview-badge')).toContainText('SAMPLE DATA');
 await expect(page.getByRole('button',{name:/Backend workspace/})).toBeVisible();
});
test('signed-in new user has no invented observations and no Kernel grants',async({page})=>{
 await openWorkspace(page);
 await expect(page.getByText('No intake conclusion from missing logs')).toBeVisible();
 await navigate(page,'Integrations');
 await expect(page.getByRole('heading',{name:'Human Kernel Integration'})).toBeVisible();
 await expect(page.getByText('No current external projections')).toBeVisible();
});
test('a real signed API food appears in Food Library instead of fixtures',async({page,request})=>{
 if(!developmentToken)throw Error('Temporary local token required.');
 const title='CI observed food '+randomUUID().slice(0,8);
 const saved=await request.post('http://127.0.0.1:3001/api/v1/nutrition/foods',{
  headers:{authorization:'Bearer '+developmentToken,'idempotency-key':randomUUID()},
  data:{name:title,servingLabel:'one bowl',energyKcal:190,proteinG:7,carbsG:35,fatG:2}
 });
 expect(saved.status()).toBe(201);
 await openWorkspace(page);
 await navigate(page,'Food Library');
 await expect(page.getByText(title,{exact:true})).toBeVisible();
 await expect(page.getByText('Eggs & avocado toast')).toHaveCount(0);
});
test('API disruption cannot substitute any sample records',async({page})=>{
 if(!developmentToken)throw Error('Temporary local token required.');
 await page.route('**/api/v1/nutrition/**',route=>route.abort());
 await page.goto('/?mode=live');
 await page.getByPlaceholder(/Paste the token from/).fill(developmentToken);
 await page.getByRole('button',{name:/Open development workspace/}).click();
 await expect(page.getByRole('alert')).toBeVisible({timeout:30000});
 await expect(page.getByText('Nutrition API unavailable')).toBeVisible();
});
test('login accessibility and mobile viewport stay within baseline limits',async({page,isMobile})=>{
 await page.goto('/?mode=live');
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 const serious=scan.violations.filter(v=>v.impact==='serious'||v.impact==='critical');
 expect(serious.map(v=>v.id)).toEqual([]);
 await page.keyboard.press('Tab');
 const active=await page.evaluate(()=>document.activeElement?.tagName??'');
 expect(['BUTTON','INPUT','TEXTAREA','A']).toContain(active);
 if(isMobile){
  const sizes=await page.evaluate(()=>[window.innerWidth,document.documentElement.scrollWidth]);
  expect(sizes[1]).toBeLessThanOrEqual(sizes[0]+3);
 }
});
