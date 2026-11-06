#!/usr/bin/env node
/** Read-only, local-only configuration and health doctor. No secret output. */
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const cwd=resolve(fileURLToPath(import.meta.url),'../../..');
const root=resolve(cwd,'..'); // script lives in <repo>/scripts/local/
const isLocal=(h)=>['127.0.0.1','localhost','[::1]','::1'].includes(h);
export function parseEnv(content){
 const values={};
 for(const row of content.split(/\r?\n/)){
  const line=row.trim();
  if(!line||line.startsWith('#'))continue;
  const match=line.match(/^([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)$/);
  if(!match)throw Error('Invalid environment format.'); 
  const k=match[1],v=match[2].replace(/^"(.*)"$/,'$1');
  if(Object.hasOwn(values,k))throw Error('Duplicate environment key: '+k);
  values[k]=v;
 }
 return values;
}
export function inspectConfig(raw){
 const issues=[],v=parseEnv(raw);
 if(v.NODE_ENV==='production')issues.push('L1 refuses NODE_ENV=production.');
 if(v.LOCAL_IDENTITY_ENABLED!=='true')issues.push('Development token identity is not enabled.');
 if(!v.LOCAL_IDENTITY_SECRET||v.LOCAL_IDENTITY_SECRET.length<32||v.LOCAL_IDENTITY_SECRET.includes('replace-with-'))
  issues.push('Replace the example JWT signing secret with 32+ random characters.');
 let app,migrator;
 for(const [k,field] of [['DATABASE_URL','app'],['MIGRATION_DATABASE_URL','migrator']]){
  try{
   const u=new URL(v[k]);
   if(!['postgres:','postgresql:'].includes(u.protocol)||!isLocal(u.hostname)||
       !u.pathname||!u.password)throw Error('Invalid DB URL');
   if(field==='app')app=u;else migrator=u;
  }catch{issues.push(k+' must be a credentialed local-only PostgreSQL URL.');}
 }
 if(app&&['postgres','root'].includes(app.username))issues.push('App HTTP role must be non-superuser.');
 if(app&&migrator&&app.username===migrator.username)
  issues.push('Use separate HTTP and migration database roles.');
 if(app&&migrator&&(app.hostname!==migrator.hostname||app.port!==migrator.port||app.pathname!==migrator.pathname))
  issues.push('Both DB URLs should point at the same dedicated LOCAL database.');
 if(v.HOST&&!isLocal(v.HOST))issues.push('API HOST must bind to loopback for local L1.');
 if(v.API_PORT&&v.API_PORT!=='3001')issues.push('API_PORT must be 3001 unless the Vite proxy is updated.');
 return {ok:issues.length===0,checks:{
  localDatabase:Boolean(app&&migrator&&isLocal(app.hostname)&&isLocal(migrator.hostname)),
  restrictedAppRole:Boolean(app&&!['postgres','root'].includes(app.username)),
  distinctRoles:Boolean(app&&migrator&&app.username!==migrator.username),
  developmentIdentity:v.LOCAL_IDENTITY_ENABLED==='true'
 },issues};
}
export async function checkReady(fetchImpl=fetch){
 const controller=AbortSignal.timeout(4000);
 try{
  const [health,anonymous]=await Promise.all([
   fetchImpl('http://127.0.0.1:3001/health/ready',{signal:controller,redirect:'error'}),
   fetchImpl('http://127.0.0.1:3001/api/v1/nutrition/session',{signal:controller,redirect:'error'})
  ]);
  if(health.status!==200||anonymous.status!==401)
   return {ok:false,issues:['Local API not ready or unsigned session not denied.']};
  const body=await health.json();
  const ok=body.status==='ready'&&body.database===true&&body.migrations===true;
  return {ok,issues:ok?[]:['Database/migration readiness is not yet confirmed.']};
 }catch{return {ok:false,issues:['Cannot reach API at 127.0.0.1:3001.']};}
}
async function main(){
 const path=resolve(process.cwd(),'server/.env');
 let content,mode;
 try{content=readFileSync(path,'utf8');mode=statSync(path).mode;}
 catch{console.error('No server/.env. Run local launcher or configure native PostgreSQL first.');process.exitCode=1;return;}
 const report=inspectConfig(content);
 if((mode&0o077)!==0)report.issues.push('server/.env is accessible to group/others. chmod 600 server/.env');
 report.ok=report.issues.length===0;
 if(process.argv.includes('--ready')){
  const ready=await checkReady();
  report.readiness=ready.ok?'ready':'blocked';report.issues.push(...ready.issues);
  report.ok=report.ok&&ready.ok;
 }
 // Do not print raw connection strings, values, credentials or JWTs.
 console.log(JSON.stringify(report,null,2));
 if(!report.ok)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{console.error('Local doctor failed without exposing configuration secrets.');process.exitCode=2;});
