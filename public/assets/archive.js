/* Archives store results, not instructions to rerun the current model. */
(() => {
  'use strict';
  const nonnegative=['distance','hours','sailingHours','waitingHours','dailyBurn','idleBurn','sailingFuel','waitingFuel','fuel','co2','fuelCost','carbonCost','energyCost','hireCost','delayHours','delayCost','cost','weatherFactor','groundSpeed','speed','waveHeight','waveSpeedFactor'];
  const numeric=[...nonnegative,'clearance','currentAlong'];
  const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
  function plan(raw,strategies,baseline=false){
    if(!raw||!numeric.every(k=>finite(raw[k]))||!nonnegative.every(k=>raw[k]>=0)||raw.distance<=0||raw.groundSpeed<=0)throw Error('Invalid archived metrics');
    if(!Array.isArray(raw.path)||raw.path.length<2||raw.path.length>3000||!raw.path.every(p=>Array.isArray(p)&&p.length===2&&finite(p[0])&&finite(p[1])&&p[0]>=94&&p[0]<=148&&p[1]>=-3&&p[1]<=46))throw Error('Invalid archived path');
    const clean=Object.fromEntries(numeric.map(k=>[k,raw[k]]));clean.path=raw.path.map(p=>[...p]);
    if(!baseline){
      if(!Object.hasOwn(strategies,raw.id)||!['safety','bypass','optimized'].includes(raw.variant)||!finite(raw.referenceFuel)||raw.referenceFuel<0)throw Error('Invalid archived strategy');
      const q=raw.requirements;
      if(!q||!['arrival','late','over','minimumClearance'].every(k=>finite(q[k])&&q[k]>=0)||typeof q.wind!=='boolean'||typeof q.feasible!=='boolean')throw Error('Invalid archived requirements');
      Object.assign(clean,{id:raw.id,name:strategies[raw.id].name,color:strategies[raw.id].color,variant:raw.variant,referenceFuel:raw.referenceFuel,requirements:{arrival:q.arrival,late:q.late,over:q.over,minimumClearance:q.minimumClearance,wind:q.wind,feasible:q.feasible}});
    }
    if(raw.legs!==undefined){
      const fields=['distance','hours','sailingHours','waitingHours','sailingFuel','waitingFuel','fuel','idleBurn'];
      if(!Array.isArray(raw.legs)||!raw.legs.length||raw.legs.length>25)throw Error('Invalid legs');
      clean.legs=raw.legs.map(l=>{
        if(!fields.every(k=>finite(l[k])&&l[k]>=0)||!Array.isArray(l.path)||l.path.length<2||l.path.length>3000||!l.path.every(c=>Array.isArray(c)&&c.length===2&&finite(c[0])&&finite(c[1])&&c[0]>=94&&c[0]<=148&&c[1]>=-3&&c[1]<=46))throw Error('Invalid leg');
        return {...Object.fromEntries(fields.map(k=>[k,l[k]])),path:l.path.map(c=>[...c])};
      });
      for(const key of fields.filter(k=>k!=='idleBurn'))if(Math.abs(clean.legs.reduce((v,l)=>v+l[key],0)-clean[key])>1e-5)throw Error('Inconsistent leg totals');
      for(let i=1;i<clean.legs.length;i++)if(clean.legs[i].path[0].some((v,k)=>Math.abs(v-clean.legs[i-1].path.at(-1)[k])>1e-8))throw Error('Discontinuous legs');
    }
    clean.stormExposed=Boolean(raw.stormExposed);return clean;
  }
  function comparison(raw,strategies){
    if(!raw)return undefined;
    if(!['none','typhoon','congestion'].includes(raw.event)||!Object.hasOwn(strategies,raw.sourcePlanId)||!window.MarineEnvironment.valid(raw.environment)||!Array.isArray(raw.plans)||raw.plans.length!==3)throw Error('Invalid comparison');
    return {event:raw.event,sourcePlanId:raw.sourcePlanId,environment:MarineEnvironment.clean(raw.environment),recommended:raw.recommended===null?null:Object.hasOwn(strategies,raw.recommended)?raw.recommended:null,plans:raw.plans.map(p=>plan(p,strategies))};
  }
  function restore(entry,{validResult,strategies}){
    const r=entry?.result;
    if(entry?.snapshotVersion!==2||!validResult(r)||!Number.isInteger(r.modelVersion)||r.modelVersion<7||!Number.isInteger(r.routeVersion)||!Object.hasOwn(strategies,r.planId)||!Object.hasOwn(strategies,r.sourcePlanId)||!['none','typhoon','congestion'].includes(r.event)||(r.recommended!==null&&!Object.hasOwn(strategies,r.recommended)))throw Error('Invalid archive');
    const alternatives={};for(const id of Object.keys(strategies)){if(r.alternatives?.[id]?.id!==id)throw Error('Incomplete archive');alternatives[id]=plan(r.alternatives[id],strategies);}
    const params=window.VoyageWorkflow.normalize(r.params);
    const result={id:r.id,time:r.time,savedAt:Number.isFinite(Date.parse(r.savedAt))?r.savedAt:r.time,modelVersion:r.modelVersion,routeVersion:r.routeVersion,params:{start:params.start,end:params.end,speed:params.speed,dwt:params.dwt,storm:params.storm,current:params.current,shipType:params.shipType,load:params.load,deadline:params.deadline,arrivalBasis:params.arrivalBasis,budget:params.budget},config:{fuel:r.config.fuel,carbon:r.config.carbon,hire:r.config.hire,delay:r.config.delay},environment:MarineEnvironment.clean(r.environment),event:r.event,sourcePlanId:r.sourcePlanId,recommended:r.recommended,planId:r.planId,alternatives,baseline:plan(r.baseline,strategies,true),context:null};
    if(r.event!=='none'){
      const c=r.context;
      if(!c||!['berthOpening','radiusNm'].every(k=>finite(c[k])&&c[k]>=0)||!Array.isArray(c.center)||c.center.length!==2||!c.center.every(finite))throw Error('Invalid event archive');
      result.context={before:plan(c.before,strategies),untreated:plan(c.untreated,strategies),berthOpening:c.berthOpening,radiusNm:c.radiusNm,center:[...c.center],recommended:r.recommended};
    }
    result.preference=['cost','carbon','time'].includes(r.preference)?r.preference:'cost';
    if(r.replan!==undefined){
      const q=r.replan;
      if(!q||!['elapsed','fuel','distance','cost'].every(k=>finite(q[k])&&q[k]>=0)||!Number.isInteger(q.count)||q.count<1||q.count>24||!Array.isArray(q.coords)||q.coords.length!==2||!q.coords.every(finite)||!Object.values(alternatives).every(p=>p.legs&&p.hours>=q.elapsed))throw Error('Invalid checkpoint');
      result.replan={elapsed:q.elapsed,fuel:q.fuel,distance:q.distance,cost:q.cost,count:q.count,coords:[...q.coords]};
    }
    result.optimized=alternatives[r.planId];result.saved={};
    for(const k of ['fuel','co2','cost','hours','distance'])result.saved[k]=result.baseline[k]-result.optimized[k];
    result.reduction=result.saved.co2/result.baseline.co2*100;
    result.effects={routeFuel:result.baseline.fuel-result.optimized.referenceFuel,speedFuel:result.optimized.referenceFuel-result.optimized.fuel};
    result.comparison=comparison(r.comparison,strategies);return result;
  }
  function pack(result){return {snapshotVersion:2,result:JSON.parse(JSON.stringify(result))};}
  window.VoyageArchive={pack,restore};
})();
