import 'dotenv/config';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {Pool} from 'pg';
async function run(){
  const url=process.env.MIGRATION_DATABASE_URL;
  if(!url)throw new Error('MIGRATION_DATABASE_URL is required for migrations.');
  const pool=new Pool({connectionString:url});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA IF NOT EXISTS nutrition');
    await client.query('CREATE TABLE IF NOT EXISTS nutrition.schema_migrations(filename text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
    const dir=join(process.cwd(),'migrations');
    for(const filename of (await readdir(dir)).filter(f=>/^\d+_.+\.sql$/.test(f)).sort()){
      const source=await readFile(join(dir,filename),'utf8');
      const checksum=createHash('sha256').update(source).digest('hex');
      const result=await client.query('SELECT sha256 FROM nutrition.schema_migrations WHERE filename=$1',[filename]);
      if(result.rows.length){
        if(result.rows[0].sha256!==checksum)throw new Error('Migration checksum drift: '+filename);
        continue;
      }
      await client.query(source);
      await client.query('INSERT INTO nutrition.schema_migrations(filename,sha256) VALUES($1,$2)',[filename,checksum]);
      process.stdout.write('Applied '+filename+'\n');
    }
    // Only explicit local development bootstrap may create a database login.
    if(process.env.ENABLE_DEV_DB_ROLE==='true'){
      if(process.env.NODE_ENV==='production')throw new Error('Dev DB role forbidden in production.');
      const password=process.env.DEV_DB_ROLE_PASSWORD;
      if(!password || password.length<16)throw new Error('DEV_DB_ROLE_PASSWORD must be >=16 characters.');
      const role=await client.query("SELECT 1 FROM pg_roles WHERE rolname='nutrition_app'");
      if(!role.rows.length)await client.query("CREATE ROLE nutrition_app LOGIN PASSWORD '"+password.replace(/'/g,"''")+"'");
      await client.query('ALTER ROLE nutrition_app NOSUPERUSER NOBYPASSRLS');
      await client.query('GRANT USAGE ON SCHEMA nutrition TO nutrition_app');
      const rw=['profile','food','recipe','recipe_ingredient','goal','meal','meal_item','meal_plan','planned_meal','inventory_lot','grocery_list','grocery_line','food_budget','idempotency_receipt','event_inbox'];
      for(const table of rw)await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON nutrition.'+table+' TO nutrition_app');
      await client.query('GRANT SELECT,INSERT ON nutrition.inventory_movement TO nutrition_app');
      await client.query('GRANT INSERT ON nutrition.audit_event TO nutrition_app');
      await client.query('GRANT INSERT ON nutrition.event_outbox TO nutrition_app');
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();await pool.end();}
}
run().catch(error=>{console.error(error instanceof Error?error.message:'Migration failed.');process.exitCode=1;});
