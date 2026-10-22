import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

function model(storage={}) {
  const sandbox={console,Intl,Date,performance,crypto:webcrypto,structuredClone,
    localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=v;}},
    DemoAuth:{ready:{then(){}}}};
  sandbox.window=sandbox;const context=vm.createContext(sandbox);
  for(const file of ['assets/map-data.v1.js','marine.js','assets/environment.js','assets/workflow.js','assets/archive.js','assets/experience.js','assets/advanced.js','assets/workflow-ui.js','assets/decision.js','app.js'])
    vm.runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context,{filename:file});
  return source=>vm.runInContext(source,context);
}
const base="VoyageWorkflow.normalize({start:'Shanghai',end:'Singapore',speed:18,dwt:50000,storm:true,current:true})";
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);

test('all routes, seasons, events and switches respect costs and clearance',()=>{
  const run=model();let count=0;
  for(const start of ['Shanghai','Ningbo'])for(const end of ['Singapore','Tokyo','Busan'])for(const month of [1,7])for(const event of ['none','typhoon','congestion'])for(const current of [true,false])for(const storm of [true,false]){
    const r=run(`calculate({...${base},start:'${start}',end:'${end}',current:${current},storm:${storm}},{fuel:650,carbon:85,hire:4000,delay:100},'eco','${event}','eco',MarineEnvironment.seasonal(${month}))`);
    for(const plan of Object.values(r.alternatives)){
      assert.ok(Number.isFinite(plan.cost)&&plan.cost>0);
      near(plan.cost,plan.fuelCost+plan.carbonCost+plan.hireCost+plan.delayCost);
      near(plan.co2,plan.fuel*3.114);
      if(storm&&event==='none')assert.ok(plan.clearance>=0,`${start}/${end}/${plan.id} crossed storm`);
      if(plan.requirements.feasible&&(storm||event==='typhoon'||plan.id==='safe'))assert.ok(plan.clearance>=plan.requirements.minimumClearance);
    }
    near(r.effects.routeFuel+r.effects.speedFuel,r.saved.fuel);
    const chosen=Object.values(r.alternatives).filter(p=>p.requirements.feasible).sort((a,b)=>a.cost-b.cost||a.hours-b.hours)[0];
    assert.equal(r.recommended,chosen?.id??null);
    assert.doesNotThrow(()=>run(`VoyageArchive.restore(VoyageArchive.pack(${JSON.stringify(r)}),{validResult,strategies:STRATEGIES})`));
    count++;
  }
  assert.equal(count,144);
});

test('exact segment clearance detects crossing between distant waypoints',()=>{
  const run=model();near(run('routeClearance([[100,0],[110,0]],[105,0],60)'),-60);
  near(run('routeClearance([[100,0],[101,0]],[102,0],0)'),60.0404607326);
});

test('deadlines and budget are hard constraints even when delay costs are configured',()=>{
  const run=model();
  const r=run(`calculate({...${base},deadline:1,budget:1},{fuel:650,carbon:85,hire:4000,delay:100})`);
  assert.equal(r.recommended,null);
  for(const p of Object.values(r.alternatives)){assert.equal(p.requirements.feasible,false);assert.ok(p.delayCost>0);}
});

test('time costs can change the cheapest strategy',()=>{
  const run=model();
  const low=run(`calculate(${base},{fuel:650,carbon:85,hire:0,delay:0})`);
  const high=run(`calculate(${base},{fuel:650,carbon:85,hire:100000,delay:0})`);
  assert.notEqual(high.recommended,low.recommended);
});

test('price changes mark decisions stale; normalized legacy price settings still match',()=>{
  const run=model();
  run(`currentResult=calculate(${base});selectedEnvironment=currentResult.environment;paramsFromForm=()=>currentResult.params;`);
  assert.equal(run('decisionStale()'),false);
  run('config={...config,fuel:900};');assert.equal(run('decisionStale()'),true);
  assert.equal(run('samePrices({fuel:650,carbon:85},{fuel:650,carbon:85,hire:0,delay:0})'),true);
});

test('archives and environmental comparisons restore original numbers without recalculation',()=>{
  const run=model();
  run(`const winter=calculate(${base},config,'eco','none','eco',MarineEnvironment.seasonal(1));const summer=calculate(${base},config,'eco','none','eco',MarineEnvironment.seasonal(7));captureWorkflowChange(summer,winter);const packed=VoyageArchive.pack(summer);const originalCost=summer.optimized.cost;summer.optimized.cost=0;calculate=()=>{throw Error('must not recalculate history')};const restored=VoyageArchive.restore(packed,{validResult,strategies:STRATEGIES});`);
  assert.equal(run('restored.optimized.cost===originalCost'),true);
  assert.equal(run('previousWorkflowResult(restored).alternatives.eco.cost===winter.alternatives.eco.cost'),true);
  assert.throws(()=>run('VoyageArchive.restore({snapshotVersion:2,result:{}},{validResult,strategies:STRATEGIES})'));
});

