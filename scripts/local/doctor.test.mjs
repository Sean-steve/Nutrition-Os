import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectConfig,checkReady,parseEnv} from './doctor.mjs';
const env=(overrides={})=>{
 const v={NODE_ENV:'development',HOST:'127.0.0.1',API_PORT:'3001',
 LOCAL_IDENTITY_ENABLED:'true',LOCAL_IDENTITY_SECRET:'a'.repeat(40),
 DATABASE_URL:'postgresql://nutrition_app:test-password@127.0.0.1:5436/nutrition_os',
 MIGRATION_DATABASE_URL:'postgresql://postgres:admin-password@127.0.0.1:5436/nutrition_os',...overrides};
 return Object.entries(v).map(([k,x])=>k+'='+x).join('\n');
};
test('a local isolated backend with distinct DB roles passes configuration preflight',()=>{
 assert.equal(inspectConfig(env()).ok,true);
});
test('refuses remote databases, privileged app role and placeholder JWT secrets',()=>{
 for(const x of [
 {DATABASE_URL:'postgresql://nutrition_app:pw@outside.example:5432/nutrition_os'},
 {DATABASE_URL:'postgresql://postgres:pw@127.0.0.1:5436/nutrition_os'},
 {LOCAL_IDENTITY_SECRET:'replace-with-at-least-32-random-characters-for-dev'},
 {NODE_ENV:'production'},{HOST:'0.0.0.0'},
 {MIGRATION_DATABASE_URL:'postgresql://nutrition_app:pw@127.0.0.1:5436/nutrition_os'}
 ])assert.equal(inspectConfig(env(x)).ok,false);
});
test('rejects duplicate env variables (no secret override)',()=>{
 assert.throws(()=>parseEnv('DATABASE_URL=a\nDATABASE_URL=b'),/Duplicate/);
});
test('health doctor requires database readiness and unauthorized requests to be rejected',async()=>{
 const fake=async url=>{
  const path=String(url);
  const isReady=path.includes('/health/ready'),isLive=path.includes('/health/live');
  return {status:isReady||isLive?200:401,
    json:async()=>isLive?{status:'alive',service:'nutrition-os-api'}:
      {status:'ready',database:true,migrations:true}};
 };
 assert.equal((await checkReady(fake)).ok,true);
 const bypass=async url=>({status:200,json:async()=>({status:'ready',database:true,migrations:true})});
 assert.equal((await checkReady(bypass)).ok,false);
});
