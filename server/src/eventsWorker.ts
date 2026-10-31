/**
 * Transactional outbox relay. Phase 5 supplies the leased delivery mechanism.
 * Local stdout delivery is expressly a TEST SINK; production requires a real broker
 * adapter, Kernel contract verification, restricted worker credentials and monitoring.
 */
import 'dotenv/config';
import {Pool} from 'pg';
type OutboxEvent={id:string;tenant_id:string;user_id:string;event_type:string;event_version:number;aggregate_type:string;aggregate_id:string;data:Record<string,unknown>;correlation_id:string;attempts:number};
export async function claimBatch(pool:Pool,limit=20):Promise<OutboxEvent[]>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query("WITH claim AS (SELECT id FROM nutrition.event_outbox WHERE (state='pending' AND available_at<=now()) OR (state='leased' AND leased_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE nutrition.event_outbox o SET state='leased',leased_until=now()+interval '60 seconds',attempts=attempts+1 FROM claim WHERE o.id=claim.id RETURNING o.id,o.tenant_id,o.user_id,o.event_type,o.event_version,o.aggregate_type,o.aggregate_id,o.data,o.correlation_id,o.attempts",
      [Math.min(100,Math.max(1,limit))]);
    await client.query('COMMIT');return result.rows as OutboxEvent[];
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function acknowledge(pool:Pool,id:string):Promise<void>{
  await pool.query("UPDATE nutrition.event_outbox SET state='published',published_at=now(),leased_until=NULL WHERE id=$1 AND state='leased'",[id]);
}
export async function retry(pool:Pool,id:string,attempts:number):Promise<void>{
  const dead=attempts>=8;
  await pool.query("UPDATE nutrition.event_outbox SET state=$2,leased_until=NULL,available_at=now()+($3::integer * interval '1 second') WHERE id=$1 AND state='leased'",
    [id,dead?'dead':'pending',Math.min(3600,2**Math.min(12,attempts))]);
}
export async function deliverLocalBatch(pool:Pool):Promise<number>{
  if(process.env.NODE_ENV==='production')throw new Error('Local stdout outbox sink prohibited in production.');
  const events=await claimBatch(pool);
  for(const e of events){
    try{
      // Envelope only: never print food descriptions, patient context or private records.
      process.stdout.write(JSON.stringify({
        event_id:e.id,event_type:e.event_type,event_version:e.event_version,
        tenant_id:e.tenant_id,user_id:e.user_id,aggregate_type:e.aggregate_type,
        aggregate_id:e.aggregate_id,correlation_id:e.correlation_id,
        source:'nutrition-os',delivery:'local_test_sink_not_kernel'
      })+'\n');
      await acknowledge(pool,e.id);
    }catch{await retry(pool,e.id,e.attempts);}
  }
  return events.length;
}
async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('Configure a production broker adapter before enabling an event worker.');
  const url=process.env.WORKER_DATABASE_URL??process.env.MIGRATION_DATABASE_URL;
  if(!url)throw new Error('WORKER_DATABASE_URL is required. Never use the HTTP role for global outbox leasing.');
  const pool=new Pool({connectionString:url,max:3});
  try{
    await deliverLocalBatch(pool);
  }finally{await pool.end();}
}
const direct=process.argv[1]?.endsWith('eventsWorker.ts')||process.argv[1]?.endsWith('eventsWorker.js');
if(direct)main().catch(e=>{console.error(e instanceof Error?e.message:'Worker failed.');process.exitCode=1;});
