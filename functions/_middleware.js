import {authenticated} from './_lib/session.js';
export async function onRequest(context) {
  const path=new URL(context.request.url).pathname;
  if (['/','/index','/index.html'].includes(path) && !await authenticated(context.request,context.env)) {
    return new Response(null,{status:302,headers:{Location:'/login','Cache-Control':'no-store'}});
  }
  const original=await context.next();
  const response=new Response(original.body,original);
  response.headers.set('Cache-Control','no-store');
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','DENY');
  response.headers.set('Referrer-Policy','same-origin');
  return response;
}
