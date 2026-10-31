import {createRemoteJWKSet,jwtVerify,SignJWT} from 'jose';
import {z} from 'zod';
import type {FastifyRequest} from 'fastify';
import type {Config} from './config.js';
export type Actor={userId:string;tenantId:string;scopes:ReadonlySet<string>};
const identity=z.object({sub:z.string().uuid(),tenant_id:z.string().uuid()});
function scopesOf(value:unknown):Set<string>{
  if(typeof value==='string')return new Set(value.split(/\s+/).filter(Boolean));
  if(Array.isArray(value)&&value.every(x=>typeof x==='string'))return new Set(value);
  return new Set();
}
export class ApiError extends Error{
  constructor(public statusCode:number,public code:string,message:string){super(message);}
}
export async function verifyActor(request:FastifyRequest,config:Config):Promise<Actor>{
  const auth=request.headers.authorization;
  if(!auth?.startsWith('Bearer '))throw new ApiError(401,'UNAUTHENTICATED','Bearer token required.');
  const raw=auth.slice(7).trim();
  try{
    let claims;
    if(config.localIdentityEnabled){
      const secret=new TextEncoder().encode(config.localIdentitySecret!);
      const verified=await jwtVerify(raw,secret,{issuer:'nutrition-local-dev',audience:'nutrition-local',algorithms:['HS256']});
      claims=verified.payload;
    }else{
      const jwks=createRemoteJWKSet(new URL(config.kernelJWKSUrl!));
      const verified=await jwtVerify(raw,jwks,{issuer:config.kernelIssuer!,audience:config.kernelAudience!,algorithms:['RS256','ES256']});
      claims=verified.payload;
    }
    const parsed=identity.parse(claims);
    return {userId:parsed.sub,tenantId:parsed.tenant_id,scopes:scopesOf(claims.scope??claims.scopes)};
  }catch{throw new ApiError(401,'INVALID_TOKEN','Token verification or identity claims failed.');}
}
export function requireScope(actor:Actor,scope:string):void {
  if(actor.scopes.has('nutrition:admin')||actor.scopes.has(scope))return;
  if(scope.endsWith(':write')&&actor.scopes.has('nutrition:write'))return;
  if(scope.endsWith(':read')&&actor.scopes.has('nutrition:read'))return;
  throw new ApiError(403,'SCOPE_DENIED','Required permission is missing: '+scope);
}
export async function signLocalToken(config:Config,claims:{userId:string;tenantId:string;scopes:string[]}):Promise<string>{
  if(!config.localIdentityEnabled || config.nodeEnv==='production')throw new Error('Local identity disabled.');
  identity.parse({sub:claims.userId,tenant_id:claims.tenantId});
  return new SignJWT({tenant_id:claims.tenantId,scope:claims.scopes.join(' ')})
    .setProtectedHeader({alg:'HS256'}).setSubject(claims.userId).setIssuedAt().setExpirationTime('1h')
    .setIssuer('nutrition-local-dev').setAudience('nutrition-local')
    .sign(new TextEncoder().encode(config.localIdentitySecret!));
}
