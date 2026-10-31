/**
 * Phase 8 production hard-stop. CI uses development/test settings only.
 * Production cannot silently boot with demo credentials, unverified Kernel
 * machine trust, open CORS or a migration/superuser database connection.
 */
import type {Config} from '../config.js';

export class ReleaseConfigError extends Error{
 constructor(public readonly blockers:string[]){super('Production configuration is not certifiable: '+blockers.join('; '));}
}
export function productionConfigBlockers(config:Config):string[]{
 if(config.nodeEnv!=='production')return [];
 const failed:string[]=[];
 if(config.localIdentityEnabled)failed.push('Local development identity may not run in production.');
 const https=(raw:string|undefined)=>Boolean(raw&&new URL(raw).protocol==='https:');
 if(!https(config.kernelJWKSUrl)||!config.kernelIssuer||!config.kernelAudience)
  failed.push('Kernel user token issuer, audience and HTTPS JWKS must be configured.');
 if(!https(config.kernelBridgeJWKSUrl)||!config.kernelBridgeIssuer||!config.kernelBridgeAudience)
  failed.push('Distinct signed Kernel service bridge issuer/audience and HTTPS JWKS must be configured.');
 if(config.kernelIssuer===config.kernelBridgeIssuer && config.kernelAudience===config.kernelBridgeAudience)
  failed.push('Kernel user and machine service issuers/audiences may not be identical.');
 if(config.corsOrigins.length===0||config.corsOrigins.some(x=>{try{
   const u=new URL(x);
   return u.protocol!=='https:'||u.pathname!=='/'||u.search!==''||u.hash!==''||x==='*';
  }catch{return true;}}))
  failed.push('Explicit HTTPS-only CORS origin allowlist required.');
 if(config.databaseUrl===config.migrationDatabaseUrl)
  failed.push('HTTP pool and privileged migration database identities must be distinct.');
 if(/nutrition_dev_only|nutrition_dev_admin|password=|localhost|127\.0\.0\.1/i.test(config.databaseUrl))
  failed.push('Application database connection cannot use local development examples.');
 if(/nutrition_dev_only|nutrition_dev_admin/i.test(config.migrationDatabaseUrl))
  failed.push('Privileged migration connection cannot use development example credentials.');
 if(!config.databaseUrl)failed.push('Application database URL missing.');
 return failed;
}
export function assertProductionReleaseConfig(config:Config){
 const blockers=productionConfigBlockers(config);
 if(blockers.length)throw new ReleaseConfigError(blockers);
}
