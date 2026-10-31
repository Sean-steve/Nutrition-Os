import {Pool,type PoolClient} from 'pg';
import type {Actor} from './auth.js';
export type SqlClient=PoolClient;
export function makePool(url:string):Pool{
  return new Pool({connectionString:url,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
}
export async function scopedTransaction<T>(pool:Pool,actor:Actor,fn:(db:SqlClient)=>Promise<T>):Promise<T>{
  const db=await pool.connect();
  try{
    await db.query('BEGIN');
    // Transaction-local settings cannot leak into the next pooled request.
    await db.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.user_id',$2,true),set_config('app.kernel_family_required',$3,true)",
    [actor.tenantId,actor.userId,(process.env.NODE_ENV==='production'||process.env.KERNEL_FAMILY_AUTHORITY_REQUIRED==='true')?'on':'off']);
    const result=await fn(db);
    await db.query('COMMIT');
    return result;
  }catch(error){
    await db.query('ROLLBACK');
    throw error;
  }finally{db.release();}
}
export async function assertNoBypassRls(pool:Pool):Promise<void>{
  const result=await pool.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user");
  if(result.rows.length!==1 || result.rows[0].rolsuper || result.rows[0].rolbypassrls){
    throw new Error('HTTP database role must not be superuser or BYPASSRLS.');
  }
}
