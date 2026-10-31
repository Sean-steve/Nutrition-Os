import 'dotenv/config';
import {signLocalToken} from './auth.js';
import {loadConfig} from './config.js';
async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('Local tokens are forbidden in production.');
  const userId=process.env.USER_ID??'11111111-1111-4111-8111-111111111111';
  const tenantId=process.env.TENANT_ID??'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const config=loadConfig();
  const scopes=(process.env.SCOPES??'nutrition:read nutrition:write').split(' ');
  const token=await signLocalToken(config,{userId,tenantId,scopes});
  process.stdout.write(token+'\n');
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
