import {describe,it,expect} from 'vitest';
import {loadConfig} from '../config.js';
import {productionConfigBlockers,assertProductionReleaseConfig} from './security.js';
const local={
 NODE_ENV:'development',DATABASE_URL:'postgresql://nutrition_app:random@127.0.0.1:5436/nutrition_os',
 LOCAL_IDENTITY_ENABLED:'true',LOCAL_IDENTITY_SECRET:'this-is-a-local-test-secret-at-least-32-chars'
} as NodeJS.ProcessEnv;
const production={
 NODE_ENV:'production',
 DATABASE_URL:'postgresql://nutrition_runtime:runtime_secret@db.internal:5432/nutrition_os',
 LOCAL_IDENTITY_ENABLED:'false',
 KERNEL_JWKS_URL:'https://kernel.example.com/.well-known/jwks.json',
 KERNEL_ISSUER:'https://kernel.example.com/user',
 KERNEL_AUDIENCE:'nutrition-os-api',
 KERNEL_BRIDGE_JWKS_URL:'https://kernel.example.com/bridge/jwks',
 KERNEL_BRIDGE_ISSUER:'https://kernel.example.com/bridge',
 KERNEL_BRIDGE_AUDIENCE:'nutrition-os-bridge',
 CORS_ORIGINS:'https://nutrition.example.com'
} as NodeJS.ProcessEnv;
describe('Phase 8 production config fail-closed checks',()=>{
 it('does not turn development settings into production blockers',()=>{
   expect(productionConfigBlockers(loadConfig(local))).toEqual([]);
 });
 it('accepts only a structurally distinct production identity and DB authority',()=>{
   expect(productionConfigBlockers(loadConfig(production))).toEqual([]);
   expect(()=>assertProductionReleaseConfig(loadConfig(production))).not.toThrow();
 });
 it('blocks local passwords, unsecured origins and identical DB roles',()=>{
   const cfg=loadConfig({...production,
     DATABASE_URL:'postgresql://nutrition_app:nutrition_dev_only@localhost:5432/nutrition_os',
     MIGRATION_DATABASE_URL:'postgresql://nutrition_migrator:migrate_secret@db.internal:5432/nutrition_os',
     CORS_ORIGINS:'http://localhost:5173'
   });
   expect(productionConfigBlockers(cfg)).toEqual(expect.arrayContaining([
     expect.stringMatching(/separate privileged migration/),
     expect.stringMatching(/HTTPS-only CORS/),
     expect.stringMatching(/local development examples/)
   ]));
   expect(()=>assertProductionReleaseConfig(cfg)).toThrow(/Production configuration is not certifiable/);
 });
 it('requires separate machine issuer and cannot use user token audience as service authority',()=>{
   const cfg=loadConfig({...production,KERNEL_BRIDGE_ISSUER:'https://kernel.example.com/user',
     KERNEL_BRIDGE_AUDIENCE:'nutrition-os-api'});
   expect(productionConfigBlockers(cfg)).toEqual(expect.arrayContaining([
     expect.stringMatching(/user and machine service/)
   ]));
 });
 it('cannot configure production with HTTP JWKS or enabled local identity',()=>{
   expect(()=>loadConfig({...production,KERNEL_JWKS_URL:'http://kernel.example.com/jwks'})).toThrow();
   expect(()=>loadConfig({...production,LOCAL_IDENTITY_ENABLED:'true',LOCAL_IDENTITY_SECRET:'a'.repeat(64)})).toThrow();
 });
});
