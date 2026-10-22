/* Offline map interaction and voyage playback. No external dependencies. */
(() => {
  'use strict';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  class MapView {
    constructor(svg,viewport,onChange){
      this.svg=svg;this.viewport=viewport;this.onChange=onChange;this.x=0;this.y=0;this.scale=1;this.pointers=new Map();this.suppressUntil=0;
      svg.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.exp(-clamp(e.deltaY,-80,80)*.003),this.point(e));},{passive:false});
      svg.addEventListener('dblclick',e=>{e.preventDefault();this.zoom(1.6,this.point(e));});
      svg.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;this.suppressUntil=0;this.pointers.set(e.pointerId,this.point(e));this.dragStart=[e.clientX,e.clientY];this.moved=false;if(!e.target.closest('.waypoint,.vessel'))svg.setPointerCapture(e.pointerId);});
      svg.addEventListener('pointermove',e=>{
        if(!this.pointers.has(e.pointerId))return;
        const previous=[...this.pointers.values()],old=this.pointers.get(e.pointerId),next=this.point(e);
        this.pointers.set(e.pointerId,next);
        if(Math.hypot(e.clientX-this.dragStart[0],e.clientY-this.dragStart[1])>4)this.moved=true;
        if(this.pointers.size===2){const points=[...this.pointers.values()];const before=Math.hypot(previous[0][0]-previous[1][0],previous[0][1]-previous[1][1]);const after=Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]);if(before>0)this.zoom(after/before,[(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2]);}
        else{this.x+=next[0]-old[0];this.y+=next[1]-old[1];this.render();}
      });
      const end=e=>{this.pointers.delete(e.pointerId);if(this.moved)this.suppressUntil=performance.now()+150;};
      svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
      svg.addEventListener('click',e=>{if(performance.now()<this.suppressUntil){e.stopImmediatePropagation();e.preventDefault();}},true);
      svg.addEventListener('keydown',e=>{if(e.target!==svg)return;if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='+'||e.key==='=')this.zoom(1.4);else if(e.key==='-')this.zoom(1/1.4);else if(e.key==='Home')this.reset();else{this.x+=e.key==='ArrowLeft'?45:e.key==='ArrowRight'?-45:0;this.y+=e.key==='ArrowUp'?45:e.key==='ArrowDown'?-45:0;this.render();}}});
      this.bounds={x:0,y:0,width:900,height:590};
      this.resize();
      this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(svg);
    }
    point(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(this.svg.getScreenCTM().inverse());return[p.x,p.y];}
    resize(){
      const {width,height}=this.svg.getBoundingClientRect();if(!width||!height)return;
      // Extend the geographic viewport instead of stretching or letterboxing the map.
      const ratio=width/height,w=Math.max(900,590*ratio),h=Math.max(590,900/ratio);
      this.bounds={x:450-w/2,y:295-h/2,width:w,height:h};
      this.svg.setAttribute('viewBox',`${this.bounds.x} ${this.bounds.y} ${w} ${h}`);
      for(const rect of this.svg.querySelectorAll(':scope > rect,#map-clip rect'))for(const [key,value] of Object.entries(this.bounds))rect.setAttribute(key,value);
      this.render();
    }
    zoom(factor,anchor=[450,295]){const next=clamp(this.scale*factor,1,8),ratio=next/this.scale;this.x=anchor[0]-(anchor[0]-this.x)*ratio;this.y=anchor[1]-(anchor[1]-this.y)*ratio;this.scale=next;this.render();}
    reset(){this.x=this.y=0;this.scale=1;this.render();}
    fit(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);this.scale=clamp(Math.min(this.bounds.width*.72/Math.max(1,maxX-minX),this.bounds.height*.68/Math.max(1,maxY-minY)),1,8);this.x=450-(minX+maxX)/2*this.scale;this.y=295-(minY+maxY)/2*this.scale;this.render();}
    render(){const b=this.bounds;this.x=clamp(this.x,(b.x+b.width)*(1-this.scale),b.x*(1-this.scale));this.y=clamp(this.y,(b.y+b.height)*(1-this.scale),b.y*(1-this.scale));this.viewport.setAttribute('transform',`translate(${this.x} ${this.y}) scale(${this.scale})`);this.viewport.style.setProperty('--map-scale',this.scale);this.onChange?.(this.scale);}
  }
  // A leg keeps its original rates. Replanning never rewrites completed fuel/time.
  const joinPaths=legs=>legs.flatMap((leg,i)=>i?leg.path.slice(1):leg.path);
  function legState(leg,elapsed,distance){
    elapsed=clamp(elapsed,0,leg.hours);
    const fraction=leg.sailingHours>0?Math.min(1,elapsed/leg.sailingHours):1;
    const cumulative=[0];for(let i=1;i<leg.path.length;i++)cumulative.push(cumulative.at(-1)+distance(leg.path[i-1],leg.path[i]));
    const target=cumulative.at(-1)*fraction;let i=1;while(i<cumulative.length-1&&cumulative[i]<target)i++;
    const a=leg.path[i-1],b=leg.path[i],length=cumulative[i]-cumulative[i-1],t=length?(target-cumulative[i-1])/length:0;
    const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)),y=merc(a[1])+(merc(b[1])-merc(a[1]))*t;
    const coords=fraction===1?[...leg.path.at(-1)]:fraction===0?[...leg.path[0]]:[a[0]+(b[0]-a[0])*t,(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI];
    const sailingHours=Math.min(elapsed,leg.sailingHours),waitingHours=Math.max(0,elapsed-leg.sailingHours);
    const sailingFuel=leg.sailingFuel*fraction,waitingFuel=waitingHours*leg.idleBurn;
    return {coords,index:i,heading:Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI,distance:leg.distance*fraction,elapsed,sailingHours,waitingHours,sailingFuel,waitingFuel,fuel:sailingFuel+waitingFuel,waiting:fraction>=1&&elapsed<leg.hours,path:leg.path.slice(0,i).concat([coords]),remainingPath:[coords,...leg.path.slice(i)]};
  }
  function planState(plan,elapsed,distance){
    elapsed=clamp(elapsed,0,plan.hours);const legs=plan.legs||[plan],completed=[];let rest=elapsed;
    for(let n=0;n<legs.length;n++){
      const leg=legs[n];
      if(rest>=leg.hours&&n<legs.length-1){completed.push(leg);rest-=leg.hours;continue;}
      const state=legState(leg,rest,distance),sum=k=>completed.reduce((v,l)=>v+l[k],0);
      return {...state,elapsed,distance:sum('distance')+state.distance,sailingHours:sum('sailingHours')+state.sailingHours,waitingHours:sum('waitingHours')+state.waitingHours,sailingFuel:sum('sailingFuel')+state.sailingFuel,waitingFuel:sum('waitingFuel')+state.waitingFuel,fuel:sum('fuel')+state.fuel,co2:(sum('fuel')+state.fuel)*3.114,remaining:plan.hours-elapsed,path:joinPaths([...completed,{path:state.path}]),remainingPath:joinPaths([{path:state.remainingPath},...legs.slice(n+1)]),completed:[...completed,...(rest>0?[{...leg,path:state.path,hours:rest,distance:state.distance,sailingHours:state.sailingHours,waitingHours:state.waitingHours,sailingFuel:state.sailingFuel,waitingFuel:state.waitingFuel,fuel:state.fuel}]:[])]};
    }
  }
  class Replay {
    constructor({distance,onUpdate}){this.distance=distance;this.onUpdate=onUpdate;this.progress=0;this.playing=false;this.rate=1;this.frame=null;this.last=0;this.plan=null;}
    load(plan,time){this.pause(false);this.plan=plan;this.departure=new Date(time).getTime();this.cumulative=[0];for(let i=1;i<plan.path.length;i++)this.cumulative.push(this.cumulative.at(-1)+this.distance(plan.path[i-1],plan.path[i]));this.progress=0;this.emit();}
    setRate(value){this.rate=clamp(Number(value)||1,1,30);this.emit();}
    seek(fraction){this.progress=clamp(Number(fraction)||0,0,1);if(this.progress>=1)this.pause(false);this.last=performance.now();this.emit();}
    play(){if(!this.plan)return;if(this.progress>=1)this.progress=0;this.playing=true;this.last=performance.now();cancelAnimationFrame(this.frame);this.emit();this.frame=requestAnimationFrame(now=>this.tick(now));}
    pause(emit=true){this.playing=false;cancelAnimationFrame(this.frame);this.frame=null;if(emit)this.emit();}
    tick(now){if(!this.playing)return;const seconds=Math.max(0,(now-this.last)/1000);this.last=now;this.progress=Math.min(1,this.progress+seconds*this.rate/90);if(this.progress>=1)this.playing=false;this.emit();if(this.playing)this.frame=requestAnimationFrame(t=>this.tick(t));}
    state(){
      if(!this.plan)return null;
      return {...planState(this.plan,this.plan.hours*this.progress,this.distance),progress:this.progress,playing:this.playing,rate:this.rate,eta:this.departure+this.plan.hours*3600000};
    }
    emit(){const state=this.state();if(state)this.onUpdate(state);}
  }
  window.VoyageExperience={MapView,Replay,planState,joinPaths};
})();
