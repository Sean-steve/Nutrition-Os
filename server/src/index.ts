import {loadConfig} from './config.js';
import {makePool,assertNoBypassRls} from './db.js';
import {buildApp} from './http.js';
async function main(){
  const config=loadConfig();
  const pool=makePool(config.databaseUrl);
  try{
    // Never run the HTTP API as a migration owner, superuser or BYPASSRLS role.
    await assertNoBypassRls(pool);
    const app=await buildApp({pool,config});
    const close=async()=>{await app.close();await pool.end();};
    process.once('SIGINT',()=>{void close().then(()=>process.exit(0));});
    process.once('SIGTERM',()=>{void close().then(()=>process.exit(0));});
    await app.listen({port:config.apiPort,host:config.host});
    process.stdout.write('Nutrition OS API listening at '+config.host+':'+config.apiPort+'\n');
  }catch(error){
    await pool.end();
    throw error;
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Server start failed.');process.exitCode=1;});
