import {json,sameOrigin,sessionCookie} from '../_lib/session.js';
export function onRequestPost({request}) {
  if(!sameOrigin(request))return json({error:'请求来源不匹配，请从本站页面重试。'},403);
  const response=json({ok:true});response.headers.set('Set-Cookie',sessionCookie(request));return response;
}
