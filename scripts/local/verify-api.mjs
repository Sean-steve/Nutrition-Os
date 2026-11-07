#!/usr/bin/env node
/** Distinguish a wrong service on :3001 from a stale/missing Vite proxy on :5173. */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const direct='http://127.0.0.1:3001',viaVite='http://127.0.0.1:5173';
export async function verifyLocalApi(mode,fetchImpl=fetch){
 const src=mode==='--through-vite'?viaVite:direct;
 if(mode!=='--direct'&&mode!=='--through-vite')
  throw Error('Specify --direct or --through-vite');
 try{
  const check=async(url)=>{
   const r=await fetchImpl(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(3000)});
   let body=null;try{body=await r.json();}catch{}
   return {status:r.status,body};
  };
  if(mode==='--direct'){
   const live=await check(direct+'/health/live');
   if(live.status!==200||live.body?.service!=='nutrition-os-api'||live.body?.status!=='alive')
    return {ok:false,reason:'Port 3001 is not serving the Nutrition OS backend.'};
  }
  for(const path of ['/session','/foods']){
   const r=await check(src+'/api/v1/nutrition'+path);
   if(r.status!==401||r.body?.error?.code!=='UNAUTHENTICATED')
    return {ok:false,reason:mode==='--direct'
      ?'Unexpected Nutrition OS API response on port 3001.'
      :'Port 5173 is not proxying /api to the Nutrition OS backend on 3001.'};
  }
  return {ok:true,reason:mode==='--direct'?'Nutrition API confirmed on 3001.':'Vite proxy confirmed on 5173.'};
 }catch{
  return {ok:false,reason:'Nutrition API or Vite proxy is unreachable. Ensure both servers are running.'};
 }
}
async function main(){
 const res=await verifyLocalApi(process.argv[2]);
 console.log(res.reason);
 if(!res.ok)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{console.error('Local API identity check failed.');process.exitCode=2;});
