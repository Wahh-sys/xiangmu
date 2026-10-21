'use strict';

const $ = id => document.getElementById(id);
const ICONS = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h7"/>',
  leaf:'<path d="M20 3c1 11-4 18-10 18a7 7 0 0 1-7-7C3 7 11 8 20 3Z"/><path d="M4 21 15 10"/>',
  archive:'<rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v14h14V7M9 11h6"/>',
  settings:'<path d="m9 3-1 3-3 1v4l-2 1 2 2v4l3 1 1 2h6l1-2 3-1v-4l2-2-2-1V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  ship:'<path d="m3 13 9-4 9 4-3 6H6Zm4-2V5h10v6M12 5V2M2 21q3-2 5 0t5 0 5 0 5 0"/>',
  drop:'<path d="M12 2C9 7 5 10 5 15a7 7 0 0 0 14 0c0-5-4-8-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 7V4l14-2v3M21 11h-6v5h6M17 13.5h.1"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  cloud:'<path d="M6 17a5 5 0 0 1 0-10 6 6 0 0 1 11-1 5 5 0 0 1 1 11M7 20l1-2m5 2 1-2m5 2 1-2"/>',
  crosshair:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7"/><circle cx="8" cy="15" r="1"/>',
  waves:'<path d="M2 6q3-4 5 0t5 0 5 0 5 0M2 12q3-4 5 0t5 0 5 0 5 0M2 18q3-4 5 0t5 0 5 0 5 0"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6"/>'
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`; }
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon); }); }
const fmt = (n, digits=0) => Number(n).toLocaleString('en-US', {minimumFractionDigits:digits,maximumFractionDigits:digits});
function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveLocal(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { toast('浏览器未允许本地保存，当前会话仍可使用与导出。'); return false; } }
const PORTS = {
  Shanghai:{name:'上海',full:'上海港',code:'CNSHA',coords:[122.15,30.6]},
  Ningbo:{name:'宁波舟山',full:'宁波舟山港',code:'CNNGB',coords:[122.25,29.8]},
  Singapore:{name:'新加坡',full:'新加坡港',code:'SGSIN',coords:[103.82,1.18]},
  Tokyo:{name:'东京',full:'东京港（外海进港点）',code:'JPTYO',coords:[139.75,34.85]},
  Busan:{name:'釜山',full:'釜山港',code:'KRPUS',coords:[129.15,35.05]}
};
// Curated offshore corridors for a visual prototype. These are not navigational charts.
const CORRIDORS = {
  Singapore:{
    safety:[[123.4,29.4],[124.1,27.1],[124,24.6],[123.1,22.2],[121.3,20.1],[119.2,18.2],[116.2,14.3],[112.5,9.5],[108.5,5.5],[105.6,2.7],[104.65,1.4],[104.2,1.08]],
    optimized:[[122.6,29.6],[122.2,28],[121.5,26.7],[120.5,25.2],[119.6,23.6],[118.3,22],[115.5,18.2],[111.5,12.5],[107.3,6.7],[105,3.3],[104.5,1.5],[104.2,1.16]],
    bypass:[[122.6,29.6],[122.2,28],[121.5,26.7],[120.5,25.2],[119.6,23.6],[119.8,22.4],[119,21],[115.5,18.2],[111.5,12.5],[107.3,6.7],[105,3.3],[104.5,1.5],[104.2,1.16]],
    baseline:[[123.2,29.2],[123.7,26.8],[123.5,24.3],[122.4,21.8],[120.3,20.3],[118.7,18.3],[115.8,14.2],[111.8,9.4],[108.3,5.3],[105.5,2.6],[104.6,1.4],[104.2,1.08]],
    storm:[[118.3,21.8],.65]
  },
  Tokyo:{
    safety:[[123.5,29.5],[126.8,28.8],[130.8,28.8],[133,30.5],[135.9,32.3],[138.6,33.3],[139.6,34.2]],
    optimized:[[123.2,30.2],[126.8,30.3],[130.8,30.1],[132.4,32],[135.8,33.2],[138,34],[139.2,34.4],[139.7,34.65]],
    bypass:[[123.2,30.2],[126.7,29.5],[130.8,29.5],[132.4,32],[135.8,33.2],[138,34],[139.2,34.4],[139.7,34.65]],
    baseline:[[124,29.6],[128,29],[131,29.2],[134,30.8],[137.3,32.5],[139.3,33.9],[139.8,34.4]],
    storm:[[128,30.6],.8]
  },
  Busan:{
    safety:[[123.9,30.2],[126.1,30.5],[128.3,32.1],[129,33.4],[129.6,34.4]],
    optimized:[[123.7,30.8],[125.5,31.9],[127.2,33.3],[128.8,34.2]],
    bypass:[[123.7,30.8],[125.7,31.1],[127.6,32.7],[128.8,34.2]],
    baseline:[[124.3,29.8],[126.5,30.7],[128,32],[129.3,33.5],[129.8,34.3]],
    storm:[[126.1,32.3],.65]
  }
};
const routeCache = new Map();
function routeFor(start, end, variant) {
  const key = [start,end,variant].join(':');
  if (!routeCache.has(key)) {
    const points = [PORTS[start].coords,...CORRIDORS[end][variant],PORTS[end].coords];
    const check = window.Marine.validate(points);
    if (!check.ok) throw new Error('航线未通过岸线检查，请调整海上航点。');
    routeCache.set(key,window.Marine.densify(points));
  }
  return routeCache.get(key);
}
const STRATEGIES = {
  eco:{id:'eco',name:'经济优先',icon:'leaf',color:'#52dfb6',factor:.85,tag:'降低燃油支出',description:'参考航速降低 15%，以更长航时换取更低油耗。'},
  fast:{id:'fast',name:'时效优先',icon:'radar',color:'#78b9ff',factor:1.15,tag:'缩短在途时间',description:'参考航速提高 15%，缩短航时，同时承担更高能耗。'},
  safe:{id:'safe',name:'稳妥绕行',icon:'shield',color:'#b8a1ed',factor:.92,tag:'扩大风浪间距',description:'参考航速降低 8%，采用更远离演示风浪区的预设航路。'}
};
const EVENTS = {
  none:{id:'none',name:'常态航行',icon:'compass',description:'按当前港口、航速、吨位与演示风浪区计算。'},
  typhoon:{id:'typhoon',name:'台风逼近',icon:'cloud',description:'模拟风浪区扩大并提高未绕行航路的环境系数，系统优先评估稳妥绕行。',recommend:'safe'},
  congestion:{id:'congestion',name:'目的港拥堵',icon:'waves',description:'模拟目的港排队等待，比较减速、提速与绕行策略的等待成本。',recommend:'eco'}
};
const defaultConfig = {fuel:650,carbon:85};
const storedConfig = readLocal('eco-config-v1',defaultConfig);
let config = Number.isFinite(storedConfig?.fuel) && storedConfig.fuel>=1 && storedConfig.fuel<=5000 && Number.isFinite(storedConfig?.carbon) && storedConfig.carbon>=0 && storedConfig.carbon<=2000 ? storedConfig : {...defaultConfig};
const loadedHistory=readLocal('eco-history-v1',[]);
let rejectedHistory=0;
let history=[];
if(Array.isArray(loadedHistory))for(const item of loadedHistory.slice(0,200)){
  try{
    if(!validResult(item))throw Error('Invalid history');
    const snapshot=item.environment||MarineEnvironment.seasonal(Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',month:'numeric'}).format(new Date(item.time))));
    history.push({...calculate(item.params,item.config,item.planId,item.event,item.sourcePlanId,snapshot),id:item.id,time:item.time,comparison:validWorkflowComparison(item.comparison)?item.comparison:undefined});
    if(history.length>=50)break;
  }catch{rejectedHistory++;}
}
let selectedEnvironment=MarineEnvironment.seasonal(),environmentMode='seasonal',environmentLoading=false;
let environmentMessage='默认使用当月季节估算；可获取公开洋流和浪高。';
let currentResult = null, currentPage='overview', weatherVisible=true, activeShip=null, fleetMode=false, busy=false, toastTimer, tourTimers=[], tourRunning=false;
let eventDraft=null;
let mapController=null, voyageReplay=null, selectedWaypoint=null;
const projection = ([lon,lat]) => { const merc = a=>Math.log(Math.tan(Math.PI/4+a*Math.PI/360)); return [(lon-94)/54*900,(merc(44)-merc(lat))/(merc(44)-merc(-3))*590]; };
const pathString = points => points.map((p,i)=>`${i?'L':'M'}${projection(p).map(n=>n.toFixed(2)).join(',')}`).join(' ');
const svgEl = (name, attrs={}) => { const el=document.createElementNS('http://www.w3.org/2000/svg',name); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); return el; };

function validParams(p){return p&&['Shanghai','Ningbo'].includes(p.start)&&['Singapore','Tokyo','Busan'].includes(p.end)&&Number.isFinite(p.speed)&&p.speed>=12&&p.speed<=24&&Number.isFinite(p.dwt)&&p.dwt>=10000&&p.dwt<=150000&&typeof p.storm==='boolean'&&typeof p.current==='boolean'&&VoyageWorkflow.valid(p);}
function validPrices(p){return p&&Number.isFinite(p.fuel)&&p.fuel>=1&&p.fuel<=5000&&Number.isFinite(p.carbon)&&p.carbon>=0&&p.carbon<=2000;}
function validResult(r){return r&&/^EV-[A-Z0-9-]{1,80}$/.test(r.id)&&typeof r.time==='string'&&Number.isFinite(Date.parse(r.time))&&validParams(r.params)&&validPrices(r.config)&&(r.planId===undefined||Object.hasOwn(STRATEGIES,r.planId))&&(r.event===undefined||Object.hasOwn(EVENTS,r.event))&&(r.sourcePlanId===undefined||Object.hasOwn(STRATEGIES,r.sourcePlanId))&&(r.environment===undefined||MarineEnvironment.valid(r.environment));}
function greatCircleNm(a,b) {
  const rad=v=>v*Math.PI/180, p1=rad(a[1]),p2=rad(b[1]);
  const h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(rad(b[0]-a[0])/2)**2;
  return 3440.065*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function distanceNm(points) { return points.slice(1).reduce((sum,p,i)=>sum+greatCircleNm(points[i],p),0); }
function calculate(params, prices=config, planId='eco', event='none', sourcePlanId=planId, environment=MarineEnvironment.seasonal()) {
  params=VoyageWorkflow.normalize(params);
  if(!validParams(params)||!validPrices(prices))throw Error('港口、航速、吨位或价格超出范围');
  environment=MarineEnvironment.clean(environment);
  if(!Object.hasOwn(EVENTS,event))event='none';
  if(!Object.hasOwn(STRATEGIES,planId))planId='eco';
  if(!Object.hasOwn(STRATEGIES,sourcePlanId))sourcePlanId=planId;
  const normal=event==='none'?null:calculate(params,prices,sourcePlanId,'none',sourcePlanId,environment);
  const berthOpening=event==='congestion'?normal.alternatives.eco.hours+12:0;
  const [center,baseRadius]=CORRIDORS[params.end].storm;
  const radiusNm=baseRadius*60+(event==='typhoon'?30:0);
  const clearanceFor=path=>Math.min(...path.map(p=>greatCircleNm(p,center)))-radiusNm;
  const baselinePath=routeFor(params.start,params.end,'baseline');
  const envCache=new Map();
  function metrics(path,speed) {
    if(!envCache.has(path))envCache.set(path,MarineEnvironment.along(path,environment,greatCircleNm));
    const field=envCache.get(path),currentAlong=params.current?field.currentAlong:0;
    const waveHeight=field.waveHeight,excess=Math.max(0,waveHeight-1);
    const waveSpeedFactor=Math.max(.65,1-.035*excess);
    const dailyBurn=32*Math.pow(params.dwt/50000,2/3)*Math.pow(speed/18,3)*VoyageWorkflow.burnFactor(params);
    const clearance=clearanceFor(path),stormExposed=event==='typhoon'&&clearance<=0;
    const weatherFactor=(1+.04*excess)*(stormExposed?1.28:1);
    const groundSpeed=Math.max(1,(speed+currentAlong)*waveSpeedFactor*(stormExposed?.85:1));
    const distance=distanceNm(path),sailingHours=distance/groundSpeed;
    const waitingHours=Math.max(0,berthOpening-sailingHours),hours=sailingHours+waitingHours;
    const idleBurn=.12*Math.pow(params.dwt/50000,2/3);
    const sailingFuel=dailyBurn*(sailingHours/24)*weatherFactor,waitingFuel=waitingHours*idleBurn;
    const fuel=sailingFuel+waitingFuel,co2=fuel*3.114,fuelCost=fuel*prices.fuel,carbonCost=co2*prices.carbon;
    return {path,distance,hours,sailingHours,waitingHours,dailyBurn,idleBurn,sailingFuel,waitingFuel,fuel,co2,fuelCost,carbonCost,cost:fuelCost+carbonCost,weatherFactor,groundSpeed,speed,clearance,stormExposed,currentAlong,waveHeight,waveSpeedFactor};
  }
  const baseline=metrics(baselinePath,params.speed);
  const alternatives={};
  for(const [key,strategy] of Object.entries(STRATEGIES)){
    const variant=key==='safe'?'safety':params.storm?'bypass':'optimized';
    const path=routeFor(params.start,params.end,variant);
    let speed=Math.round(params.speed*strategy.factor*10)/10;
    if(event==='congestion'&&key==='eco'){
      const probe=metrics(path,speed);
      speed=Math.max(8,Math.min(speed,probe.distance/berthOpening/probe.waveSpeedFactor-probe.currentAlong));
    }
    alternatives[key]={...metrics(path,speed),id:key,name:strategy.name,color:strategy.color,variant};
  }
  const recommended=VoyageWorkflow.choose(alternatives,params,event);
  const context=normal?{before:normal.optimized,untreated:{...normal.optimized,...metrics(normal.optimized.path,normal.optimized.speed)},berthOpening,radiusNm,center,recommended}:null;
  const optimized=alternatives[planId];
  const saved={}; ['fuel','co2','cost','hours','distance'].forEach(k=>saved[k]=baseline[k]-optimized[k]);
  return {routeVersion:6,environment,event,sourcePlanId,context,recommended,planId,alternatives,id:'EV-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),time:new Date().toISOString(),params:{...params},config:{...prices},baseline,optimized,saved,reduction:saved.co2/baseline.co2*100};
}
function persistHistory(){saveLocal('eco-history-v1',history.map(r=>({id:r.id,time:r.time,params:r.params,config:r.config,planId:r.planId,event:r.event,sourcePlanId:r.sourcePlanId,environment:r.environment,routeVersion:r.routeVersion,comparison:r.comparison})));}
function selectPlan(id){
  if(busy||!currentResult?.alternatives[id])return;
  const r={...currentResult,planId:id,optimized:currentResult.alternatives[id]};
  r.saved={};['fuel','co2','cost','hours','distance'].forEach(k=>r.saved[k]=r.baseline[k]-r.optimized[k]);r.reduction=r.saved.co2/r.baseline.co2*100;
  renderResult(r);setMapMode(false);
  const index=history.findIndex(item=>item.id===r.id);if(index>=0){history[index]=r;persistHistory();renderHistory();}
}
function paramsFromForm(){return {start:$('start-port').value,end:$('end-port').value,speed:Number($('speed').value),dwt:Number($('dwt').value),storm:$('avoid-storm').checked,current:$('use-current').checked,...workflowParams()};}
function setForm(p){setWorkflowForm(p);$('start-port').value=p.start;$('end-port').value=p.end;$('speed').value=p.speed;$('dwt').value=p.dwt;$('avoid-storm').checked=p.storm;$('use-current').checked=p.current;updateSliders();}
function updateSliders() { $('speed-value').textContent=$('speed').value;$('dwt-value').textContent=fmt($('dwt').value);['speed','dwt'].forEach(id=>{const el=$(id),percent=(el.value-el.min)/(el.max-el.min)*100;el.style.background=`linear-gradient(to right,#52dfb6 ${percent}%,#263f4b ${percent}%)`;}); }

function drawGeography() {
  const group=$('geo-layer');
  if(window.WORLD_GEO?.features) {
    window.WORLD_GEO.features.forEach(f=>{
      const geo=f.geometry;if(!geo)return;
      const polygons=geo.type==='Polygon'?[geo.coordinates]:geo.type==='MultiPolygon'?geo.coordinates:[];
      const d=polygons.map(poly=>poly.map(ring=>pathString(ring)+' Z').join(' ')).join(' ');
      const p=svgEl('path',{d,class:'land','fill-rule':'evenodd'});group.append(p);
    });
  } else {
    // Offline schematic fallback is explicitly labeled if the geography file is absent.
    $('map-status').textContent='示意底图 · 模拟航运态势';
    const shapes=[[[94,44],[130,44],[132,42],[129,39],[126,39],[124,38],[121,40],[120,38],[122,37],[120,35],[121,32],[122,30],[120,27],[117,24],[114,22],[110,21],[108,19],[107,16],[109,13],[108,11],[105,9],[104,11],[101,13],[100,9],[101,6],[103,2],[104,1],[102,2],[99,7],[98,13],[95,17],[94,20]],[[130,34],[131,32],[133,34],[135,35],[137,36],[140,40],[141,41],[141,37],[140,35],[138,34],[135,33],[132,33]],[[121,25.3],[122,25],[121.5,23],[120.7,22],[120,23]],[[119,19],[122,18],[124,14],[126,10],[125,6],[122,7],[120,12]],[[109,7],[117,7],[119,2],[116,-3],[110,-2],[108,2]],[[96,5],[99,3],[103,-1],[105,-4],[101,-3],[98,0]],[[126,39],[129,41],[130,38],[129,35],[127,34],[126,36]]];
    shapes.forEach(p=>group.append(svgEl('path',{d:pathString(p)+' Z',class:'land'})));
    document.querySelector('.map-source').textContent='地理轮廓示意 · 非精确海图 · 仅供演示';
  }
  const labels=[['中国',108,34,'map-country'],['日本',138,38,'map-country'],['韩国',127.6,37.5,'map-country'],['越南',105.8,18,'map-country'],['菲律宾',124,12,'map-country'],['马来西亚',109,4,'map-country'],['东 海',127,27.5,'map-sea'],['南 海',115,16,'map-sea'],['西 太 平 洋',138,21,'map-sea']];
  labels.forEach(([name,lon,lat,cls])=>{const [x,y]=projection([lon,lat]);const t=svgEl('text',{x,y,class:cls,'text-anchor':'middle'});t.textContent=name;$('sea-labels').append(t);});
}
function drawPorts(p) {
  $('port-layer').replaceChildren();
  [p.start,p.end].forEach((key,index)=>{const port=PORTS[key],[x,y]=projection(port.coords),color=index?'#edb078':'#52dfb6';const g=svgEl('g');g.append(svgEl('circle',{cx:x,cy:y,r:11,fill:color+'12',stroke:color+'44','stroke-width':1}));g.append(svgEl('circle',{cx:x,cy:y,r:4,fill:color,stroke:'#0b1a25','stroke-width':2}));const t=svgEl('text',{x:x+15,y:y-3,class:'port-text'});t.textContent=port.name;g.append(t);const code=svgEl('text',{x:x+15,y:y+10,class:'port-code'});code.textContent=port.code;g.append(code);$('port-layer').append(g);});
}
function drawWeather(p,r=eventDraft||currentResult){
  const group=$('weather-layer');group.replaceChildren();group.style.display=weatherVisible?'':'none';$('weather-toggle').classList.toggle('active',weatherVisible);
  const [center,radius]=CORRIDORS[p.end].storm;
  const expanded=r?.event==='typhoon',nm=radius*60+(expanded?30:0),ring=stormRing(center,nm);
  drawEnvironmentArrows(group,r);
  group.append(svgEl('path',{d:pathString(ring)+' Z',class:'weather-zone'+(expanded?' typhoon-zone':'')}));
  const [x,y]=projection(ring[18]);const t=svgEl('text',{x:x+6,y:y-3,class:'weather-label'});t.textContent=expanded?'模拟台风区 · 扩大 30 nm':'演示风浪区';group.append(t);
}
function renderMap(r,preview=false){
  const color=r.optimized.color,g=$('route-layer');g.replaceChildren();
  g.append(svgEl('path',{d:pathString(r.baseline.path),class:'route-baseline'}));
  const glow=svgEl('path',{d:pathString(r.optimized.path),class:'route-glow'});glow.style.stroke=color;g.append(glow);
  const line=svgEl('path',{d:pathString(r.optimized.path),class:'route-main'});line.style.stroke=color;g.append(line);g.style.opacity=fleetMode?'.25':'1';
  drawPorts(r.params);drawWeather(r.params);drawWaypoints(r);
  $('route-label').innerHTML=`<span>${preview?'SCENARIO PREVIEW':'VOYAGE COMPARISON'}</span><strong>${PORTS[r.params.start].name} ${icon('arrow')} ${PORTS[r.params.end].name}</strong><small style="color:${color}">${r.optimized.name} · ${fmt(r.optimized.speed,1)} kn · ${fmt(r.optimized.hours,1)} h</small>`;
  $('plan-legend-name').textContent=r.optimized.name;$('plan-legend-color').style.background=color;
}
function waypointMeaning(p,r){
  if(r.params.end==='Singapore')return p[1]>27?'东海出港航段':p[1]>22?(p[0]>122?'台湾东侧外海航段':'台湾海峡通行航段'):p[1]>3?'南海航段 · 从菲律宾以西通过':'新加坡海峡进港航段';
  if(r.params.end==='Tokyo')return p[0]<131?'东海通行航段':'日本南侧外海进港航段';
  return p[0]<127?'济州岛南侧外海航段':'朝鲜海峡进港航段';
}
function drawWaypoints(r){
  const layer=$('waypoint-layer');layer.replaceChildren();$('waypoint-tooltip').hidden=true;selectedWaypoint=null;
  const points=CORRIDORS[r.params.end][r.optimized.variant];
  points.forEach((p,i)=>{const [x,y]=projection(p);const g=svgEl('g',{class:'waypoint',transform:`translate(${x},${y})`,tabindex:0,role:'button','aria-label':`航点 ${i+1}，${waypointMeaning(p,r)}`});
    g.append(svgEl('circle',{r:12,fill:'transparent',class:'waypoint-hit'}));g.append(svgEl('circle',{r:5,class:'waypoint-dot'}));const t=svgEl('text',{x:0,y:0,class:'waypoint-number'});t.textContent=i+1;g.append(t);
    const show=()=>{selectedWaypoint=i;$('ship-tooltip').hidden=true;activeShip=null;$('waypoint-tooltip').hidden=false;const distance=distanceNm([PORTS[r.params.start].coords,...points.slice(0,i+1)]);$('waypoint-tooltip').innerHTML=`<button aria-label="关闭航点详情">×</button><small>WAYPOINT ${String(i+1).padStart(2,'0')}</small><strong>${waypointMeaning(p,r)}</strong><div class="waypoint-coords">${fmt(p[1],2)}° N / ${fmt(p[0],2)}° E</div><p>距出发点约 ${fmt(distance)} 海里。${planDescription(r)}</p><p>连接的航段已通过当前地图岸线检查。</p>`;$('waypoint-tooltip').querySelector('button').onclick=()=>{$('waypoint-tooltip').hidden=true;selectedWaypoint=null;};};
    g.onclick=show;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};layer.append(g);
  });scaleWaypoints();
}
function scaleWaypoints(){const z=mapController?.scale||1;document.querySelectorAll('.waypoint-hit').forEach(el=>el.setAttribute('r',12/z));document.querySelectorAll('.waypoint-dot').forEach(el=>el.setAttribute('r',5/z));document.querySelectorAll('.waypoint-number').forEach(el=>el.style.fontSize=(7/z)+'px');}
function renderPlayback(state){
  let marker=$('replay-marker');
  if(!marker){$('replay-layer').replaceChildren();$('replay-layer').append(svgEl('path',{id:'replay-trail',class:'replay-trail'}));marker=svgEl('g',{id:'replay-marker'});marker.append(svgEl('circle',{r:13,class:'replay-marker-halo'}));marker.append(svgEl('polygon',{points:'0,-9 5.5,7 0,4 -5.5,7',fill:'#ddfff1',stroke:'#22624d','stroke-width':1.2}));$('replay-layer').append(marker);}
  const [x,y]=projection(state.coords);marker.setAttribute('transform',`translate(${x},${y}) rotate(${state.heading}) scale(${1/(mapController?.scale||1)})`);$('replay-trail').setAttribute('d',pathString(state.path));
  $('replay-progress').value=Math.round(state.progress*1000);$('replay-progress').style.background=`linear-gradient(to right,${currentResult?.optimized.color||'#52dfb6'} ${state.progress*100}%,#263f4b 0)`;$('replay-progress').setAttribute('aria-valuetext',`${fmt(state.progress*100,1)}%，已航行 ${fmt(state.distance)} 海里`);
  $('replay-percent').textContent=fmt(state.progress*100)+'%';$('replay-play').textContent=state.playing?'Ⅱ':'▶';$('replay-play').setAttribute('aria-label',state.playing?'暂停航次回放':'播放航次回放');
  $('replay-status').textContent=`${currentResult?.optimized.name||''} · ${state.progress>=1?(currentResult?.event==='congestion'?'已到靠泊窗口':'已抵达'):state.waiting?(state.playing?'到港候泊中':'候泊 · 已暂停'):state.playing?'回放中':state.progress>0?'已暂停':'待播放'}`;
  $('replay-distance').textContent=fmt(state.distance)+' nm';$('replay-remaining').textContent=fmt(state.remaining,1)+' h';$('replay-fuel').textContent=fmt(state.fuel,1)+' t';$('replay-carbon').textContent=fmt(state.co2,1)+' t';
  $('replay-eta').textContent=new Date(state.eta).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+' CST';
}
function renderStrategies(r){
  $('strategy-reference').textContent=`参考航速 ${fmt(r.params.speed)} kn · ${fmt(r.params.dwt)} DWT`;
  $('strategy-cards').innerHTML=Object.entries(r.alternatives).map(([id,plan])=>{const definition=STRATEGIES[id],saving=(r.baseline.co2-plan.co2)/r.baseline.co2*100;return `<button class="strategy-card" data-plan="${id}" style="--plan-color:${plan.color}" aria-pressed="${r.planId===id}"><div class="strategy-card-top">${icon(definition.icon)}<h3>${plan.name}</h3><span class="strategy-card-tag">${definition.tag}</span></div><div class="strategy-card-summary"><strong>$${fmt(plan.cost)}<small>综合成本</small></strong><span>${fmt(plan.hours,1)} 小时 · ${fmt(plan.speed,1)} kn</span></div><div class="strategy-detail-grid"><span>燃油<b>${fmt(plan.fuel,1)} t</b></span><span>碳排<b>${fmt(plan.co2,1)} t</b></span><span>航程<b>${fmt(plan.distance)} nm</b></span><span>风浪间距<b class="${plan.clearance<0?'adverse':''}">${plan.clearance>0?fmt(plan.clearance)+' nm':'经过演示区'}</b></span></div><p>${planDescription(r,id)}</p><div class="scenario-note">${r.event==='congestion'?`航行 ${fmt(plan.sailingHours,1)} h · 候泊 ${fmt(plan.waitingHours,1)} h`:r.event==='typhoon'?(plan.clearance>=10?'满足演示风区间距阈值':'未满足 10 nm 演示筛选阈值'):'常态情景'}${r.recommended===id?' · 规则推荐':''}</div><div class="strategy-card-bottom"><span class="${saving<0?'adverse':''}">较基准${saving>=0?'减排':'增排'} ${fmt(Math.abs(saving),1)}%</span><span>${r.planId===id?'✓ 当前方案':'选择方案 →'}</span></div></button>`;}).join('');
  document.querySelectorAll('[data-plan]').forEach(button=>button.onclick=()=>{selectPlan(button.dataset.plan);document.querySelector(`[data-plan="${button.dataset.plan}"]`)?.focus({preventScroll:true});});
}

