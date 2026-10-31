#!/usr/bin/env node
/**
 * Phase 8.1: independent staging-only certification. It never provisions, deletes,
 * or mutates production records. Test writes require an explicitly authorized
 * synthetic account and a one-use idempotency key. Secrets are never in output.
 */
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const checks=['web_preview','api_health','identity_authentication','identity_isolation',
 'synthetic_write_idempotency','kernel_authority','kernel_event_mesh','family_authority',
 'privacy_and_safety','staging_infrastructure','operator_approval'];
const fail=(code)=>{const e=new Error(code);e.code=code;return e;};
export function httpsOrigin(raw){
 if(!raw)throw fail('NOT_CONFIGURED');
 let url;
 try{url=new URL(raw);}catch{throw fail('INVALID_URL');}
 if(url.protocol!=='https:')throw fail('HTTPS_REQUIRED');
 if(url.username||url.password||url.search||url.hash)throw fail('UNSAFE_URL');
 if(url.pathname!=='/'&&url.pathname!=='')throw fail('BASE_URL_MUST_HAVE_NO_PATH');
 return url.origin;
}
export function safeGate(state,reason){
 return {state,reason}; // No credentials, payloads or record values in evidence.
}
export function initEvidence(commit='unknown'){
 return {schemaVersion:1,phase:'8.1',subject:'Nutrition OS staging',
  checkedAt:new Date().toISOString(),commit,certification:'NOT_CERTIFIED',
  technicalStaging:'NOT_CERTIFIED',
  gates:Object.fromEntries(checks.map(k=>[k,safeGate('blocked','Not independently verified')])),
  evidenceClassification:'Synthetic/metadata-only. No tokens, nutrition records or household identifiers.'};
}
async function send(origin,path,{token,method='GET',body,originHeader}={}){
 const headers={'Accept':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(originHeader)headers.Origin=originHeader;
 if(body!==undefined){headers['Content-Type']='application/json';headers['Idempotency-Key']=randomUUID();}
 let r;
 try{
  r=await fetch(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
    redirect:'manual',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8500)});
 }catch{throw fail('NETWORK_UNAVAILABLE');}
 if(r.status>=300&&r.status<400)throw fail('REDIRECT_NOT_ALLOWED');
 let parsed=null;
 try{parsed=await r.json();}catch{/* Do not log response body. */}
 return {status:r.status,body:parsed,headers:r.headers};
}
function isUuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);}
function rejectSensitive({body}){
 const message=JSON.stringify(body??{});
 if(/"access_token"|"refresh_token"|"password"|"private_key"/i.test(message))throw fail('RESPONSE_EXPOSES_CREDENTIALS');
}
export async function certifyStaging(env=process.env,options={}){
 const proof=initEvidence(env.GITHUB_SHA??'operator-run');
 const dry=Boolean(options.dryRun);
 if(dry)return proof;
 let web,api;
 try{web=httpsOrigin(env.NUTRITION_STAGING_WEB_URL);}catch(e){
  proof.gates.web_preview=safeGate('blocked',e.code??'INVALID_WEB_URL');
 }
 try{api=httpsOrigin(env.NUTRITION_STAGING_API_URL);}catch(e){
  proof.gates.api_health=safeGate('blocked',e.code??'INVALID_API_URL');
 }
 if(web){
  try{
   const r=await send(web,'/');
   if(r.status!==200)throw fail('PREVIEW_NOT_OK');
   proof.gates.web_preview=safeGate('verified','Public staging web origin returned HTTP 200 without redirects');
  }catch(e){proof.gates.web_preview=safeGate('blocked',e.code??'PREVIEW_UNREACHABLE');}
 }
 if(api){
  try{
   const [live,ready]=await Promise.all([send(api,'/health/live'),send(api,'/health/ready')]);
   if(live.status!==200||ready.status!==200||ready.body?.status!=='ready'
    ||ready.body?.database!==true||ready.body?.migrations!==true)throw fail('API_NOT_READY');
   if(!ready.headers.get('cache-control')?.includes('no-store'))throw fail('API_RESPONSE_CACHEABLE');
   proof.gates.api_health=safeGate('verified','Live and ready endpoints, schema signature and private no-store response checked');
  }catch(e){proof.gates.api_health=safeGate('blocked',e.code??'API_UNREACHABLE');}
 }
 const token=env.NUTRITION_STAGING_TEST_USER_TOKEN;
 if(api){
  try{
   const noToken=await send(api,'/api/v1/nutrition/session');
   if(noToken.status!==401)throw fail('AUTH_BYPASS');
   const fake=await send(api,'/api/v1/nutrition/session',{originHeader:web??undefined});
   if(fake.status!==401)throw fail('FORGED_ORIGIN_AUTH_BYPASS');
   const forged=await fetch(api+'/api/v1/nutrition/session',{headers:{
    'x-user-id':randomUUID(),'x-tenant-id':randomUUID()},redirect:'manual',
    signal:AbortSignal.timeout(8500)});
   if(forged.status!==401)throw fail('SUBJECT_HEADER_AUTH_BYPASS');
   proof.gates.identity_isolation=safeGate('verified','Unsigned and header-forged identity requests rejected');
  }catch(e){proof.gates.identity_isolation=safeGate('blocked',e.code??'UNAUTHORIZED_TEST_FAILED');}
 }
 let signed=false,signedSubject=null;
 if(api&&token){
  try{
   const r=await send(api,'/api/v1/nutrition/session',{token});
   rejectSensitive(r);
   if(r.status!==200||!isUuid(r.body?.data?.userId)||!isUuid(r.body?.data?.tenantId)
    ||r.body.data.identitySource!=='kernel_verified_jwks')throw fail('REAL_KERNEL_USER_IDENTITY_UNVERIFIED');
   if(!Array.isArray(r.body.data.scopes)||!r.body.data.scopes.includes('nutrition:read'))
     throw fail('MISSING_NUTRITION_READ_SCOPE');
   signedSubject={userId:r.body.data.userId,tenantId:r.body.data.tenantId};
   signed=true;
   proof.gates.identity_authentication=safeGate('verified','Valid Kernel JWKS-issued user JWT scoped to signed user+tenant; no token stored');
  }catch(e){proof.gates.identity_authentication=safeGate('blocked',e.code??'SIGNED_IDENTITY_FAILED');}
 }else proof.gates.identity_authentication=safeGate('blocked','Kernel-issued synthetic test JWT was not configured');
 if(api&&signed){
  try{
   const r=await send(api,'/api/v1/nutrition/kernel/status',{token});
   if(r.status!==200||!r.body?.data?.bridgeConfigured||!r.body?.data?.active)
     throw fail('KERNEL_NOT_INSTALLED_AND_ACTIVE');
   proof.gates.kernel_authority=safeGate('verified','Signed user sees nonexpired Kernel-governed operational engine binding');
   // A local authority assertion does not prove external Event Mesh delivery.
   proof.gates.kernel_event_mesh=safeGate('blocked','Live bidirectional signed event receipt and acknowledgement not independently proven');
  }catch(e){proof.gates.kernel_authority=safeGate('blocked',e.code??'KERNEL_STATUS_FAILED');}
 }
 const expectedSubject={userId:env.NUTRITION_STAGING_TEST_USER_ID,
  tenantId:env.NUTRITION_STAGING_TEST_TENANT_ID};
 const syntheticBound=isUuid(expectedSubject.userId)&&isUuid(expectedSubject.tenantId)&&
  signedSubject?.userId===expectedSubject.userId&&signedSubject?.tenantId===expectedSubject.tenantId;
 if(api&&signed&&syntheticBound&&env.NUTRITION_STAGING_SYNTHETIC_ACCOUNT==='true'&&env.NUTRITION_STAGING_ALLOW_MUTATION==='true'){
  try{
   const path='/api/v1/nutrition/foods',title='STAGING-CERT-'+randomUUID();
   const body={name:title,servingLabel:'one synthetic test portion',energyKcal:0,
    proteinG:0,carbsG:0,fatG:0};
   const idempotencyKey=randomUUID();
   const headers={'Content-Type':'application/json','Accept':'application/json',
    'Authorization':'Bearer '+token,'Idempotency-Key':idempotencyKey};
   async function write(method,url,data,key){
    const r=await fetch(api+url,{method,headers:{...headers,'Idempotency-Key':key},
     body:JSON.stringify(data),redirect:'manual',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8500)});
    try{return {status:r.status,body:await r.json()};}catch{return {status:r.status,body:null};}
   }
   const first=await write('POST',path,body,idempotencyKey);
   const second=await write('POST',path,body,idempotencyKey);
   const id=first.body?.data?.id;
   if(first.status!==201||second.status!==201||!isUuid(id)||second.body?.data?.id!==id)
    throw fail('IDEMPOTENT_WRITE_FAILED');
   const deleted=await write('DELETE',path+'/'+id,{},randomUUID());
   if(deleted.status!==200)throw fail('SYNTHETIC_RECORD_RETIRE_FAILED');
   proof.gates.synthetic_write_idempotency=safeGate('verified',
    'One signed synthetic food was written, deduplicated and soft-retired; no user content exported');
  }catch(e){proof.gates.synthetic_write_idempotency=safeGate('blocked',e.code??'SYNTHETIC_WORKFLOW_FAILED');}
 }else proof.gates.synthetic_write_idempotency=safeGate('blocked',
  'Requires a verified synthetic user and matching expected tenant/user IDs plus explicit mutation authorization');
 proof.gates.family_authority=safeGate('blocked',
  'Signed external Family OS membership acceptance/revocation E2E proof not supplied');
 proof.gates.privacy_and_safety=safeGate('blocked',
  'Independent DPIA, personal-data rights and clinical/allergen/minor safety signoff not supplied');
 proof.gates.staging_infrastructure=safeGate('blocked',
  'API probes alone do not certify TLS termination, backups/PITR, worker transport, secrets or telemetry');
 proof.gates.operator_approval=safeGate('blocked','Human production/release approver signoff required');
 const technical=['web_preview','api_health','identity_authentication','identity_isolation',
  'synthetic_write_idempotency','kernel_authority'];
 proof.technicalStaging=technical.every(k=>proof.gates[k].state==='verified')
  ?'BASIC_API_CERTIFIED':'NOT_CERTIFIED';
 proof.certification=Object.values(proof.gates).every(g=>g.state==='verified')?'CERTIFIED':'NOT_CERTIFIED';
 return proof;
}
async function main(){
 const args=process.argv.slice(2);
 const result=await certifyStaging(process.env,{dryRun:args.includes('--dry-run')});
 const output=args.includes('--output')?args[args.indexOf('--output')+1]:null;
 if(output){
  if(!/^[A-Za-z0-9._/-]+\.json$/.test(output)||output.includes('..'))throw Error('Unsafe evidence output path');
  const path=resolve(output);
  await mkdir(resolve(path,'..'),{recursive:true});
  await writeFile(path,JSON.stringify(result,null,2)+'\n',{mode:0o600});
 }
 console.log(JSON.stringify(result,null,2));
 if(args.includes('--expect-blocked')&&result.certification!=='NOT_CERTIFIED')process.exitCode=1;
 if(args.includes('--require-technical')&&result.technicalStaging!=='BASIC_API_CERTIFIED')process.exitCode=1;
 if(args.includes('--require-certified')&&result.certification!=='CERTIFIED')process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main().catch(e=>{console.error(e?.code??'STAGING_CERTIFICATION_ERROR');process.exitCode=2;});
}
