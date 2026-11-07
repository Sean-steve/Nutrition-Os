#!/usr/bin/env node
/** Protect neighboring developer projects: never auto-kill or reuse listeners. */
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export async function portAvailable(port,host='127.0.0.1'){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid TCP port');
 const server=createServer();
 try{
  await new Promise((ok,fail)=>{
   server.once('error',fail);
   server.listen(port,host,ok);
  });
  return true;
 }catch(e){
  if(e?.code==='EADDRINUSE')return false;
  throw e;
 }finally{
  if(server.listening)await new Promise(done=>server.close(done));
 }
}
async function main(){
 for(const raw of process.argv.slice(2)){
  const port=Number(raw);
  if(!await portAvailable(port)){
   console.error('TCP port '+port+' is occupied. Nutrition OS will not reuse or stop the other process.');
   console.error("Inspect it with: sudo ss -ltnp | grep ':"+port+"'");
   process.exitCode=1;
  }
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{console.error('Local port preflight failed.');process.exitCode=2;});