const FLEET=Array.from({length:12},(_,i)=>({id:'413'+String(680100+i*127),name:['远洋先锋','绿脉探索者','海蓝之星','东方远航','海洋晨曦','星海领航','碧海方舟','海风使者','曙光远洋','海洋新程','深蓝远航','远海追光'][i],speed:14+i%7,route:['Singapore','Tokyo','Busan'][i%3],phase:(i*.137)%1}));
const fleetStart=performance.now();
function interpolateRoute(path,phase){const scaled=((phase%1+1)%1)*(path.length-1),i=Math.min(Math.floor(scaled),path.length-2),f=scaled-i,a=path[i],b=path[i+1];return {coords:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],heading:Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI};}
function updateFleet(){
  const elapsed=(performance.now()-fleetStart)/1000;
  FLEET.forEach((ship,i)=>{const path=routeFor('Shanghai',ship.route,'optimized');const position=interpolateRoute(path,(ship.phase+elapsed/900)%1);ship.position=position;let g=$('vessel-'+i);if(!g){g=svgEl('g',{id:'vessel-'+i,class:'vessel',tabindex:0,role:'button','aria-label':ship.name+'，模拟船舶'});g.append(svgEl('circle',{r:12,fill:'transparent'}));g.append(svgEl('polygon',{points:'0,-6 4,5 0,3 -4,5',fill:i%3===0?'#72d7bc':'#709eae',stroke:'#0c2733','stroke-width':.8}));g.addEventListener('click',()=>selectShip(i));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectShip(i);}});$('vessel-layer').append(g);}const [x,y]=projection(position.coords);g.setAttribute('transform',`translate(${x},${y}) rotate(${position.heading})`);g.style.opacity=activeShip===i?'1':fleetMode?'.95':'.65';});
  if(activeShip!==null)updateShipTooltip();
}
function selectShip(i){$('waypoint-tooltip').hidden=true;activeShip=i;$('ship-tooltip').hidden=false;updateShipTooltip();$('map-footer-text').textContent=`已选中 ${FLEET[i].name} · MMSI ${FLEET[i].id} · 模拟船舶`;}
function updateShipTooltip(){const s=FLEET[activeShip];if(!s?.position)return;const [lon,lat]=s.position.coords;$('ship-tooltip').innerHTML=`<button class="close-ship" aria-label="关闭船舶详情">×</button><small>SIMULATED VESSEL</small><strong>${s.name}</strong><small>MMSI ${s.id}</small><div class="ship-stats"><span>航速 <b>${s.speed} kn</b></span><span>航向 <b>${fmt((s.position.heading+360)%360)}°</b></span></div><div class="ship-stats"><span>${fmt(lat,2)}° N</span><span>${fmt(lon,2)}° E</span></div>`;$('ship-tooltip').querySelector('button').onclick=resetMap;}
function resetSelection(){activeShip=null;$('ship-tooltip').hidden=true;$('waypoint-tooltip').hidden=true;}
function resetMap(){mapController?.reset();$('waypoint-tooltip').hidden=true;selectedWaypoint=null;activeShip=null;$('ship-tooltip').hidden=true;$('map-footer-text').textContent='区域船队运行中 · 12 个模拟目标';}
function setMapMode(isFleet){if(isFleet)voyageReplay?.pause();fleetMode=isFleet;$('waypoint-layer').style.display=isFleet?'none':'';$('replay-layer').style.display=isFleet?'none':'';$('map-route').classList.toggle('active',!isFleet);$('map-fleet').classList.toggle('active',isFleet);$('route-layer').style.opacity=isFleet?'.25':'1';$('route-label').style.opacity=isFleet?'.5':'1';updateFleet();}

