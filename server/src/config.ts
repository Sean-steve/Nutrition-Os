import 'dotenv/config';
import {z} from 'zod';

const envSchema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  HOST:z.string().default('127.0.0.1'),
  API_PORT:z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL:z.string().min(1),
  MIGRATION_DATABASE_URL:z.string().optional(),
  LOCAL_IDENTITY_ENABLED:z.enum(['true','false']).default('false'),
  LOCAL_IDENTITY_SECRET:z.string().optional(),
  KERNEL_JWKS_URL:z.string().url().optional(),
  KERNEL_ISSUER:z.string().optional(),
  KERNEL_AUDIENCE:z.string().optional(),
  CORS_ORIGINS:z.string().default(''),
});
export type Config={
  nodeEnv:'development'|'test'|'production';host:string;apiPort:number;databaseUrl:string;
  migrationDatabaseUrl:string;localIdentityEnabled:boolean;localIdentitySecret:string|undefined;
  kernelJWKSUrl:string|undefined;kernelIssuer:string|undefined;kernelAudience:string|undefined;
  corsOrigins:string[];
};
export function loadConfig(source:NodeJS.ProcessEnv=process.env):Config{
  const e=envSchema.parse(source);
  const localIdentityEnabled=e.LOCAL_IDENTITY_ENABLED==='true';
  if(localIdentityEnabled && e.NODE_ENV==='production')throw new Error('Local identity cannot run in production.');
  if(localIdentityEnabled && (!e.LOCAL_IDENTITY_SECRET || e.LOCAL_IDENTITY_SECRET.length<32))throw new Error('Local identity secret needs at least 32 characters.');
  if(!localIdentityEnabled && (!e.KERNEL_JWKS_URL || !e.KERNEL_ISSUER || !e.KERNEL_AUDIENCE))throw new Error('Configure Kernel JWKS, issuer and audience. Local identity is development-only.');
  return {nodeEnv:e.NODE_ENV,host:e.HOST,apiPort:e.API_PORT,databaseUrl:e.DATABASE_URL,
    migrationDatabaseUrl:e.MIGRATION_DATABASE_URL??e.DATABASE_URL,
    localIdentityEnabled,localIdentitySecret:e.LOCAL_IDENTITY_SECRET,
    kernelJWKSUrl:e.KERNEL_JWKS_URL,kernelIssuer:e.KERNEL_ISSUER,kernelAudience:e.KERNEL_AUDIENCE,
    corsOrigins:e.CORS_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean)};
}
