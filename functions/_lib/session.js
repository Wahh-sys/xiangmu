const encoder = new TextEncoder();
const COOKIE = 'eco_pages_session';
const TTL = 8 * 3600;
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin'
  }});
}
function configured(env) { return typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.length >= 32; }
export function requireConfig(env) {
  if (!configured(env)) throw new Error('请在 Cloudflare 设置至少 32 字符的 SESSION_SECRET 后重新部署。');
}
async function key(env) {
  requireConfig(env);
  return crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
function encode(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function decode(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw Error('Invalid token');
  return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
}
export async function issue(env) {
  const payload = encode(encoder.encode(JSON.stringify({sub:'admin',exp:Math.floor(Date.now()/1000)+TTL,nonce:crypto.randomUUID()})));
  const signature = await crypto.subtle.sign('HMAC', await key(env), encoder.encode(payload));
  return payload+'.'+encode(new Uint8Array(signature));
}
export async function authenticated(request, env) {
  if (!configured(env)) return false;
  try {
    const token = (request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if (!token || token.length>1024) return false;
    const parts = token.split('.');
    if (parts.length!==2) return false;
    if (!await crypto.subtle.verify('HMAC', await key(env), decode(parts[1]), encoder.encode(parts[0]))) return false;
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[0]))), now = Math.floor(Date.now()/1000);
    return payload.sub==='admin' && Number.isInteger(payload.exp) && payload.exp>now && payload.exp<=now+TTL && typeof payload.nonce==='string';
  } catch { return false; }
}
export function sessionCookie(request, token='') {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?TTL:0}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
export function sameOrigin(request) { return request.headers.get('Origin')===new URL(request.url).origin; }