function renderResult(r,preview=false){
  eventDraft=null;
  $('comparison-plan-name').textContent=r.optimized.name;const changed=currentResult&&(currentResult.params.start!==r.params.start||currentResult.params.end!==r.params.end);currentResult=r;
  const labels={carbon:['本航次预计减排','本航次预计增排','t CO₂',r.saved.co2],fuel:['本航次燃油节省','本航次燃油增加','t',r.saved.fuel],cost:['本航次成本节省','本航次成本增加','USD',r.saved.cost]};
  for(const [key,[good,bad,unit,value]] of Object.entries(labels)){const el=$('kpi-'+key),adverse=value<0;el.innerHTML=`${fmt(Math.abs(value),key==='cost'?0:1)}<span>${unit}</span>`;el.classList.toggle('adverse',adverse);el.closest('.kpi').querySelector('.kpi-label').firstChild.textContent=adverse?bad+' ':good+' ';const change=$('kpi-'+key+'-percent');change.textContent=`${adverse?'↑':'↓'} ${fmt(Math.abs(r.reduction),1)}%`;change.classList.toggle('adverse',adverse);}
  $('ring-value').textContent=(r.reduction<0?'+':'−')+fmt(Math.abs(r.reduction),1)+'%';$('saving-ring').querySelector('small').textContent=r.reduction<0?'预计碳排增幅':'预计碳排降幅';$('ring-value').classList.toggle('adverse',r.reduction<0);$('saving-ring').style.background=`conic-gradient(${r.reduction<0?'#edb078':r.optimized.color} ${Math.min(100,Math.abs(r.reduction))*3.6}deg,#213d49 0deg)`;
  $('travel-time').innerHTML=`${fmt(r.optimized.hours,1)} <small>小时</small>`;$('travel-distance').innerHTML=`${fmt(r.optimized.distance)} <small>海里</small>`;
  $('comparison-bars').innerHTML=[['fuel','燃油消耗','t'],['co2','碳排放','t']].map(([key,label,unit])=>{const max=Math.max(r.baseline[key],r.optimized[key]);return `<div class="bar-row"><div class="bar-label"><span>${label}</span><span>${fmt(r.baseline[key],1)} → <span style="color:${r.optimized.color}">${fmt(r.optimized[key],1)}</span> ${unit}</span></div><div class="bar-track"><div class="bar-fill baseline" style="width:${r.baseline[key]/max*100}%"></div></div><div class="bar-track"><div class="bar-fill optimized" style="background:${r.optimized.color};width:${r.optimized[key]/max*100}%"></div></div></div>`;}).join('');
  $('insight-content').innerHTML=`<div class="insight-row"><span class="insight-icon">${icon(STRATEGIES[r.planId].icon)}</span><div><strong>${r.optimized.name} · ${fmt(r.optimized.speed,1)} kn</strong><p>较基准${r.saved.hours>=0?'节省':'增加'} ${fmt(Math.abs(r.saved.hours),1)} 小时，${r.saved.cost>=0?'节省':'增加'} $${fmt(Math.abs(r.saved.cost))}。${planDescription(r)}</p></div></div><div class="insight-row"><span class="insight-icon blue">${icon('shield')}</span><div><strong>海上路径已检查 · 方案可以解释</strong><p>${r.optimized.clearance>0?'距演示风浪区边界最近约 '+fmt(r.optimized.clearance)+' 海里。':'航路经过演示风浪区；可比较稳妥绕行方案及风区间距。'}点击地图航点查看通行位置与说明。</p></div></div>`;
  renderMap(r,preview);renderCarbon(r);renderStrategies(r);renderDecision(r);renderEnvironment(r);renderWorkflow(r);voyageReplay?.load(r.optimized,r.time);if(changed)mapController?.fit(r.optimized.path.map(projection));
  const stale=JSON.stringify(paramsFromForm())!==JSON.stringify(r.params);$('map-status').classList.toggle('stale-note',stale);$('map-status').textContent=stale?'参数已调整 · 当前显示上次结果':'滚轮缩放 · 拖动地图 · 点击编号航点';
}
function renderCarbon(r){
  const increase=r.saved.co2<0,max=Math.max(r.baseline.co2,r.optimized.co2),change=increase?'增排':'减排';
  $('carbon-content').classList.toggle('carbon-negative',increase);
  $('carbon-content').innerHTML=`<div class="carbon-hero"><div><div class="eyebrow">VOYAGE CARBON COMPARISON</div><div class="carbon-number">${fmt(Math.abs(r.saved.co2),1)} <small>t CO₂</small></div><h3 style="font-weight:400">${r.optimized.name} · 单航次预计${change}</h3><p class="carbon-description">${PORTS[r.params.start].name} → ${PORTS[r.params.end].name}。当前方案航速 ${fmt(r.optimized.speed,1)} kn，基准航速 ${fmt(r.params.speed)} kn；较基准${change} ${fmt(Math.abs(r.reduction),1)}%。${planDescription(r)}</p></div><div class="carbon-comparison"><div class="carbon-column"><strong>${fmt(r.baseline.co2,1)} t</strong><div class="column" style="height:${160*r.baseline.co2/max}px"></div>基准情景</div><div class="carbon-column"><strong>${fmt(r.optimized.co2,1)} t</strong><div class="column" style="height:${160*r.optimized.co2/max}px;background:${r.optimized.color}"></div>${r.optimized.name}</div></div></div><div class="method-grid"><article class="method-card"><span>01 / 航程与时间</span><h3>沿选定海上航路计算</h3><p>航程 ${fmt(r.optimized.distance)} 海里。对地航速 ${fmt(r.optimized.groundSpeed,1)} kn，航行 ${fmt(r.optimized.sailingHours,1)} 小时，候泊 ${fmt(r.optimized.waitingHours,1)} 小时，总耗时 ${fmt(r.optimized.hours,1)} 小时。</p></article><article class="method-card"><span>02 / 能耗</span><h3>各方案使用实际航速计算</h3><p>日油耗 = 32 × (DWT / 50,000)²ᐟ³ × (实际航速 / 18)³ × 船型系数 × (0.55 + 0.45 × 载重率)。乘以航行天数及环境系数，再加候泊燃油，得到总油耗估算。</p></article><article class="method-card"><span>03 / 碳与经济性</span><h3>透明的换算依据</h3><p>CO₂ = 燃油 × 3.114。燃油 $${fmt(r.config.fuel)}/t，碳成本 $${fmt(r.config.carbon)}/t CO₂。当前方案成本 $${fmt(r.optimized.cost)}。</p></article></div><div class="method-note"><strong>本次情景假设与方案取舍 · ${EVENTS[r.event].name}</strong><p>${eventAssumptions(r)}</p><p>参考航速 ${r.params.speed} kn；当前方案 ${fmt(r.optimized.speed,1)} kn；吨位 ${fmt(r.params.dwt)} DWT。洋流影响 ${r.params.current?'开启（按流向投影，可顺流或逆流）':'关闭'}。基准环境系数 ${r.baseline.weatherFactor.toFixed(2)}；当前方案系数 ${r.optimized.weatherFactor.toFixed(2)}。经济与时效方案遵循风浪避让开关；稳妥方案始终采用更远的预设绕行航路。</p><p>三种方案均为明确假设下的演示比较。岸线检查基于当前简化地图，台风风区为模拟；洋流与浪高来自当前环境快照，响应系数为简化假设，不可用于实船导航。</p></div>`;
}

