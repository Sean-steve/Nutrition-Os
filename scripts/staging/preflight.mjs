#!/usr/bin/env node
/** Offline staging env validation. Never prints database URLs, tokens or passwords. */
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {httpsOrigin} from './certify.mjs';
const required=['STAGING_POSTGRES_IMAGE','NUTRITION_STAGING_IMAGE','STAGING_POSTGRES_PASSWORD',
 'STAGING_APP_DB_PASSWORD','STAGING_MIGRATION_DATABASE_URL','STAGING_APP_DATABASE_URL',
 'STAGING_WEB_ORIGIN','KERNEL_JWKS_URL','KERNEL_ISSUER','KERNEL_AUDIENCE',
 'KERNEL_BRIDGE_JWKS_URL','KERNEL_BRIDGE_ISSUER','KERNEL_BRIDGE_AUDIENCE'];
const blocked=(code)=>{const e=new Error(code);e.code=code;return e;};
export function parseEnv(raw){
 const env={};
 for(const line of raw.split(/\r?\n/)){
  const trimmed=line.trim();
  if(!trimmed||trimmed.startsWith('#'))continue;
  const match=trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if(!match)throw blocked('INVALID_ENV_LINE');
  if(Object.hasOwn(env,match[1]))throw blocked('DUPLICATE_ENV_SETTING');
  env[match[1]]=match[2].trim().replace(/^"(.*)"$/,'$1');
 }
 return env;
}
export function validateStagingEnv(env){
 const errors=[];
 for(const key of required){
  const val=env[key];
  if(!val||/REPLACE_|example\.org|URL_ENCODED|placeholder/i.test(val))
   errors.push(key+': missing/placeholder');
 }
 const digest=/@sha256:[0-9a-f]{64}$/i;
 for(const key of ['STAGING_POSTGRES_IMAGE','NUTRITION_STAGING_IMAGE'])
  if(!digest.test(env[key]??''))errors.push(key+': image MUST be pinned by immutable sha256 digest');
 for(const key of ['STAGING_POSTGRES_PASSWORD','STAGING_APP_DB_PASSWORD'])
  if((env[key]??'').length<24)errors.push(key+': must have at least 24 characters');
 if(env.STAGING_POSTGRES_PASSWORD&&env.STAGING_APP_DB_PASSWORD&&
  env.STAGING_POSTGRES_PASSWORD===env.STAGING_APP_DB_PASSWORD)errors.push('DB secrets must be distinct');
 for(const key of ['KERNEL_JWKS_URL','KERNEL_BRIDGE_JWKS_URL']){
  try{
   const url=new URL(env[key]);
   if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)
    throw new Error();
  }catch{errors.push(key+': remote JWKS must be HTTPS and cannot embed secrets');}
 }
 try{httpsOrigin(env.STAGING_WEB_ORIGIN);}catch{errors.push('STAGING_WEB_ORIGIN: HTTPS origin required');}
 if(env.KERNEL_ISSUER&&env.KERNEL_BRIDGE_ISSUER&&
   env.KERNEL_ISSUER===env.KERNEL_BRIDGE_ISSUER)errors.push('Separate user and bridge issuer required');
 if(env.KERNEL_AUDIENCE&&env.KERNEL_BRIDGE_AUDIENCE&&
   env.KERNEL_AUDIENCE===env.KERNEL_BRIDGE_AUDIENCE)errors.push('Separate user and bridge audience required');
 for(const [key,username,passwordKey] of [
  ['STAGING_MIGRATION_DATABASE_URL','postgres','STAGING_POSTGRES_PASSWORD'],
  ['STAGING_APP_DATABASE_URL','nutrition_app','STAGING_APP_DB_PASSWORD']
 ]){
  try{
   const url=new URL(env[key]);
   if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='postgres'||
    url.username!==username||url.pathname!=='/nutrition_os_staging'||
    decodeURIComponent(url.password)!==env[passwordKey])throw new Error();
  }catch{errors.push(key+': must use correct separate DB role, private postgres DNS and matching secret');}
 }
 return {ok:errors.length===0,errors};
}
async function main(){
 const file=process.argv[2]??'infra/staging/.env.staging';
 const details=await stat(file);
 if((details.mode&0o077)!==0)throw blocked('ENV_FILE_PERMISSIONS_TOO_OPEN');
 const values=parseEnv(await readFile(file,'utf8')),result=validateStagingEnv(values);
 console.log(JSON.stringify(result,null,2));
 if(!result.ok)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(e?.code??'STAGING_PREFLIGHT_FAILED');process.exitCode=2;});
}
