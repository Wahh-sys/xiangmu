(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form=$('login-form'), error=$('login-error'), submit=form.querySelector('button[type=submit]');
  try { $('username').value=localStorage.getItem('eco-remembered-account') || ''; } catch {}
  function clearError(){error.hidden=true;error.textContent='';}
  $('username').addEventListener('input',clearError);$('password').addEventListener('input',clearError);
  $('toggle-password').onclick=()=>{const visible=$('password').type==='password';$('password').type=visible?'text':'password';$('toggle-password').setAttribute('aria-pressed',String(visible));$('toggle-password').setAttribute('aria-label',visible?'隐藏密码':'显示密码');};
  $('fill-demo').onclick=()=>{$('username').value='admin';$('password').value='123456';clearError();submit.focus();};
  $('login-help').onclick=()=>{const show=$('login-explanation').hidden;$('login-explanation').hidden=!show;$('login-help').setAttribute('aria-expanded',String(show));};
  form.onsubmit=async event=>{
    event.preventDefault();clearError();submit.disabled=true;submit.querySelector('span').textContent='正在登录…';
    const username=$('username').value.trim();
    try {
      await window.DemoAuth.login(username,$('password').value);
      try { if($('remember-account').checked)localStorage.setItem('eco-remembered-account',username);else localStorage.removeItem('eco-remembered-account'); } catch {}
      location.replace(window.DemoAuth.fileMode?'index.html':'/');
    } catch(err) {error.textContent=err.message;error.hidden=false;submit.disabled=false;submit.querySelector('span').textContent='登录指挥中心';}
  };
  const ns='http://www.w3.org/2000/svg';
  function el(name,attrs){const e=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;}
  function project([lon,lat]){const merc=a=>Math.log(Math.tan(Math.PI/4+a*Math.PI/360));return [(lon-96)/43*680,(merc(40)-merc(lat))/(merc(40)-merc(-2))*510];}
  const path=points=>points.map((p,i)=>(i?'L':'M')+project(p).map(n=>n.toFixed(2)).join(',')).join(' ');
  for(const feature of window.WORLD_GEO?.features||[]){const g=feature.geometry;const polys=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];$('login-land').append(el('path',{d:polys.map(poly=>poly.map(ring=>path(ring)+'Z').join(' ')).join(' '),class:'login-land','fill-rule':'evenodd'}));}
  const route=[[122.15,30.6],[122.6,29.6],[122.2,28],[121.5,26.7],[120.5,25.2],[119.6,23.6],[118.3,22],[115.5,18.2],[111.5,12.5],[107.3,6.7],[105,3.3],[104.5,1.5],[104.2,1.16],[103.82,1.18]];
  if(window.Marine.validate(route).ok){const layer=$('login-route');layer.append(el('path',{d:path(route),fill:'none',stroke:'#67e9b8','stroke-width':10,opacity:.22,filter:'url(#route-glow)'}));layer.append(el('path',{d:path(route),class:'hero-route'}));
    const trail=el('path',{d:path(route),fill:'none',stroke:'#d5ffee','stroke-width':3,'stroke-dasharray':'3 65'});if(!matchMedia('(prefers-reduced-motion: reduce)').matches)trail.append(el('animate',{attributeName:'stroke-dashoffset',from:68,to:0,dur:'5s',repeatCount:'indefinite'}));layer.append(trail);
    [[route[0],'上海 / SHANGHAI'],[route.at(-1),'新加坡 / SINGAPORE']].forEach(([p,name])=>{const [x,y]=project(p);layer.append(el('circle',{cx:x,cy:y,r:13,fill:'#70e7bf10',stroke:'#70e7bf55','stroke-width':1}));layer.append(el('circle',{cx:x,cy:y,r:4,fill:'#8becce'}));const label=el('text',{x:x+17,y:y+4,class:'hero-map-label'});label.textContent=name;layer.append(label);});
  }
})();
