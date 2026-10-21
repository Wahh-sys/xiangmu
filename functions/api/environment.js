import {authenticated,json} from '../_lib/session.js';
export const POINTS=[[122.5,30],[124,26],[120,24],[118,21],[115,18],[112,13],[108,7],[104.5,2],[127,30],[131,30],[135,33],[139,34],[125,32],[128,33],[129,34.5],[120,18]];
const number=(v,low,high)=>typeof v==='number'&&Number.isFinite(v)&&v>=low&&v<=high;
export function normalize(data,now=Date.now()) {
  if(!Array.isArray(data)||data.length!==POINTS.length)throw Error('Incomplete samples');
  const samples=data.map((row,i)=>{
    const [lon,lat]=POINTS[i],c=row?.current,u=row?.current_units;
    if(u?.ocean_current_velocity!=='km/h'||u?.wave_height!=='m'||!c)throw Error('Invalid units');
    const time=Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(c.time)?c.time:c.time+'Z');
    if(!Number.isFinite(time)||now-time < -3600000||now-time > 21600000)throw Error('Stale data');
    if(!number(c.ocean_current_velocity,0,20)||!number(c.ocean_current_direction,0,360)||!number(c.wave_height,0,25)
      ||!number(row.longitude,lon-1,lon+1)||!number(row.latitude,lat-1,lat+1))throw Error('Invalid sample');
    return {lon:row.longitude,lat:row.latitude,speed:c.ocean_current_velocity/1.852,direction:c.ocean_current_direction,wave:c.wave_height,time:new Date(time).toISOString()};
  });
  return {version:1,kind:'live',source:'Open-Meteo Marine / Copernicus',fetchedAt:new Date(now).toISOString(),samples};
}
async function boundedJson(response) {
  const reader=response.body.getReader(),chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>262144){await reader.cancel();throw Error('Response too large');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function onRequestGet({request,env,waitUntil}) {
  if(!await authenticated(request,env))return json({error:'请先使用演示账号登录。'},401);
  const cache=globalThis.caches?.default;
  const cacheKey=new Request(new URL('/_marine-cache-v1',request.url));
  try {
    const hit=await cache?.match(cacheKey);
    if(hit){const status=hit.headers.get('X-Marine-Status')==='503'?503:200;const response=new Response(hit.body,{status,headers:hit.headers});response.headers.delete('X-Marine-Status');response.headers.set('Cache-Control','no-store');return response;}
  } catch { /* Cache availability does not determine API availability. */ }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let result;
  try {
    const url=new URL('https://marine-api.open-meteo.com/v1/marine');
    url.search=new URLSearchParams({latitude:POINTS.map(p=>p[1]).join(','),longitude:POINTS.map(p=>p[0]).join(','),current:'wave_height,ocean_current_velocity,ocean_current_direction',cell_selection:'sea',timezone:'GMT'});
    const upstream=await fetch(url,{signal:controller.signal});if(!upstream.ok)throw Error('Provider unavailable');
    result=json(normalize(await boundedJson(upstream)));
  } catch { result=json({error:'公开海况暂不可用，请使用季节估算。'},503); }
  finally {clearTimeout(timer);}
  // Store failures as a cacheable 200 entry; restore the API status on reads.
  if(cache){const entry=new Response(result.clone().body,{status:200,headers:result.headers});entry.headers.set('X-Marine-Status',String(result.status));entry.headers.set('Cache-Control',`public, max-age=${result.ok?1800:60}`);waitUntil(cache.put(cacheKey,entry).catch(()=>{}));}
  return result;
}
