import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:'*.pw.ts',
 fullyParallel:false,forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,workers:process.env.CI?2:undefined,
 reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
 timeout:40000,
 use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
  {name:'mobile-chromium',use:{...devices['Pixel 7']}}
 ],
 webServer:[
  {command:'npm --prefix server run dev',url:'http://127.0.0.1:3001/health/ready',
   reuseExistingServer:!process.env.CI,timeout:120000,
   env:{...process.env,HOST:'127.0.0.1',API_PORT:'3001'}},
  {command:'npm run dev -- --host 127.0.0.1',url:'http://127.0.0.1:5173/?mode=preview',
   reuseExistingServer:!process.env.CI,timeout:120000}
 ]
});