function renderHistory(){
  $('history-count').textContent=history.length;
  if(!history.length){$('history-content').innerHTML=`<div class="history-empty">${icon('archive')}<h3>第一段绿色航程，从这里开始</h3><p>生成方案后，航次及所选策略将保存在当前浏览器。</p><button class="button secondary" id="history-start">创建一个航次 ${icon('arrow')}</button></div>`;$('history-start').onclick=()=>navigate('planning');return;}
  $('history-content').innerHTML=`<div class="history-scroll"><table class="history-table"><thead><tr><th>生成时间</th><th>航线 / 所选方案</th><th>实际航速 / 吨位</th><th>航程</th><th>碳排变化</th><th>成本变化</th><th>操作</th></tr></thead><tbody>${history.map((r,i)=>`<tr><td>${new Date(r.time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td><td>${PORTS[r.params.start].name} → ${PORTS[r.params.end].name}<span class="plan-cell">${r.optimized.name} · ${EVENTS[r.event].name}</span></td><td>${fmt(r.optimized.speed,1)} kn / ${fmt(r.params.dwt)} t</td><td>${fmt(r.optimized.distance)} nm</td><td class="${r.reduction>=0?'positive':'adverse'}">${r.reduction>=0?'−':'+'}${fmt(Math.abs(r.reduction),1)}%</td><td class="${r.saved.cost<0?'adverse':''}">${r.saved.cost>=0?'−':'+'}$${fmt(Math.abs(r.saved.cost))}</td><td><button class="text-button" data-restore="${i}">查看</button><button class="text-button" data-export="${i}">导出</button></td></tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const r=history[Number(b.dataset.restore)];setForm(r.params);restoreEnvironment(r.environment);renderResult(r);navigate('planning');toast('已载入历史方案，保留环境快照、价格与所选策略。');});
  document.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>exportResult(history[Number(b.dataset.export)]));
}

