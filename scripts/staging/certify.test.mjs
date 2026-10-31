import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {certifyStaging,httpsOrigin,initEvidence} from './certify.mjs';
const original=globalThis.fetch;
afterEach(()=>{globalThis.fetch=original;});
test('enforces HTTPS base URLs and rejects credential-bearing / redirected origins',()=>{
 assert.equal(httpsOrigin('https://nutrition-stage.example.org'),'https://nutrition-stage.example.org');
 for(const bad of ['http://nutrition-stage.example.org','https://user:pass@example.org',
  'https://example.org/real-path','https://example.org?access_token=x','https://example.org/#token',
  '','not a URL'])assert.throws(()=>httpsOrigin(bad));
});
test('dry-run never accesses the network and always blocks missing live proof',async()=>{
 globalThis.fetch=()=>{throw Error('network must not be used for dry runs');};
 const result=await certifyStaging({}, {dryRun:true});
 assert.equal(result.certification,'NOT_CERTIFIED');
 assert.equal(Object.keys(result.gates).length,11);
 assert.ok(Object.values(result.gates).every(x=>x.state==='blocked'));
 assert.ok(!JSON.stringify(result).includes('Bearer '));
});
test('signed identity cannot be certified by fake page status or untrusted local token',async()=>{
 const fake=(url,options={})=>{
  const p=new URL(String(url)).pathname;
  const token=options.headers?.Authorization;
  const status=p.includes('/health')?200:p==='/api/v1/nutrition/session'&&token?200:401;
  const payload=p==='/health/ready'?{status:'ready',database:true,migrations:true}:
    p==='/api/v1/nutrition/session'&&token?{data:{userId:'11111111-1111-4111-8111-111111111111',
      tenantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',scopes:['nutrition:read'],
      identitySource:'development_signed_token'}}:{};
  return Promise.resolve(new Response(JSON.stringify(payload),{status,
   headers:{'cache-control':'no-store','content-type':'application/json'}}));
 };
 globalThis.fetch=fake;
 const result=await certifyStaging({NUTRITION_STAGING_WEB_URL:'https://stage.example',
  NUTRITION_STAGING_API_URL:'https://api.stage.example',
  NUTRITION_STAGING_TEST_USER_TOKEN:'not-output-to-report'}, {});
 assert.equal(result.gates.api_health.state,'verified');
 assert.equal(result.gates.identity_authentication.state,'blocked');
 assert.equal(result.gates.synthetic_write_idempotency.state,'blocked');
 assert.equal(result.gates.kernel_event_mesh.state,'blocked');
 assert.equal(result.certification,'NOT_CERTIFIED');
 assert.ok(!JSON.stringify(result).includes('not-output-to-report'));
});
test('unauthenticated endpoint advertising success is a staging security failure',async()=>{
 globalThis.fetch=async(url)=>{
  const p=new URL(String(url)).pathname;
  return new Response(JSON.stringify(p==='/health/ready'?{
   status:'ready',database:true,migrations:true}:{data:{fake:true}}),
   {status:200,headers:{'cache-control':'no-store','content-type':'application/json'}});
 };
 const r=await certifyStaging({NUTRITION_STAGING_WEB_URL:'https://stage.example',
  NUTRITION_STAGING_API_URL:'https://api.stage.example'});
 assert.equal(r.gates.identity_isolation.state,'blocked');
 assert.equal(r.gates.identity_isolation.reason,'AUTH_BYPASS');
 assert.equal(r.certification,'NOT_CERTIFIED');
});
test('all critical cross-system approvals remain blocked without external evidence',()=>{
 const evidence=initEvidence('immutable-sha');
 for(const key of ['kernel_event_mesh','family_authority','privacy_and_safety',
  'staging_infrastructure','operator_approval'])assert.equal(evidence.gates[key].state,'blocked');
});

test('real technical gates can pass while independent release approval stays blocked',async()=>{
 const recordId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const token='short-lived-synthetic-token';
 globalThis.fetch=async(url,options={})=>{
  const p=new URL(String(url)).pathname,auth=options.headers?.Authorization;
  let status=200,body={};
  if(p==='/health/ready')body={status:'ready',database:true,migrations:true};
  else if(p==='/api/v1/nutrition/session'){
   if(auth!== 'Bearer '+token)status=401;
   else body={data:{userId:'11111111-1111-4111-8111-111111111111',
    tenantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',scopes:['nutrition:read'],
    identitySource:'kernel_verified_jwks'}};
  }else if(p==='/api/v1/nutrition/kernel/status'){
   if(auth!== 'Bearer '+token)status=401;
   else body={data:{bridgeConfigured:true,active:true}};
  }else if(p==='/api/v1/nutrition/foods'&&options.method==='POST'){
   status=201;body={data:{id:recordId}};
  }else if(p==='/api/v1/nutrition/foods/'+recordId&&options.method==='DELETE'){
   status=200;body={data:{id:recordId,retired:true}};
  }
  return new Response(JSON.stringify(body),{status,headers:{
   'cache-control':'no-store','content-type':'application/json'}});
 };
 const r=await certifyStaging({
  NUTRITION_STAGING_WEB_URL:'https://nutrition.example.net',
  NUTRITION_STAGING_API_URL:'https://api.nutrition.example.net',
  NUTRITION_STAGING_TEST_USER_TOKEN:token,
  NUTRITION_STAGING_SYNTHETIC_ACCOUNT:'true',
  NUTRITION_STAGING_ALLOW_MUTATION:'true'
 });
 assert.equal(r.technicalStaging,'BASIC_API_CERTIFIED');
 assert.equal(r.certification,'NOT_CERTIFIED');
 assert.equal(r.gates.kernel_event_mesh.state,'blocked');
 assert.equal(r.gates.operator_approval.state,'blocked');
 assert.ok(!JSON.stringify(r).includes(token));
});
