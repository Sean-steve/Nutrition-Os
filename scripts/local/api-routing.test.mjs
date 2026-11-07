import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {portAvailable} from './ports.mjs';
import {verifyLocalApi} from './verify-api.mjs';
test('refuses a port occupied by another app without stopping it',async()=>{
 const listener=createServer();
 await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
 try{assert.equal(await portAvailable(listener.address().port),false);}
 finally{await new Promise(resolve=>listener.close(resolve));}
});
test('rejects wrong backend and stale Vite route while allowing real unauthenticated 401',async()=>{
 const good=async(url)=>{
  const path=String(url);
  const isLive=path.endsWith('/health/live');
  return {status:isLive?200:401,json:async()=>isLive?{service:'nutrition-os-api',status:'alive'}:
   {error:{code:'UNAUTHENTICATED'}}};
 };
 const stale=async(url)=>({status:404,json:async()=>({error:{message:'Unknown API route.'}})});
 const wrong=async(url)=>({status:200,json:async()=>({service:'other-project'})});
 assert.equal((await verifyLocalApi('--direct',good)).ok,true);
 assert.equal((await verifyLocalApi('--through-vite',good)).ok,true);
 assert.equal((await verifyLocalApi('--through-vite',stale)).ok,false);
 assert.equal((await verifyLocalApi('--direct',wrong)).ok,false);
});
