'use strict';
function initializeEnvironment(){
  $('strategy-panel').insertAdjacentHTML('beforebegin',`<article class="panel environment-panel" id="environment-panel"><h2>海洋环境 · 洋流与浪高</h2><div class="environment-controls"><label>数据模式 <select id="environment-mode"><option value="seasonal">季节估算 · 离线可用</option><option value="live">公开海况 · 需联网</option></select></label><label id="environment-month-label">月份 <select id="environment-month">${Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+' 月</option>').join('')}</select></label><button class="button secondary" id="environment-refresh">获取公开海况</button></div><p class="environment-status" id="environment-status" role="status"></p><div class="environment-summary" id="environment-summary"></div><p class="environment-note">蓝色箭头表示洋流流向；“计入洋流影响”开关控制其是否参与计算。浪高始终参与估算。联网数据来自 <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noopener">Open-Meteo Marine</a>（海洋模型，非现场实测）；16 个区域采样点插值，按整段航路平均环境估算，不预测未来沿途天气。台风按钮使用独立预设风区。<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">数据署名 CC BY 4.0</a></p></article>`);
  $('environment-month').value=selectedEnvironment.month;
  $('environment-refresh').onclick=refreshEnvironment;
  $('environment-mode').onchange=()=>{if($('environment-mode').value==='live')refreshEnvironment();else{environmentMode='seasonal';selectedEnvironment=MarineEnvironment.seasonal(Number($('environment-month').value));environmentMessage='已切换季节估算，生成方案后生效。';markStale();renderEnvironment(currentResult);}};
  $('environment-month').onchange=()=>{selectedEnvironment=MarineEnvironment.seasonal(Number($('environment-month').value));environmentMode='seasonal';environmentMessage='季节月份已调整，生成方案后生效。';markStale();renderEnvironment(currentResult);};
}
function restoreEnvironment(snapshot){selectedEnvironment=MarineEnvironment.clean(snapshot);environmentMode=snapshot.kind;environmentMessage='已载入历史环境快照；重新生成时会检查联网数据是否过期。';}
function environmentForGeneration(){
  if(selectedEnvironment.kind==='live'&&!MarineEnvironment.fresh(selectedEnvironment)){selectedEnvironment=MarineEnvironment.seasonal();environmentMode='seasonal';environmentMessage='联网快照已超过 6 小时，已回退到当月季节估算。';}
  return selectedEnvironment;
}
async function refreshEnvironment(){
  if(busy||environmentLoading)return;
  if(tourRunning)stopTour(false);
  environmentLoading=true;environmentMessage='正在获取公开洋流和浪高…';markStale();renderEnvironment(currentResult);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    if(location.protocol==='file:')throw Error('纯文件模式');
    const response=await fetch('/api/environment',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('海况服务不可用');
    const snapshot=await response.json();if(!MarineEnvironment.fresh(snapshot))throw Error('海况缺失或过期');
    selectedEnvironment=MarineEnvironment.clean(snapshot);environmentMode='live';environmentMessage='公开海况已就绪，点击“生成并推荐方案”应用。';
  }catch{selectedEnvironment=MarineEnvironment.seasonal();environmentMode='seasonal';environmentMessage=location.protocol==='file:'?'纯文件模式使用季节估算；访问部署的网站可获取公开海况。':'联网海况不可用、缺失或过期，已回退当月季节估算；生成后生效。';}
  finally{clearTimeout(timer);environmentLoading=false;markStale();renderEnvironment(currentResult);}
}
function renderEnvironment(r){
  if(!$('environment-panel'))return;
  $('environment-mode').value=environmentMode;
  if(selectedEnvironment.kind==='seasonal')$('environment-month').value=selectedEnvironment.month;
  $('environment-month-label').hidden=environmentMode==='live';
  for(const id of ['environment-mode','environment-month','environment-refresh'])$(id).disabled=environmentLoading||busy;
  $('environment-status').textContent=environmentMessage+' 待生成数据：'+MarineEnvironment.describe(selectedEnvironment);
  $('environment-status').classList.toggle('environment-warning',environmentMessage.includes('回退'));
  const box=$('environment-summary');box.replaceChildren();
  if(r){const source=document.createElement('span');source.textContent='当前结果：'+MarineEnvironment.describe(r.environment)+(r.environment.kind==='live'&&!MarineEnvironment.fresh(r.environment)?'（历史快照，已过期）':'');box.append(source);
    for(const [label,value] of [['沿程洋流',fmt(r.optimized.currentAlong,2)+' kn（正为顺流，负为逆流）'],['平均浪高',fmt(r.optimized.waveHeight,2)+' m'],['基准沿程洋流',fmt(r.baseline.currentAlong,2)+' kn']]){const span=document.createElement('span');span.textContent=label+' '+value;box.append(span);}}
}
function drawEnvironmentArrows(group,r){
  if(!r?.environment)return;
  const samples=[[124,26],[128,29],[135,32],[127,33],[120,24],[116,18],[111,12],[107,6]];
  for(const [lon,lat] of samples){const v=MarineEnvironment.at(r.environment,lon,lat),bearing=Math.atan2(v.east,v.north)*180/Math.PI,[x,y]=projection([lon,lat]);const arrow=svgEl('path',{d:'M0 12 L0 -12 M-4 -6 L0 -12 L4 -6',class:'ocean-current-arrow',transform:`translate(${x} ${y}) rotate(${bearing})`});const title=svgEl('title');title.textContent=v.label+' · '+fmt(Math.hypot(v.east,v.north),2)+' kn · 浪高 '+fmt(v.wave,1)+' m';arrow.append(title);group.append(arrow);}
}
function environmentReportRows(r){return [[],['海洋环境',MarineEnvironment.describe(r.environment)],['环境数据类型',r.environment.kind==='live'?'公开海洋模型快照（非实测）':'季节经验估算（非实测）'],['来源链接','https://open-meteo.com/en/docs/marine-weather-api'],['公开数据许可','CC BY 4.0；Open-Meteo / Copernicus'],['环境模型版本',1],['估算口径','同一环境快照；沿航路距离加权的洋流投影和浪高；整段等效速度，不逐时预报'],['对地航速','max(1, (对水航速 + 洋流投影) × 浪高降速系数 × 台风系数)'],['浪高降速系数','max(0.65, 1 - 0.035 × max(0, 浪高 - 1))'],['环境油耗系数','(1 + 0.04 × max(0, 浪高 - 1)) × 台风系数；系数为演示假设'],['台风来源','独立预设位置；非实时台风或预警'],['方案','沿程洋流 kn','平均浪高 m','浪高降速系数'],...[[ '基准',r.baseline],...Object.values(r.alternatives).map(p=>[p.name,p])].map(([name,p])=>[name,p.currentAlong,p.waveHeight,p.waveSpeedFactor])];}
