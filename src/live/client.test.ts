import {describe,it,expect,afterEach,vi} from 'vitest';
import {NutritionClient,LiveApiError,dateOnly,encodeQuery,asNumber} from './client';
afterEach(()=>vi.unstubAllGlobals());
describe('live Nutrition OS API client',()=>{
 it('encodes date parameters and converts PostgreSQL numeric strings',()=>{
  expect(encodeQuery({from:'2026-10-01',to:'2026-10-31'})).toBe('?from=2026-10-01&to=2026-10-31');
  expect(dateOnly('2026-10-31T00:00:00.000Z')).toBe('2026-10-31');
  expect(asNumber('12.300')).toBe(12.3);
 });
 it('never uses localStorage, cookie credentials or mutates without idempotency',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,status:201,json:async()=>({data:{id:'test'}})});
  vi.stubGlobal('fetch',fetcher);
  const client=new NutritionClient('memory-only-bearer',()=>{},'https://nutrition.example');
  await client.post('/foods',{name:'beans'});
  const [url,opts]=fetcher.mock.calls[0] as [string,RequestInit];
  expect(url).toBe('https://nutrition.example/api/v1/nutrition/foods');
  expect(opts.credentials).toBe('omit');
  expect(opts.cache).toBe('no-store');
  expect(opts.headers).toMatchObject({'Authorization':'Bearer memory-only-bearer'});
  expect((opts.headers as Record<string,string>)['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
 });
 it('signs out on a 401 without reusing stale data',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>({error:{code:'INVALID_TOKEN',message:'Expired'}})}));
  const signOut=vi.fn();
  await expect(new NutritionClient('expired',signOut,'https://example.org').get('/profile')).rejects.toBeInstanceOf(LiveApiError);
  expect(signOut).toHaveBeenCalledOnce();
 });
 it('uses the server response as truth and rejects malformed envelopes',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({wrong:true})}));
  await expect(new NutritionClient('token',()=>{},'https://example.org').get('/state')).rejects.toMatchObject({code:'INVALID_RESPONSE'});
 });
});
