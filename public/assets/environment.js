/* Regional model approximation. Currents are vectors towards the stated bearing. */
(() => {
  'use strict';
  const rad=Math.PI/180;
  const SOURCE='Open-Meteo Marine / Copernicus';
  const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
  const monthNow=()=>Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',month:'numeric'}).format(new Date()));
  function seasonal(month=monthNow()){return {version:1,kind:'seasonal',month};}
  function valid(s){
    if(!s||s.version!==1)return false;
    if(s.kind==='seasonal')return Number.isInteger(s.month)&&finite(s.month,1,12);
    return s.kind==='live'&&Number.isFinite(Date.parse(s.fetchedAt))&&Array.isArray(s.samples)&&s.samples.length===16&&s.samples.every(p=>p&&finite(p.lon,94,148)&&finite(p.lat,-3,46)&&finite(p.speed,0,11)&&finite(p.direction,0,360)&&finite(p.wave,0,25)&&Number.isFinite(Date.parse(p.time)));
  }
  function clean(s){
    if(!valid(s))throw Error('环境快照无效');
    if(s.kind==='seasonal')return seasonal(s.month);
    return {version:1,kind:'live',source:SOURCE,fetchedAt:new Date(s.fetchedAt).toISOString(),samples:s.samples.map(p=>({lon:p.lon,lat:p.lat,speed:p.speed,direction:p.direction,wave:p.wave,time:new Date(p.time).toISOString()}))};
  }
  function fresh(s){return valid(s)&&s.kind==='live'&&s.samples.every(p=>{const age=Date.now()-Date.parse(p.time);return age>=-3600000&&age<=21600000;});}
  function vector(speed,direction,wave,label){return {east:speed*Math.sin(direction*rad),north:speed*Math.cos(direction*rad),wave,label};}
  function seasonalAt(lon,lat,month){
    const summer=month>=5&&month<=9;
    // Coarse geographical bands: Kuroshio, Tsushima branch and monsoon reversal.
    if(lon>=121.5&&lon<=130&&lat>=22&&lat<=30)return vector(1.2,35,summer?1.4:2.0,'黑潮东北向');
    if(lon>=130&&lat>=29&&lat<=35)return vector(1.0,70,summer?1.4:2.0,'黑潮东向');
    if(lon>=125&&lat>=31)return vector(.45,40,summer?1.0:1.7,'对马暖流');
    if(lon>=118&&lon<122&&lat>=22&&lat<=27)return vector(summer?.55:.4,summer?35:215,summer?1.1:1.9,'台湾海峡季风流');
    if(lat>=5&&lat<22&&lon<=121)return vector(.35,summer?45:225,summer?1.2:1.8,'南海季风流');
    return vector(.15,summer?60:220,1.0,'区域弱流');
  }
  function at(s,lon,lat){
    if(s.kind==='seasonal')return seasonalAt(lon,lat,s.month);
    // Blend the three nearest regional samples. This is not a fine coastal field.
    const near=s.samples.map(p=>({p,d:Math.hypot((p.lon-lon)*Math.cos(lat*rad),p.lat-lat)})).sort((a,b)=>a.d-b.d).slice(0,3);
    let east=0,north=0,wave=0,total=0;
    for(const {p,d} of near){const w=1/Math.max(.05,d)**2,v=vector(p.speed,p.direction,p.wave);east+=v.east*w;north+=v.north*w;wave+=v.wave*w;total+=w;}
    return {east:east/total,north:north/total,wave:wave/total,label:'公开海洋模型'};
  }
  function along(path,s,distance){
    let total=0,flow=0,wave=0;
    for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],lat=(a[1]+b[1])/2,v=at(s,(a[0]+b[0])/2,lat),east=(b[0]-a[0])*Math.cos(lat*rad),north=b[1]-a[1],norm=Math.hypot(east,north),d=distance(a,b);if(norm===0)continue;total+=d;flow+=d*(v.east*east+v.north*north)/norm;wave+=d*v.wave;}
    return {currentAlong:total?flow/total:0,waveHeight:total?wave/total:0};
  }
  function describe(s){return s.kind==='live'?SOURCE+' · 数据有效 '+new Date(s.samples[0].time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' CST':s.month+' 月季节估算 · 黑潮、对马暖流与季风流示意（非实测）';}
  window.MarineEnvironment={seasonal,valid,clean,fresh,at,along,describe,monthNow};
})();
