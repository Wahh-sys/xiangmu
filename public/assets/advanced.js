/* Dynamic decisions share the main voyage formulas and freeze completed legs. */
'use strict';
const PREFERENCES={cost:'综合成本最低',carbon:'碳排放最少',time:'可靠泊时间最短'};
function rankPreference(r,preference=r.preference||'cost'){
  r.preference=Object.hasOwn(PREFERENCES,preference)?preference:'cost';
  VoyageWorkflow.choose(r.alternatives,r.params,r.event);
  const key={cost:'cost',carbon:'co2',time:'hours'}[r.preference];
  r.recommended=Object.values(r.alternatives).filter(p=>p.requirements.feasible).sort((a,b)=>a[key]-b[key]||a.cost-b.cost||a.hours-b.hours)[0]?.id||null;
  if(r.context)r.context.recommended=r.recommended;
  return r;
}
const LEG_FIELDS=['distance','hours','sailingHours','waitingHours','sailingFuel','waitingFuel','fuel','idleBurn'];
function voyageLeg(p){return {...Object.fromEntries(LEG_FIELDS.map(k=>[k,p[k]])),path:p.path.map(c=>[...c])};}
function remainingRoutes(r,state,variant){
  const points=[...CORRIDORS[r.params.end][variant],PORTS[r.params.end].coords];
  let nearest=0;for(let i=1;i<points.length;i++)if(greatCircleNm(state.coords,points[i])<greatCircleNm(state.coords,points[nearest]))nearest=i;
  const candidates=[];
  for(let i=nearest;i<Math.min(points.length,nearest+4);i++){
    if(greatCircleNm(points[i],points.at(-1))>greatCircleNm(state.coords,points.at(-1))+10)continue;
    const coarse=[state.coords,...points.slice(i)];
    if(Marine.validate(coarse).ok)candidates.push(Marine.densify(coarse));
  }
  if(variant===r.optimized.variant)candidates.push(state.remainingPath);
  return candidates;
}
function replanVoyage(r,event,elapsed){
  if(elapsed<=0)return calculate(r.params,r.config,r.planId,event,r.planId,r.environment);
  if(elapsed<(r.replan?.elapsed||0)-1e-7)throw Error('请将回放拖到上次决策点之后，再触发新事件。');
  if(elapsed>=r.optimized.sailingHours-1e-7)throw Error('船舶已到港，请在抵港前触发途中重规划。');
  const state=VoyageExperience.planState(r.optimized,elapsed,greatCircleNm);
  if(state.completed.length>=24)throw Error('本航次已完成 24 次调整，请生成新的航次。');
  const completed=state.completed.map(voyageLeg),prices=r.config,params=r.params;
  const normal=calculate(params,prices,r.planId,'none',r.planId,r.environment);
  const berthOpening=event==='congestion'?Math.max(normal.alternatives.eco.hours,elapsed)+12:0;
  const metrics=voyageMetrics(params,prices,r.environment,event,Math.max(0,berthOpening-elapsed));
  const [center,baseRadius]=CORRIDORS[params.end].storm,radiusNm=baseRadius*60+(event==='typhoon'?30:0);
  const minimum=event==='typhoon'?10:0;
  function total(future,id,variant,referenceFuel){
    const p={...future,id,name:STRATEGIES[id].name,color:STRATEGIES[id].color,variant,referenceFuel:state.fuel+referenceFuel,legs:[...completed,voyageLeg(future)]};
    p.path=VoyageExperience.joinPaths(p.legs);
    for(const k of ['distance','hours','sailingHours','waitingHours','sailingFuel','waitingFuel','fuel'])p[k]=p.legs.reduce((sum,l)=>sum+l[k],0);
    p.co2=p.fuel*3.114;p.fuelCost=p.fuel*prices.fuel;p.carbonCost=p.co2*prices.carbon;p.energyCost=p.fuelCost+p.carbonCost;p.hireCost=p.hours/24*prices.hire;
    p.delayHours=params.deadline===null?0:Math.max(0,(params.arrivalBasis==='berth'?p.hours:p.sailingHours)-params.deadline);p.delayCost=p.delayHours*prices.delay;p.cost=p.energyCost+p.hireCost+p.delayCost;
    p.requirements=VoyageWorkflow.assess(p,params,event);return p;
  }
  const alternatives={};
  for(const [id,strategy] of Object.entries(STRATEGIES)){
    const variants=id==='safe'?['safety']:params.storm||event==='typhoon'?['bypass','safety']:['optimized','bypass'];
    let candidates=variants.flatMap(variant=>remainingRoutes(r,state,variant).map(path=>({path,variant,distance:distanceNm(path),clearance:routeClearance(path,center,radiusNm)})));
    if(!candidates.length)candidates=[{path:state.remainingPath,variant:r.optimized.variant,distance:distanceNm(state.remainingPath),clearance:routeClearance(state.remainingPath,center,radiusNm)}];
    const enforce=params.storm||event==='typhoon'||id==='safe';
    const feasible=candidates.filter(c=>!enforce||c.clearance>=minimum);
    const chosen=feasible.sort((a,b)=>a.distance-b.distance)[0]||candidates.sort((a,b)=>b.clearance-a.clearance)[0];
    let speed=Math.round(params.speed*strategy.factor*10)/10;
    if(event==='congestion'&&id==='eco'){
      const probe=metrics(chosen.path,speed);speed=Math.max(8,Math.min(speed,probe.distance/Math.max(.01,berthOpening-elapsed)/probe.waveSpeedFactor-probe.currentAlong));
    }
    alternatives[id]=total(metrics(chosen.path,speed),id,chosen.variant,metrics(chosen.path,params.speed).fuel);
  }
  const untreated=total(metrics(state.remainingPath,r.optimized.speed),r.planId,r.optimized.variant,metrics(state.remainingPath,params.speed).fuel);
  const spentDelay=params.deadline===null?0:Math.max(0,elapsed-params.deadline)*prices.delay;
  const spentCost=state.fuel*(prices.fuel+3.114*prices.carbon)+elapsed/24*prices.hire+spentDelay;
  const draft={...structuredClone(r),id:newVoyageId(),savedAt:new Date().toISOString(),modelVersion:MODEL_VERSION,sourcePlanId:r.planId,event,alternatives,baseline:untreated,comparison:undefined,replan:{elapsed,fuel:state.fuel,distance:state.distance,cost:spentCost,coords:state.coords,count:(r.replan?.count||0)+1},context:{before:structuredClone(r.optimized),untreated,berthOpening,radiusNm,center},recommended:null};
  rankPreference(draft);return updateSelection(draft,draft.recommended||r.planId);
}
function initializeAdvanced(){
  $('workflow-recommendation').insertAdjacentHTML('beforebegin',`<article id="decision-chart-panel" class="panel decision-chart-panel"><div class="panel-heading"><div><span class="section-mark"></span><h2>三方案指标对比</h2></div><span class="tiny-badge">DECISION ATLAS</span></div><div class="atlas-toolbar"><div><span class="eyebrow">TIME / COST / CARBON</span><p>同一航次 · 同一环境 · 同一约束</p></div><label>推荐偏好<select id="decision-preference"><option value="cost">经济 · 综合成本最低</option><option value="carbon">低碳 · 碳排放最少</option><option value="time">准时 · 可靠泊时间最短</option></select></label></div><div id="decision-chart"></div><div id="atlas-selection" class="atlas-selection" aria-live="polite"></div><div id="replan-summary" class="replan-summary" hidden></div></article>`);
  $('decision-preference').onchange=()=>{
    if(decisionStale()||busy||environmentLoading)return;
    const r=structuredClone(currentResult);r.id=newVoyageId();r.savedAt=new Date().toISOString();rankPreference(r,$('decision-preference').value);chooseRecommendedResult(r);renderResult(r);recordResult(r);
  };
  document.querySelector('#workflow-panel .workflow-actions').insertAdjacentHTML('beforeend','<button id="decision-brief" class="button secondary">生成一页决策简报 ↗</button>');
  $('decision-brief').onclick=openDecisionBrief;
  document.body.insertAdjacentHTML('beforeend','<dialog id="brief-dialog" aria-labelledby="brief-heading"><div class="brief-toolbar"><span>已保存结果快照 · A4 纵向</span><button id="brief-print" class="button primary">打印 / 保存 PDF</button><button id="brief-close" class="button secondary">关闭</button></div><div id="brief-page"></div></dialog>');
  $('brief-close').onclick=()=>$('brief-dialog').close();$('brief-print').onclick=()=>window.print();
}
function renderAdvanced(r){
  if(!$('decision-chart'))return;
  const disabled=Boolean(busy||environmentLoading||decisionStale()),plans=Object.values(r.alternatives),basis=r.params.arrivalBasis==='berth'?'hours':'sailingHours';
  $('decision-preference').value=r.preference||'cost';$('decision-preference').disabled=disabled;
  const metrics=[['cost','综合成本','USD',0,r.params.budget,'预算'],[basis,basis==='hours'?'可靠泊总耗时':'到港航时','h',1,r.params.deadline,'期限'],['co2','碳排放','t CO₂',1,null,'']];
  const charts=metrics.map(([key,label,unit,digits,limit,limitName])=>{
    const maximum=Math.max(1,...plans.map(p=>p[key]));
    // Separate zero-based scales keep different units comparable within each metric.
    const scale=Math.max(maximum,limit&&limit<=maximum*1.5?limit:0)*1.25;
    const ticks=Array.from({length:5},(_,i)=>{const value=scale*i/4;return `<span class="atlas-bar-tick" style="bottom:${i*25}%"><span>${value>=1000?fmt(value/1000,value>=10000?0:1)+'k':fmt(value,value===0?0:1)}</span></span>`;}).join('');
    const limitLine=limit&&limit<=scale?`<span class="atlas-bar-limit" style="bottom:${limit/scale*100}%" title="${limitName} ${fmt(limit,digits)} ${unit}"></span>`:'';
    const bars=plans.map(p=>`<button class="atlas-bar-button ${p.requirements.feasible?'':'ineligible'}" data-chart-plan="${p.id}" data-chart-metric="${key}" style="--bar-color:${p.color};--bar-height:${p[key]/scale*100}%" ${disabled?'disabled':''} aria-pressed="${r.planId===p.id}" aria-label="${p.name}，${label} ${fmt(p[key],digits)} ${unit}，${requirementText(p)}" title="${p.name} · ${label} ${fmt(p[key],digits)} ${unit} · ${requirementText(p)}"><span class="atlas-bar-track"><span class="atlas-bar-fill"></span><strong class="atlas-bar-value">${fmt(p[key],digits)}</strong></span><span class="atlas-bar-name">${p.name}</span><span class="atlas-bar-state">${!p.requirements.feasible?'未满足约束':r.planId===p.id?(r.recommended===p.id?'当前 · 推荐':'当前方案'):r.recommended===p.id?'推荐':'合格'}</span></button>`).join('');
    return `<section class="atlas-bar-section" aria-label="${label}柱状图"><div class="atlas-bar-heading"><h3>${label} <small>${unit}</small></h3><span>${limit?limitName+' '+fmt(limit,digits)+' '+unit:'越低越优'}</span></div><div class="atlas-bar-plot"><div class="atlas-bar-axis" aria-hidden="true">${ticks}${limitLine}</div><div class="atlas-bar-columns">${bars}</div></div></section>`;
  }).join('');
  $('decision-chart').innerHTML='<div class="atlas-bar-charts">'+charts+'</div><div class="atlas-legend">'+plans.map((p,i)=>`<button data-chart-choice="${p.id}" style="--bubble:${p.color}" ${disabled?'disabled':''} aria-pressed="${r.planId===p.id}"><span>0${i+1} / ${p.name}${r.recommended===p.id?' · 推荐':''}</span><strong>$${fmt(p.cost)}</strong><small>${fmt(p[basis],1)} h · ${fmt(p.co2,1)} t CO₂ · ${p.requirements.feasible?'合格':'未满足约束'}</small></button>`).join('')+'</div>';
  document.querySelectorAll('[data-chart-plan],[data-chart-choice]').forEach(el=>{
    el.onclick=()=>{if(disabled)return;const id=el.dataset.chartPlan||el.dataset.chartChoice,metric=el.dataset.chartMetric;selectPlan(id);document.querySelector(metric?`[data-chart-metric="${metric}"][data-chart-plan="${id}"]`:`[data-chart-choice="${id}"]`)?.focus({preventScroll:true});};
  });
  $('atlas-selection').textContent=(disabled?'输入待更新 · 以下为上次结果。 ':'')+'当前：'+r.optimized.name+' · '+requirementText(r.optimized)+'；偏好：'+PREFERENCES[r.preference||'cost']+'。'+(r.params.deadline?' 期限 '+fmt(r.params.deadline,1)+' h。':'')+(r.params.budget?' 预算 $'+fmt(r.params.budget)+'。':'')+(r.replan?' 切换方案将回到本次决策点。':'');
  const panel=$('replan-summary');panel.hidden=!r.replan;
  if(r.replan)panel.innerHTML=`<span class="eyebrow">IN-VOYAGE / 第 ${r.replan.count} 次途中决策</span><h3>走过的航程保留，未来的航程重新选择。</h3><div class="replan-metrics"><span>已航行<strong>${fmt(r.replan.elapsed,1)} h</strong></span><span>已消耗燃油<strong>${fmt(r.replan.fuel,2)} t</strong></span><span>剩余成本<strong>$${fmt(r.optimized.cost-r.replan.cost)}</strong></span><span>剩余耗时<strong>${fmt(r.optimized.hours-r.replan.elapsed,1)} h</strong></span></div><p>已消耗成本 $${fmt(r.replan.cost)}；全程预计 $${fmt(r.optimized.cost)}。本次基准为同一新事件下维持原方案；风区间距仅针对剩余路段。</p>`;
}
function briefEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function openDecisionBrief(){
  if(!currentResult)return;
  voyageReplay?.pause();const r=structuredClone(currentResult),p=r.optimized,e=briefEscape;
  const bounds=p.path.map(projection),xs=bounds.map(c=>c[0]),ys=bounds.map(c=>c[1]);
  const left=Math.min(...xs)-30,top=Math.min(...ys)-25,width=Math.max(80,Math.max(...xs)-left+30),height=Math.max(80,Math.max(...ys)-top+25);
  const geo=$('geo-layer').innerHTML;
  const map=`<svg viewBox="${left} ${top} ${width} ${height}" aria-label="所选航线示意图"><g class="brief-land">${geo}</g><path d="${pathString(r.baseline.path)}" fill="none" stroke="#b87b38" stroke-width="2" vector-effect="non-scaling-stroke" stroke-dasharray="5 4"/><path d="${pathString(p.path)}" fill="none" stroke="#087f69" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${r.replan?`<circle cx="${projection(r.replan.coords)[0]}" cy="${projection(r.replan.coords)[1]}" r="4" fill="#7639a8"/>`:''}</svg>`;
  $('brief-page').innerHTML=`<header><span>ECO VOYAGER / 智航绿脉</span><span>航次决策简报 · 模型 v${r.modelVersion}</span></header><h1 id="brief-heading">${PORTS[r.params.start].name} → ${PORTS[r.params.end].name}</h1><p class="brief-sub">${e(r.id)} · ${e(EVENTS[r.event].name)} · 出发 ${e(new Date(r.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}))} CST</p><div class="brief-verdict"><b>${r.recommended?'推荐 '+STRATEGIES[r.recommended].name:'暂无满足约束的推荐'} · 当前选择 ${p.name}</b><p>${e(decisionRule(r))} 当前方案：${e(requirementText(p))}。</p></div><div class="brief-layout"><div class="brief-map">${map}<small>绿线：所选 · 橙虚线：基准${r.replan?' · 紫点：决策船位':''}<br>© Natural Earth · 示意航路</small></div><div class="brief-facts"><h2>航次条件</h2><p>${VoyageWorkflow.ships[r.params.shipType].name} / ${fmt(r.params.dwt)} DWT / 载重 ${fmt(r.params.load)}%</p><p>参考 ${fmt(r.params.speed,1)} kn · 所选${r.replan?'剩余航段':''} ${fmt(p.speed,1)} kn</p><p>期限：${r.params.deadline===null?'不限':fmt(r.params.deadline,1)+' h'}（${r.params.arrivalBasis==='berth'?'可靠泊':'抵达港口'}）</p><p>预算：${r.params.budget===null?'不限':'$'+fmt(r.params.budget)}</p><h2>预计结果</h2><p>到港 ${timeAt(r,p.sailingHours)} CST<br>可靠泊 ${timeAt(r,p.hours)} CST</p><p><strong>$${fmt(p.cost)}</strong> / ${fmt(p.co2,1)} t CO₂</p><p>全程 ${fmt(p.hours,1)} h · 燃油 ${fmt(p.fuel,1)} t</p></div></div><h2>三方案对比 · ${r.replan?'已完成 + 剩余':'全航次'}估算</h2><table><thead><tr><th>方案</th><th>到港 / 靠泊 h</th><th>成本 USD</th><th>CO₂ t</th><th>约束判断</th></tr></thead><tbody>${Object.values(r.alternatives).map(a=>`<tr class="${p.id===a.id?'brief-selected':''}"><td>${a.name}${r.recommended===a.id?' ★':''}</td><td>${fmt(a.sailingHours,1)} / ${fmt(a.hours,1)}</td><td>${fmt(a.cost)}</td><td>${fmt(a.co2,1)}</td><td>${e(requirementText(a))}</td></tr>`).join('')}</tbody></table><h2>成本构成 / USD</h2><div class="brief-costs">${[['燃油',p.fuelCost],['碳排',p.carbonCost],['租船时间',p.hireCost],['超时',p.delayCost]].map(([label,value])=>`<span>${label}<b>${fmt(value)}</b></span>`).join('')}</div><p class="brief-sub">单价：燃油 $${fmt(r.config.fuel)}/t · 碳 $${fmt(r.config.carbon)}/t · 租船 $${fmt(r.config.hire)}/天 · 超时 $${fmt(r.config.delay)}/h</p>${r.replan?`<p class="brief-checkpoint">途中决策 ${fmt(r.replan.elapsed,1)} h：已耗 ${fmt(r.replan.fuel,2)} t / $${fmt(r.replan.cost)}；剩余 ${fmt(p.hours-r.replan.elapsed,1)} h / $${fmt(p.cost-r.replan.cost)}。已完成航段保留，基准为新事件下维持原方案。</p>`:''}<h2>数据与假设</h2><p>${e(MarineEnvironment.describe(r.environment))}。${r.environment.kind==='live'?'获取于 '+e(r.environment.fetchedAt)+'；Open-Meteo / Copernicus，CC BY 4.0。':''}</p><p>${e(eventAssumptions(r))}</p><footer>本简报固定当前已应用结果；待生成参数及未应用预览未计入。模型估算、预设航路、台风，仅供演示，不能用于实船导航。费用不含港口作业费。</footer>`;
  $('brief-dialog').showModal();$('brief-close').focus();
}