test('legacy archives stay separate and never recalculate during startup',()=>{
  const run=model();const legacy=run(`calculate(${base})`);
  const load=model({'eco-history-v1':JSON.stringify([legacy])});
  assert.equal(load('history.length'),0);assert.equal(load('legacyRecords.length'),1);
});

test('every predefined route passes coastline checks',()=>{
  const run=model();
  for(const start of ['Shanghai','Ningbo'])for(const end of ['Singapore','Tokyo','Busan'])for(const variant of ['baseline','optimized','bypass','safety'])
    assert.equal(run(`Marine.validate(routeFor('${start}','${end}','${variant}')).ok`),true);
});

test('archive quota keeps the newest complete snapshots and reports trimming',()=>{
  const run=model();
  run(`const first=calculate(${base}),second=calculate(${base});history=[second,first];let quotaNotice='';toast=message=>{quotaNotice=message};localStorage.setItem=(key,value)=>{if(JSON.parse(value).length>1){const e=Error('full');e.name='QuotaExceededError';throw e;}};persistHistory();`);
  assert.equal(run('history.length'),1);
  assert.equal(run('history[0].id===second.id'),true);
  assert.match(run('quotaNotice'),/最新 1 条完整档案/);
});


test('replanning freezes checkpoint, avoids land, and survives a second decision and archive restore',()=>{
  const run=model();
  for(const start of ['Shanghai','Ningbo'])for(const end of ['Singapore','Tokyo','Busan'])for(const fraction of [.12,.42,.8])for(const event of ['typhoon','congestion']){
    const result=run(`(()=>{const r=chooseRecommendedResult(calculate({...${base},start:'${start}',end:'${end}'}));const elapsed=r.optimized.hours*${fraction};const before=VoyageExperience.planState(r.optimized,elapsed,greatCircleNm);const next=replanVoyage(r,'${event}',elapsed);const states=Object.values(next.alternatives).map(p=>({state:VoyageExperience.planState(p,elapsed,greatCircleNm),coast:Marine.validate(p.path).ok,feasible:p.requirements.feasible,clearance:p.clearance}));const restored=VoyageArchive.restore(VoyageArchive.pack(next),{validResult,strategies:STRATEGIES});const again=replanVoyage(restored,'congestion',elapsed+(restored.optimized.sailingHours-elapsed)*.2);return {before,next,states,restored,again};})()`);
    for(const s of result.states){near(s.state.fuel,result.before.fuel);near(s.state.elapsed,result.before.elapsed);near(s.state.distance,result.before.distance);near(s.state.coords[0],result.before.coords[0]);near(s.state.coords[1],result.before.coords[1]);assert.equal(s.coast,true);if(s.feasible&&event==='typhoon')assert.ok(s.clearance>=10);}
    near(result.next.optimized.cost,result.restored.optimized.cost);assert.equal(result.again.replan.count,2);
    for(const p of Object.values(result.again.alternatives)){near(p.cost,p.fuelCost+p.carbonCost+p.hireCost+p.delayCost);assert.ok(p.fuel>=result.next.replan.fuel);}
  }
});
test('preferences choose only feasible plans and dynamic constraints include spent totals',()=>{
  const run=model();
  for(const [pref,key] of [['cost','cost'],['carbon','co2'],['time','hours']]){
    const r=run(`rankPreference(calculate(${base}),'${pref}')`);
    assert.equal(r.recommended,Object.values(r.alternatives).filter(p=>p.requirements.feasible).sort((a,b)=>a[key]-b[key]||a.cost-b.cost)[0].id);
  }
  const r=run(`(()=>{const r=calculate({...${base},deadline:1,budget:1});return replanVoyage(r,'congestion',r.optimized.hours*.2)})()`);
  assert.equal(r.recommended,null);for(const p of Object.values(r.alternatives)){assert.ok(p.requirements.late>0);assert.ok(p.requirements.over>0);}
  assert.throws(()=>run(`(()=>{const r=calculate(${base});return replanVoyage(r,'typhoon',r.optimized.hours)})()`),/已到港/);
});
