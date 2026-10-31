/** Dedicated machine-to-machine assertion validation, NOT user JWT authentication.
 * Separate issuer and audience prevent bearer tokens for ordinary nutrition users
 * from modifying lifecycle, consent, or cross-engine context.
 */
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {z} from 'zod';
import type {FastifyRequest} from 'fastify';
import type {Config} from '../config.js';
import {ApiError} from '../auth.js';

const uuid=z.string().uuid();
export type BridgeActor={userId:string;tenantId:string;scopes:ReadonlySet<string>};
const serviceClaims=z.object({
 sub:uuid,tenant_id:uuid,client_id:z.literal('humankernelos-bridge'),
 scope:z.string().max(500),
 jti:uuid,iat:z.number().int(),exp:z.number().int(),
});
const cache=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
function jwksFor(raw:string){
 let jwks=cache.get(raw);
 if(!jwks){jwks=createRemoteJWKSet(new URL(raw),{timeoutDuration:4000,cooldownDuration:1000});cache.set(raw,jwks);}
 return jwks;
}
export function bridgeConfigured(config:Config):boolean{
 return Boolean(config.kernelBridgeJWKSUrl&&config.kernelBridgeIssuer&&config.kernelBridgeAudience);
}
export async function verifyKernelBridge(request:FastifyRequest,config:Config,needed:'nutrition:kernel:govern'|'nutrition:kernel:event'):Promise<BridgeActor>{
 if(!bridgeConfigured(config))throw new ApiError(503,'KERNEL_BRIDGE_UNCONFIGURED','Kernel-to-Nutrition service trust is not configured.');
 const auth=request.headers.authorization;
 if(!auth?.startsWith('Bearer '))throw new ApiError(401,'KERNEL_SERVICE_TOKEN_REQUIRED','Kernel-signed service token required.');
 try {
  const {payload}=await jwtVerify(auth.slice(7).trim(),jwksFor(config.kernelBridgeJWKSUrl!),{
   issuer:config.kernelBridgeIssuer!,audience:config.kernelBridgeAudience!,
   algorithms:['RS256','ES256'],clockTolerance:10,maxTokenAge:'5m'
  });
  const parsed=serviceClaims.parse(payload);
  const now=Math.floor(Date.now()/1000);
  if(parsed.exp-parsed.iat>300||parsed.iat>now+10||parsed.exp<=now)throw Error('Invalid service-token lifetime.');
  const scopes=new Set(parsed.scope.split(/\s+/).filter(Boolean));
  if(!scopes.has(needed))throw new ApiError(403,'KERNEL_SERVICE_SCOPE_DENIED','Kernel service lacks the required operation.');
  return {userId:parsed.sub,tenantId:parsed.tenant_id,scopes};
 } catch(e){
  if(e instanceof ApiError)throw e;
  throw new ApiError(401,'INVALID_KERNEL_SERVICE_TOKEN','Kernel service assertion failed signature, audience, issuer or lifetime verification.');
 }
}
