import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEnv,validateStagingEnv} from './preflight.mjs';
test('reject duplicate configuration keys rather than silently taking attacker override',()=>{
 assert.throws(()=>parseEnv('KEY=one\nKEY=two'),/DUPLICATE_ENV_SETTING/);
});
test('reject placeholders, unpinned images, HTTP JWKS, privileged app DB roles',()=>{
 const r=validateStagingEnv(parseEnv('STAGING_POSTGRES_IMAGE=postgres:16-alpine\nSTAGING_APP_DATABASE_URL=postgresql://postgres:bad@localhost:5432/db'));
 assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('digest')));
 assert.ok(r.errors.some(x=>x.includes('STAGING_APP_DATABASE_URL')));
});
test('accept fully pinned sample structure with distinct private user and migrator roles',()=>{
 const a='a'.repeat(32),b='b'.repeat(32),dg='a'.repeat(64);
 const values={STAGING_POSTGRES_IMAGE:'postgres:16-alpine@sha256:'+dg,
  NUTRITION_STAGING_IMAGE:'registry.internal/nutrition-os@sha256:'+dg,
  STAGING_POSTGRES_PASSWORD:a,STAGING_APP_DB_PASSWORD:b,
  STAGING_MIGRATION_DATABASE_URL:'postgresql://postgres:'+a+'@postgres:5432/nutrition_os_staging',
  STAGING_APP_DATABASE_URL:'postgresql://nutrition_app:'+b+'@postgres:5432/nutrition_os_staging',
  STAGING_WEB_ORIGIN:'https://staging.nutrition.example.net',
  KERNEL_JWKS_URL:'https://hos.example.net/jwks',KERNEL_ISSUER:'https://hos.example.net',
  KERNEL_AUDIENCE:'nutrition-os-api',
  KERNEL_BRIDGE_JWKS_URL:'https://hos.example.net/bridge/jwks',
  KERNEL_BRIDGE_ISSUER:'https://hos.example.net/bridge',
  KERNEL_BRIDGE_AUDIENCE:'nutrition-os-bridge'};
 assert.deepEqual(validateStagingEnv(values),{ok:true,errors:[]});
});
