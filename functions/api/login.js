import {json,issue,requireConfig,sameOrigin,sessionCookie} from '../_lib/session.js';
export async function onRequestPost({request,env}) {
  if (!sameOrigin(request)) return json({error:'请求来源不匹配，请从本站页面重试。'},403);
  try { requireConfig(env); } catch(e) { return json({error:e.message},503); }
  try {
    // Read at most 4 KiB, even if Content-Length is missing or untrusted.
    const reader=request.body?.getReader();if(!reader)return json({error:'请输入账号和密码。'},400);
    const chunks=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>4096){await reader.cancel();return json({error:'请求内容过大。'},413);}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body.username!=='string' || typeof body.password!=='string')return json({error:'请输入有效的账号和密码。'},400);
    if(body.username.trim()!=='admin'||body.password!=='123456')return json({error:'账号或密码不正确，请使用下方演示账号。'},401);
  } catch { return json({error:'请输入有效的账号和密码。'},400); }
  const response=json({ok:true});response.headers.set('Set-Cookie',sessionCookie(request,await issue(env)));return response;
}
