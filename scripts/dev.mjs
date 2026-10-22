import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, relative, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {onRequest as middleware} from '../functions/_middleware.js';
import * as login from '../functions/api/login.js';
import * as session from '../functions/api/session.js';
import * as logout from '../functions/api/logout.js';
import * as environment from '../functions/api/environment.js';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const publicRoot=resolve(root,'public');
const env={SESSION_SECRET:process.env.SESSION_SECRET||randomBytes(32).toString('hex')};
try {
  const vars=await readFile(resolve(root,'.dev.vars'),'utf8');
  const value=vars.match(/^SESSION_SECRET\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
  if(value&&value.length>=32&&!process.env.SESSION_SECRET)env.SESSION_SECRET=value;
} catch(error) {if(error.code!=='ENOENT')throw error;}
const port=Number(process.env.PORT||process.argv.find(a=>a.startsWith('--port='))?.slice(7)||8788);
const api={'/api/login':login,'/api/session':session,'/api/logout':logout,'/api/environment':environment};
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
async function route(request) {
  const url=new URL(request.url),path=decodeURIComponent(url.pathname);
  if(path.startsWith('/api/')) {
    const mod=api[path],method='onRequest'+request.method[0]+request.method.slice(1).toLowerCase();
    return mod?.[method]?mod[method]({request,env,waitUntil:promise=>promise.catch(console.error)}):new Response(JSON.stringify({error:'接口不存在或请求方法不支持。'}),{status:404,headers:{'Content-Type':'application/json; charset=utf-8'}});
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const filename=resolve(publicRoot,'.'+(path==='/'?'/index.html':['/login','/index'].includes(path)?path+'.html':path));
  const rel=relative(publicRoot,filename);
  if(rel.startsWith('..')||rel.includes(':')||['/_headers','/_routes.json'].includes(path))return new Response('Not found',{status:404});
  try {
    const body=await readFile(filename),isHtml=extname(filename)==='.html';
    return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':types[extname(filename)]||'application/octet-stream','Cache-Control':isHtml?'no-store':path.includes('map-data.v1.js')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'}});
  }catch(error){if(['ENOENT','EISDIR','ENOTDIR'].includes(error.code))return new Response('Not found',{status:404});throw error;}
}
const server=http.createServer(async(incoming,outgoing)=>{
  try{
    const url=new URL(incoming.url,`http://127.0.0.1:${port}`);
    const init={method:incoming.method,headers:incoming.headers};
    if(!['GET','HEAD'].includes(incoming.method)){init.body=Readable.toWeb(incoming);init.duplex='half';}
    const request=new Request(url,init);
    const protectedRoute=['/','/index','/index.html'].includes(url.pathname)||url.pathname.startsWith('/api/');
    const response=await(protectedRoute?middleware({request,env,next:()=>route(request)}):route(request));
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body)Readable.fromWeb(response.body).pipe(outgoing);else outgoing.end();
  }catch(error){console.error(error);outgoing.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});outgoing.end('本地服务出错，请查看终端。');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用。请打开 http://127.0.0.1:${port} 或使用 --port=8789。`:error);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`\n智航绿脉 · 本地预览\nhttp://127.0.0.1:${port}\n演示账号：admin / 123456\n按 Ctrl+C 停止服务。\n`));
