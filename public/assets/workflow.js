/* Ship coefficients are illustrative assumptions, not calibrated vessel specifications. */
(() => {
  'use strict';
  const ships={bulk:{name:'散货船',factor:1,description:'通用散货运输 · 参考油耗系数 1.00'},container:{name:'集装箱船',factor:1.2,description:'班轮运输 · 参考油耗系数 1.20'},tanker:{name:'油轮',factor:1.1,description:'液货运输 · 参考油耗系数 1.10'}};
  function normalize(p){return {...p,shipType:p.shipType===undefined?'bulk':p.shipType,load:p.load===undefined?100:p.load,deadline:p.deadline===undefined?null:p.deadline,arrivalBasis:p.arrivalBasis===undefined?'port':p.arrivalBasis,budget:p.budget===undefined?null:p.budget};}
  const number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  function valid(raw){const p=normalize(raw);return Object.hasOwn(ships,p.shipType)&&number(p.load,10,100)&&(p.deadline===null||number(p.deadline,1,1000))&&['port','berth'].includes(p.arrivalBasis)&&(p.budget===null||number(p.budget,1,10000000));}
  function burnFactor(p){return ships[p.shipType].factor*(.55+.45*p.load/100);}
  function assess(plan,p,event){
    const arrival=p.arrivalBasis==='berth'?plan.hours:plan.sailingHours;
    const late=p.deadline===null?0:Math.max(0,arrival-p.deadline);
    const over=p.budget===null?0:Math.max(0,plan.cost-p.budget);
    const wind=event==='typhoon'&&plan.clearance<10;
    return {arrival,late,over,wind,feasible:late<=1e-8&&over<=1e-6&&!wind};
  }
  function choose(plans,p,event){
    for(const plan of Object.values(plans))plan.requirements=assess(plan,p,event);
    return Object.values(plans).filter(plan=>plan.requirements.feasible).sort((a,b)=>a.cost-b.cost||a.hours-b.hours)[0]?.id||null;
  }
  window.VoyageWorkflow={ships,normalize,valid,burnFactor,assess,choose};
})();