function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
const PAGE_COPY={
  overview:['航运总览','MARITIME INTELLIGENCE / 航运态势','航向更高效的未来','连接航线、能耗与环境，让绿色航运决策清晰可见。'],
  planning:['智能航线规划','VOYAGE OPTIMIZATION / 航线决策','每一海里，都有更优选择','选择港口与船舶参数，比较不同情景下的航行效率。'],
  carbon:['碳排放分析','CARBON INTELLIGENCE / 低碳洞察','让绿色效益，清晰可见','从航程与能耗，到碳排放与经济性，每一步都有依据。'],
  history:['航次档案','VOYAGE ARCHIVE / 航次档案','记录每一次，绿色决策','回看、比较与导出保存在本机浏览器的演示航次。'],
  settings:['演示设置','SCENARIO SETTINGS / 情景设置','为不同情景，设定答案','调整价格假设，探索低碳航运的经济价值。']
};
function navigate(page){if(!PAGE_COPY[page])page='overview';currentPage=page;if(!['overview','planning'].includes(page))voyageReplay?.pause();document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));const [title,eyebrow,headline,subtitle]=PAGE_COPY[page];$('breadcrumb-title').textContent=title;$('page-eyebrow').textContent=eyebrow;$('page-title').innerHTML=headline+'<span class="title-dot">.</span>';$('page-subtitle').textContent=subtitle;$('workspace-view').hidden=!['overview','planning'].includes(page);['carbon','history','settings'].forEach(p=>$(p+'-view').hidden=p!==page);if(page==='history')renderHistory();if(page==='planning')setMapMode(false);if(location.hash!=='#'+page)window.history.replaceState(null,'','#'+page);}
function markStale(){voyageReplay?.pause();eventDraft=null;updateSliders();$('map-status').textContent='参数已调整 · 点击生成更新结果';$('map-status').classList.add('stale-note');if(currentResult)renderDecision(currentResult);renderEnvironment(currentResult);renderWorkflow(currentResult);}
async function generate({silent=false}={}){
  if(busy||environmentLoading||!workflowValid())return;voyageReplay?.pause();busy=true;renderDecision(currentResult);renderEnvironment(currentResult);renderWorkflow(currentResult);const p=paramsFromForm();const controls=[...document.querySelectorAll('.planner-content input,.planner-content select,.planner-content button')];controls.forEach(el=>el.disabled=true);$('generate').classList.add('loading');$('generate').querySelector('span').textContent='正在比较航路与能耗…';$('map-status').textContent='计算演示情景 · 评估航程与能耗';
  try{
    await new Promise(resolve=>setTimeout(resolve,1100));const r=chooseRecommendedResult(calculate(p,config,'eco','none','eco',environmentForGeneration()));if(currentResult&&JSON.stringify(currentResult.params)===JSON.stringify(r.params)&&JSON.stringify(currentResult.config)===JSON.stringify(r.config))r.time=currentResult.time;captureWorkflowChange(r,currentResult);renderResult(r);history.unshift(r);history=history.slice(0,50);persistHistory();renderHistory();if(!silent)toast(`方案已保存 · ${r.recommended?'推荐'+recommendationName(r):'无合格方案，仅供比较'} · 预计${r.reduction>=0?'减排':'增排'} ${fmt(Math.abs(r.reduction),1)}%`);return r;
  }catch(error){console.error(error);toast('方案生成失败，请检查参数后重试。');}
  finally{busy=false;controls.forEach(el=>el.disabled=false);$('generate').classList.remove('loading');$('generate').querySelector('span').textContent='生成三种方案';renderDecision(currentResult);renderEnvironment(currentResult);renderWorkflow(currentResult);}
}
async function exportResult(r){if(!r){toast('请先生成一个航次。');return;}const rows=[['智航绿脉 · 比赛演示航次报告'],['性质','模拟数据与简化模型估算，不用于实际导航'],['航次编号',r.id],['生成时间',new Date(r.time).toLocaleString('zh-CN')],['出发港',PORTS[r.params.start].full],['目的港',PORTS[r.params.end].full],['所选方案',r.optimized.name],['参考航速 kn',r.params.speed],['实际航速 kn',r.optimized.speed],['吨位 DWT',r.params.dwt],['洋流影响',r.params.current?'开启：沿航向投影':'关闭'],['经济/时效风浪避让开关',r.params.storm?'开启':'关闭'],['当前航路',r.optimized.variant==='safety'?'稳妥绕行（间距见计算结果）':r.optimized.variant==='bypass'?'风浪绕行':'常规海上航路'],['燃油价格 USD/t',r.config.fuel],['碳成本 USD/t CO2',r.config.carbon],[],['指标','基准情景',r.optimized.name,'节省（负数表示增加）'],...Object.entries({distance:'航程 nm',hours:'总耗时 h（含候泊）',fuel:'燃油 t',co2:'CO2 t',cost:'成本 USD'}).map(([key,label])=>[label,...[r.baseline[key],r.optimized[key],r.saved[key]].map(n=>n.toFixed(2))]),['减排率（负数表示增排）',r.reduction.toFixed(2)+'%'],[],['三方案对比','航速 kn','航程 nm','总耗时 h（含候泊）','燃油 t','CO2 t','成本 USD','风浪间距 nm'],...Object.values(r.alternatives).map(a=>[a.name,a.speed,...['distance','hours','fuel','co2','cost','clearance'].map(k=>a[k].toFixed(2))]),[],['模型说明','参考日油耗 32 t/day；吨位指数 2/3；航速指数 3；CO2 系数 3.114'],['数据说明','预设航路与模拟船队；环境采用公开海洋模型或季节估算，台风为独立推演']];rows.push(...decisionReportRows(r),...environmentReportRows(r),...workflowReportRows(r));const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');const filename=`EcoVoyager-${r.id}-${r.planId.toUpperCase()}.csv`;
  downloadReport(new Blob([csv],{type:'text/csv;charset=utf-8;'}),filename);
}
function downloadReport(blob,filename){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('报告已导出，请在浏览器下载列表中查看。');
}

