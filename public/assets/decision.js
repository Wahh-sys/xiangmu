/* Offline scenario rehearsal. All figures are reproducible model estimates. */
'use strict';
function decisionStale(){return currentResult&&(environmentLoading||!samePrices(config,currentResult.config)||currentResult.modelVersion!==MODEL_VERSION||JSON.stringify(paramsFromForm())!==JSON.stringify(currentResult.params)||JSON.stringify(selectedEnvironment)!==JSON.stringify(currentResult.environment));}
function planDescription(r,id=r.planId){
  if(r.event==='congestion'&&id==='eco')return '按靠泊窗口减速到港，最低航速 8 kn；提前抵达时仍计候泊。';
  if(r.event==='typhoon'&&r.alternatives[id].stormExposed)return STRATEGIES[id].description+' 航路经过扩大风区，对地航速再降低 15%，油耗系数额外乘以 1.28。';
  return STRATEGIES[id].description;
}
function decisionRule(r){return '先筛选满足到港期限和预算的方案'+(r.event==='typhoon'?'，同时要求风区间距至少 10 海里':r.params.storm?'，并要求避开演示风浪区':'')+'，再按当前偏好选择'+(PREFERENCES[r.preference||'cost'])+'的合格方案；无合格方案时不推荐。';}
function eventAssumptions(r){
  if(r.replan)return '第 '+r.replan.count+' 次途中决策，出发后 '+fmt(r.replan.elapsed,1)+' h；已消耗 '+fmt(r.replan.fuel,2)+' t 燃油。已完成航段冻结；新事件仅影响未来，风区间距仅检查剩余航路。'+(r.event==='congestion'?'靠泊窗口：出发后 '+fmt(r.context.berthOpening,1)+' h。':'风区扩大 30 nm，剩余航路须留出 10 nm 间距。');
  if(r.event==='typhoon')return '风区半径由 '+fmt(CORRIDORS[r.params.end].storm[1]*60)+' 扩大为 '+fmt(r.context.radiusNm)+' 海里。穿越风区：在海况基础上对地航速再 × 0.85、油耗系数再 × 1.28。10 海里仅为演示筛选阈值。';
  if(r.event==='congestion')return '靠泊开放时刻为常态经济方案航时 + 12 小时，即出发后 '+fmt(r.context.berthOpening,1)+' 小时。候泊油耗 = 0.12 × (DWT / 50,000)²ᐟ³ t/h。';
  return '基准与三方案采用同一环境快照和同一公式；洋流沿航向投影，可顺流或逆流。浪高超过 1 m 后按简化公式降速并增加油耗；演示风区用于避让与方案筛选。';
}
function initializeDecision(){
  $('strategy-panel').insertAdjacentHTML('afterend','<article class="panel event-panel" id="event-panel"><div class="panel-heading"><div><span class="section-mark"></span><h2>突发事件推演</h2><span class="tiny-badge">SCENARIO LAB</span></div><span class="event-state" id="event-state">等待情景</span></div><div class="event-intro"><div><span class="eyebrow">WHAT IF / 如果航程遇到变化</span><h3>发现变化，比较应对的代价。</h3><p>拖动地图下方回放到途中，再触发事件：保留已航行路段、时间与油耗，仅重算剩余航程。新事件替换未来情景，不叠加。</p></div><div class="event-actions"><button class="event-trigger" id="event-typhoon">'+icon('cloud')+'<span>台风逼近<small>扩大风区 · 评估绕行</small></span></button><button class="event-trigger" id="event-congestion">'+icon('ship')+'<span>目的港拥堵<small>延迟靠泊 · 减速到港</small></span></button></div></div><div id="event-content" aria-live="polite"></div></article><details class="panel explanation-panel" id="explanation-panel"><summary><span>'+icon('sparkles')+'<b>方案决策解释</b><small>为什么推荐 · 如何计算 · 有何取舍</small></span><span class="explanation-chevron">展开 ＋</span></summary><div id="explanation-content"></div></details>');
  $('compare-shortcut').insertAdjacentHTML('afterend','<button class="decision-shortcut" id="event-shortcut">突发事件推演 →</button>');
  $('event-shortcut').onclick=()=>$('event-panel').scrollIntoView({behavior:'smooth',block:'start'});
  $('event-typhoon').onclick=()=>previewEvent('typhoon');$('event-congestion').onclick=()=>previewEvent('congestion');
  $('explanation-panel').addEventListener('toggle',()=>{$('explanation-panel').querySelector('.explanation-chevron').textContent=$('explanation-panel').open?'收起 −':'展开 ＋';});
  const layer=svgEl('g',{id:'event-layer','pointer-events':'none'});$('route-layer').after(layer);
  $('map-canvas').insertAdjacentHTML('beforeend','<div class="event-map-note" id="event-map-note" hidden></div>');
}
async function previewEvent(event){
  if(busy||environmentLoading)return;
  if(tourRunning)stopTour(false);
  if(decisionStale()){
    const generated=await generate({silent:true});
    if(!generated||decisionStale())return;
  }
  if(!currentResult)return;
  voyageReplay.pause();
  try{
  const source=currentResult.event==='none'?currentResult.planId:currentResult.sourcePlanId;
  const elapsed=voyageReplay.state()?.elapsed||0;
  if(currentResult.replan&&elapsed<currentResult.replan.elapsed-1e-7)throw Error('当前回放在历史航段。请回到上次决策点之后，或生成新航次。');
  const draft=elapsed>0?replanVoyage(currentResult,event,elapsed):calculate(currentResult.params,currentResult.config,source,event,source,currentResult.environment);draft.time=currentResult.time;rankPreference(draft,currentResult.preference);
  chooseRecommendedResult(draft);
  eventDraft=draft;setMapMode(false);weatherVisible=true;renderDecision(currentResult);
  }catch(error){console.error(error);toast(error.message||'事件推演未完成，请重试。');}
}
function applyEvent(){
  if(busy||!eventDraft||decisionStale()||!eventDraft.recommended)return;
  const r=eventDraft;captureWorkflowChange(r,currentResult);renderResult(r);setMapMode(false);recordResult(r);toast('已应用 '+EVENTS[r.event].name+' · '+r.optimized.name+(r.replan?'，已从当前船位继续，历史油耗保持不变。':'，回放从起点开始。'));
}
function resetEvent(){
  if(busy||environmentLoading)return;
  if(eventDraft){eventDraft=null;renderDecision(currentResult);return;}
  if(currentResult.event==='none')return;
  if(decisionStale()){toast('请先生成方案以应用当前参数和价格。');return;}
  if(currentResult.replan){toast('已完成航段不能撤销。请在当前船位预览其他事件，或点击生成创建新航次。');return;}
  const r=calculate(currentResult.params,currentResult.config,currentResult.sourcePlanId,'none',currentResult.sourcePlanId,currentResult.environment);r.time=currentResult.time;captureWorkflowChange(r,currentResult);renderResult(r);recordResult(r);toast('已恢复事件前方案，历史推演记录仍可查看。');
}
function timeAt(r,h){return new Date(new Date(r.time).getTime()+h*3600000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
function deltaText(before,after,unit,digits=1){const delta=after-before;return Math.abs(delta)<.005?'基本不变':(delta>0?'增加':'减少')+' '+fmt(Math.abs(delta),digits)+' '+unit;}
function eventComparison(r){
  const columns=[['01 / 事件前',r.context.before],['02 / 维持原方案',r.context.untreated],['03 / '+(eventDraft?'建议调整后':'当前所选方案'),r.optimized]];
  return '<div class="event-comparison">'+columns.map(([title,p],i)=>'<article class="event-stage stage-'+i+'"><small>'+title+'</small><h4>'+p.name+'</h4><strong>$'+fmt(p.cost)+'<span>综合成本</span></strong><dl><div><dt>到港 / 可靠泊 CST</dt><dd>'+timeAt(r,p.sailingHours)+' / '+timeAt(r,p.hours)+'</dd></div><div><dt>总耗时 / 候泊</dt><dd>'+fmt(p.hours,1)+' / '+fmt(p.waitingHours,1)+' h</dd></div><div><dt>燃油 / 碳排</dt><dd>'+fmt(p.fuel,1)+' / '+fmt(p.co2,1)+' t</dd></div><div><dt>风区边界间距</dt><dd class="'+(p.clearance<=0?'adverse':'')+'">'+(p.clearance>0?fmt(p.clearance,1)+' nm':'经过风区')+'</dd></div></dl></article>').join('')+'</div>';
}
function renderDecision(r){
  if(!r)return;
  const display=eventDraft||r,stale=decisionStale();renderWorkflow(r);
  const waiting=environmentLoading?'正在获取海况，请稍候…':busy?'正在更新方案，请稍候…':'';
  $('event-state').textContent=waiting|| (stale?'参数待更新 · 点击事件自动生成':eventDraft?'影响预览 · 尚未应用':r.event==='none'?'常态航行':EVENTS[r.event].name+' · 已应用');
  $('event-panel').setAttribute('aria-busy',String(busy||environmentLoading));
  for(const event of ['typhoon','congestion']){$('event-'+event).disabled=busy||environmentLoading;$('event-'+event).setAttribute('aria-pressed',String(display.event===event));$('event-'+event).title=waiting||(stale?'自动更新方案并预览该事件':'预览事件影响');}
  if(display.context){
    const p=display.optimized,b=display.context.untreated;
    $('event-content').innerHTML='<div class="event-alert">'+icon(EVENTS[display.event].icon)+'<div><strong>'+EVENTS[display.event].name+' · '+(eventDraft?'情景预警，建议待应用':'推演已应用')+'</strong><p>'+eventAssumptions(display)+'</p></div></div>'+eventComparison(display)+'<div class="event-verdict"><div><b>'+(display.recommended?'规则推荐：'+STRATEGIES[display.recommended].name:'暂无满足筛选条件的方案')+'</b><p>'+decisionRule(display)+(eventDraft?' 地图叠加虚线为建议航路，顶部指标仍为当前已应用方案。':'')+'</p><p>较“维持原方案”：成本'+deltaText(b.cost,p.cost,'USD',0)+'；总耗时'+deltaText(b.hours,p.hours,'小时')+'；碳排'+deltaText(b.co2,p.co2,'t')+'。</p></div><div class="event-confirm">'+(eventDraft?'<button class="button primary" id="event-apply" '+(!display.recommended||stale||busy?'disabled':'')+'>应用推荐方案 '+icon('arrow')+'</button>':'')+'<button class="button secondary" id="event-reset">'+(eventDraft?'取消预览':display.replan?'已完成航段已锁定':'恢复事件前方案')+'</button><button class="text-button" id="event-show-map">查看地图上的变化 ↑</button></div></div>';
    if($('event-apply'))$('event-apply').onclick=applyEvent;$('event-reset').onclick=resetEvent;$('event-reset').disabled=Boolean(!eventDraft&&display.replan);$('event-show-map').onclick=()=>$('map-canvas').scrollIntoView({behavior:'smooth',block:'center'});
  }else $('event-content').innerHTML='<div class="event-empty">'+icon('shield')+'<p>'+(waiting||(stale?'参数或海况已调整，直接点击上方事件即可自动更新方案并预览。':'选择上方事件，比较事件前、维持原方案与应对方案的差异。'))+'<span>预览后点击“应用推荐方案”生效；台风为情景，不代表实时预警。</span></p></div>';
  renderEventMap(display);renderExplanation(r);renderAdvanced(r);
  $('explain-open')?.remove();$('insight-content').insertAdjacentHTML('beforeend','<button class="decision-link" id="explain-open">为什么推荐？查看计算依据 →</button>');
  $('explain-open').onclick=()=>{$('explanation-panel').open=true;$('explanation-panel').scrollIntoView({behavior:'smooth',block:'start'});};
  document.querySelector('.comparison-summary>span').textContent=r.event==='congestion'?'总耗时（含候泊）':'预计航行时间';
  document.querySelector('.replay-eta').firstChild.textContent=r.event==='congestion'?'预计可靠泊 ':'预计到达 ';
}
function stormRing(center,radiusNm){
  const rad=Math.PI/180,lat=center[1]*rad,lon=center[0]*rad,d=radiusNm/3440.065;
  return Array.from({length:73},(_,i)=>{const bearing=i*5*rad;const y=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(bearing));const x=lon+Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(y));return[x/rad,y/rad];});
}
function renderEventMap(r){
  $('event-layer').replaceChildren();drawWeather(r.params,r);
  $('event-map-note').hidden=r.event==='none';if(r.event==='none')return;
  $('event-map-note').textContent=(eventDraft?'预览 · ':'已应用 · ')+EVENTS[r.event].name+(eventDraft?' · 紫虚线为建议航路':' · 淡虚线为事件前航路');
  const route=eventDraft?r.optimized.path:r.context.before.path;
  $('event-layer').append(svgEl('path',{d:pathString(route),class:'event-route '+(eventDraft?'event-proposal':'')}));
  if(r.event==='congestion'){const [x,y]=projection(PORTS[r.params.end].coords);$('event-layer').append(svgEl('circle',{cx:x,cy:y,r:22,class:'congestion-ring'}));const t=svgEl('text',{x:x+25,y:y+24,class:'event-port-label'});t.textContent='拥堵 · 等待靠泊窗口';$('event-layer').append(t);}
}
function explanationRows(r){const p=r.optimized;if(r.replan)return [['已完成航段','冻结原油耗和时间',fmt(r.replan.elapsed,2)+' h / '+fmt(r.replan.fuel,3)+' t'],['剩余航段','各段按原航速和海况分别计算，再累加',fmt(p.hours-r.replan.elapsed,2)+' h / '+fmt(p.fuel-r.replan.fuel,3)+' t'],['总燃油','已消耗 + 剩余预计油耗',fmt(p.fuel,3)+' t'],['碳排放','燃油 × 3.114',fmt(p.co2,3)+' t'],['综合成本','燃油 + 碳 + 总耗时 / 24 × 日租船费 + 超时费用',fmt(p.cost,2)+' USD'],['剩余成本','综合成本 − 已消耗燃油、碳和时间成本',fmt(p.cost-r.replan.cost,2)+' USD'],['航路贡献','维持原方案油耗 − 新航路参考航速油耗',fmt(r.effects.routeFuel,3)+' t'],['调速贡献','新航路参考航速油耗 − 实际油耗',fmt(r.effects.speedFuel,3)+' t']];return [
  ['航程','沿预设海上航路累加球面距离',fmt(p.distance,2)+' nm'],
  ['航速','实际航速 '+fmt(p.speed,4)+' kn；沿程洋流 '+fmt(p.currentAlong,3)+' kn；浪高降速系数 '+fmt(p.waveSpeedFactor,4)+(p.stormExposed?'；风区对地航速 × 0.85':''),'对地 '+fmt(p.groundSpeed,4)+' kn'],
  ['航行时间','航程 ÷ 等效对地航速（沿程平均环境）',fmt(p.distance,2)+' ÷ '+fmt(p.groundSpeed,4)+' = '+fmt(p.sailingHours,2)+' h'],
  ['候泊时间','max(0，靠泊开放时刻 − 航行时间)',fmt(r.context?.berthOpening||0,2)+' − '+fmt(p.sailingHours,2)+' → '+fmt(p.waitingHours,2)+' h'],
  ['参考日油耗','船型×载重系数 '+fmt(VoyageWorkflow.burnFactor(r.params),3)+' × 32 × ('+fmt(r.params.dwt)+' / 50,000)²ᐟ³ × ('+fmt(p.speed,4)+' / 18)³',fmt(p.dailyBurn,3)+' t/day'],
  ['航行油耗','参考日油耗 × 航行时间 / 24 × 环境系数',fmt(p.dailyBurn,3)+' × '+fmt(p.sailingHours,2)+' / 24 × '+p.weatherFactor.toFixed(2)+' = '+fmt(p.sailingFuel,3)+' t'],
  ['候泊油耗','0.12 × (DWT / 50,000)²ᐟ³ × 候泊小时',fmt(p.idleBurn,4)+' × '+fmt(p.waitingHours,2)+' = '+fmt(p.waitingFuel,3)+' t'],
  ['碳排放','(航行油耗 + 候泊油耗) × 3.114',fmt(p.fuel,3)+' × 3.114 = '+fmt(p.co2,3)+' t CO₂'],
  ['燃油费用','总油耗 × 燃油单价',fmt(p.fuel,3)+' × $'+fmt(r.config.fuel)+' = $'+fmt(p.fuelCost,2)],
  ['碳成本','碳排放 × 碳成本单价',fmt(p.co2,3)+' × $'+fmt(r.config.carbon)+' = $'+fmt(p.carbonCost,2)],
  ['时间成本','总耗时 / 24 × 日租船成本',fmt(p.hours,2)+' / 24 × $'+fmt(r.config.hire)+' = $'+fmt(p.hireCost,2)],
  ['超时费用','超过约定到港期限的小时 × 每小时费用',fmt(p.delayHours,2)+' × $'+fmt(r.config.delay)+' = $'+fmt(p.delayCost,2)],
  ['航路贡献','基准油耗 − 所选航路按参考航速的油耗',fmt(r.effects.routeFuel,3)+' t 燃油'],
  ['调速贡献','所选航路参考航速油耗 − 实际航速油耗（含候泊变化）',fmt(r.effects.speedFuel,3)+' t 燃油']
];}
function renderExplanation(r){
  const p=r.optimized,recommended=r.recommended&&r.alternatives[r.recommended];
  const tradeoffs=Object.values(r.alternatives).filter(a=>a.id!==p.id).map(a=>'相对'+a.name+'：成本'+deltaText(a.cost,p.cost,'USD',0)+'，总耗时'+deltaText(a.hours,p.hours,'小时')+'，碳排'+deltaText(a.co2,p.co2,'t')+'。');
  $('explanation-content').innerHTML='<div class="explanation-lead"><div><span class="eyebrow">EXPLAINABLE DECISION / 当前已应用方案</span><h3>'+p.name+' · '+EVENTS[r.event].name+'</h3><p>'+planDescription(r)+' '+decisionRule(r)+'</p><p>'+(recommended?'规则推荐 '+recommended.name+'；'+(r.planId===r.recommended?'当前已选择该方案。':'当前保留你的选择，可通过方案卡片切换。'):'没有方案满足当前筛选条件。')+'</p></div><div class="cost-total"><small>综合成本 USD</small><strong>$'+fmt(p.cost,2)+'</strong><span>燃油 $'+fmt(p.fuelCost,2)+' + 碳成本 $'+fmt(p.carbonCost,2)+' + 时间 $'+fmt(p.hireCost,2)+' + 超时 $'+fmt(p.delayCost,2)+'</span></div></div><div class="formula-scroll"><table class="formula-table"><thead><tr><th>指标</th><th>计算依据</th><th>本次结果</th></tr></thead><tbody>'+explanationRows(r).map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="explanation-foot"><div><b>选择的代价与收益</b>'+tradeoffs.map(t=>'<p>'+t+'</p>').join('')+'<p>相较同一情景基准：燃油'+deltaText(r.baseline.fuel,p.fuel,'t')+'；碳排'+deltaText(r.baseline.co2,p.co2,'t')+'；成本'+deltaText(r.baseline.cost,p.cost,'USD',0)+'。</p></div><div><b>情景假设与边界</b><p>'+eventAssumptions(r)+'</p><p>基准环境系数 '+r.baseline.weatherFactor.toFixed(2)+'。采用当前航次保存的价格；综合成本包含燃油、碳、租船时间及超时费用，不含港口作业费。到港期限同时作为硬约束，超时方案不参与推荐。显示值四舍五入，计算使用未取整数值。</p><p>预设航路与简化环境响应，不代表实测节能；台风为推演，不能用于实船导航。</p></div></div>';
}
function decisionReportRows(r){
  const rows=[[],['事件推演',EVENTS[r.event].name],['事件前所选方案',STRATEGIES[r.sourcePlanId].name],['规则推荐',r.recommended?STRATEGIES[r.recommended].name:'无符合条件方案'],['推荐依据',decisionRule(r)],['情景假设',eventAssumptions(r)]];
  if(r.context){rows.push(['对比口径',r.replan?'保留已完成航段，仅重算剩余；基准为新事件下维持原方案':'同一起点、同一出发时间重算整个航次；事件不叠加'],['阶段','方案','到港 CST','可靠泊 CST','总耗时 h','候泊 h','燃油 t','CO2 t','成本 USD']);for(const [name,p] of [['事件前',r.context.before],['维持原方案',r.context.untreated],['当前应对方案',r.optimized]])rows.push([name,p.name,timeAt(r,p.sailingHours),timeAt(r,p.hours),p.hours,p.waitingHours,p.fuel,p.co2,p.cost]);}
  rows.push([],['方案决策解释','公式或依据','计算结果'],...explanationRows(r),['综合成本 USD',r.optimized.cost.toFixed(2)],['成本边界','含燃油、碳、租船时间及超时费用；不含港口作业费；超时方案不参与推荐']);return rows;
}