function stopTour(showToast=true){voyageReplay?.pause();tourTimers.forEach(clearTimeout);tourTimers=[];tourRunning=false;$('tour-banner').hidden=true;$('tour-btn').innerHTML=icon('play')+'开启 60 秒演示';if(showToast)toast('自动演示已结束，可继续自由操作。');}
function startTour(){if(tourRunning){stopTour();return;}if(busy||environmentLoading){toast('请等待当前计算或海况更新完成。');return;}tourRunning=true;$('tour-banner').hidden=false;$('tour-btn').innerHTML=icon('play')+'停止自动演示';window.scrollTo({top:0,behavior:'smooth'});
  function step(delay,title,description,action){tourTimers.push(setTimeout(()=>{if(!tourRunning)return;$('tour-title').textContent=title;$('tour-description').textContent=description;action();},delay));}
  step(0,'01 / 看见航运态势','模拟船队在亚太海域运行。',()=>{navigate('overview');setMapMode(true);selectShip(1);});
  step(10000,'02 / 制定绿色航线','上海 → 新加坡，比较基准与优化情景。',()=>{resetMap();navigate('planning');setForm({start:'Shanghai',end:'Singapore',speed:18,dwt:50000,storm:true,current:true});generate({silent:true});});
  step(16000,'02 / 比较方案与回放','不同航速与绕行距离，带来不同的成本与时间。',()=>{selectPlan('eco');voyageReplay.setRate(12);$('replay-rate').value='12';voyageReplay.play();});
  step(24000,'03 / 理解减排依据','航程、能耗、碳排放，每一步都可以解释。',()=>navigate('carbon'));
  step(38000,'04 / 留存决策记录','航次自动保存，可以查看并导出。',()=>navigate('history'));
  step(49000,'05 / 开启下一次探索','自由调整航速、吨位与港口，探索更多情景。',()=>navigate('planning'));
  tourTimers.push(setTimeout(()=>stopTour(),60000));
}

function initialize(){
  hydrateIcons();drawGeography();initializeDecision();initializeEnvironment();initializeWorkflow();
  mapController=new VoyageExperience.MapView($('ocean-map'),$('map-viewport'),z=>{$('zoom-value').textContent=z.toFixed(1)+'×';$('zoom-in').disabled=z>=8;$('zoom-out').disabled=z<=1;scaleWaypoints();const state=voyageReplay?.state();if(state)renderPlayback(state);});
  voyageReplay=new VoyageExperience.Replay({distance:greatCircleNm,onUpdate:renderPlayback});
  $('zoom-in').onclick=()=>mapController.zoom(1.4);$('zoom-out').onclick=()=>mapController.zoom(1/1.4);$('fit-route').onclick=()=>mapController.fit(currentResult.optimized.path.map(projection));
  $('replay-play').onclick=()=>{setMapMode(false);resetSelection();voyageReplay.playing?voyageReplay.pause():voyageReplay.play();};
  $('replay-restart').onclick=()=>{setMapMode(false);voyageReplay.pause();voyageReplay.seek(0);};
  $('replay-progress').oninput=e=>{setMapMode(false);voyageReplay.seek(Number(e.target.value)/1000);};$('replay-rate').onchange=e=>voyageReplay.setRate(e.target.value);
  $('compare-shortcut').onclick=e=>{e.preventDefault();$('strategy-panel').scrollIntoView({behavior:'smooth',block:'start'});};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)voyageReplay.pause();});
  updateSliders();renderResult(calculate(paramsFromForm(),config,'eco','none','eco',selectedEnvironment),true);renderHistory();updateFleet();
  $('fuel-price').value=config.fuel;$('carbon-price').value=config.carbon;
  document.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>navigate(el.dataset.page));
  document.querySelector('.brand').onclick=e=>{e.preventDefault();navigate('overview');};
  ['start-port','end-port','avoid-storm','use-current'].forEach(id=>$(id).addEventListener('change',markStale));['speed','dwt'].forEach(id=>$(id).addEventListener('input',markStale));
  $('generate').onclick=()=>generate();$('map-route').onclick=()=>setMapMode(false);$('map-fleet').onclick=()=>setMapMode(true);$('reset-map').onclick=resetMap;$('weather-toggle').onclick=()=>{weatherVisible=!weatherVisible;drawWeather(currentResult.params);};
  $('export-report').onclick=()=>exportResult(currentResult);$('clear-history').onclick=()=>{if(!history.length){toast('暂无记录。');return;}if(window.confirm('清空当前浏览器中的全部演示航次？已导出的文件不受影响。')){history=[];persistHistory();renderHistory();toast('航次记录已清空。');}};
  $('settings-form').onsubmit=e=>{e.preventDefault();const next={fuel:Number($('fuel-price').value),carbon:Number($('carbon-price').value)};if(!Number.isFinite(next.fuel)||next.fuel<1||next.fuel>5000||!Number.isFinite(next.carbon)||next.carbon<0||next.carbon>2000)return;config=next;saveLocal('eco-config-v1',config);markStale();toast('情景参数已保存。重新生成航线后应用新价格。');};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器未允许全屏，可以按 F11 进入全屏。');}};
  $('help').onclick=()=>$('info-dialog').showModal();document.querySelectorAll('.dialog-close,.dialog-close-button').forEach(el=>el.onclick=()=>$('info-dialog').close());$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('tour-btn').onclick=startTour;$('stop-tour').onclick=()=>stopTour();$('logout').onclick=()=>{stopTour(false);voyageReplay?.pause();window.DemoAuth.logout();};
  const tick=()=>$('clock').textContent=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+' CST';tick();setInterval(tick,1000);setInterval(updateFleet,1000);navigate(location.hash.slice(1)||'overview');if(rejectedHistory)toast('已跳过 '+rejectedHistory+' 条异常历史记录，正常记录仍可使用。');
}
window.DemoAuth.ready.then(user=>{if(user)initialize();});
// Pure calculation helpers are available for local smoke checks, without network access.
window.EcoVoyager={calculate,greatCircleNm,distanceNm,PORTS,CORRIDORS,STRATEGIES,EVENTS,getDraft:()=>eventDraft,getReplay:()=>voyageReplay?.state(),getResult:()=>currentResult};
