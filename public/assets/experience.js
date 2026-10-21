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
      this.render();
    }
    point(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(this.svg.getScreenCTM().inverse());return[p.x,p.y];}
    zoom(factor,anchor=[450,295]){const next=clamp(this.scale*factor,1,8),ratio=next/this.scale;this.x=anchor[0]-(anchor[0]-this.x)*ratio;this.y=anchor[1]-(anchor[1]-this.y)*ratio;this.scale=next;this.render();}
    reset(){this.x=this.y=0;this.scale=1;this.render();}
    fit(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);this.scale=clamp(Math.min(660/Math.max(1,maxX-minX),410/Math.max(1,maxY-minY)),1,8);this.x=450-(minX+maxX)/2*this.scale;this.y=310-(minY+maxY)/2*this.scale;this.render();}
    render(){this.x=clamp(this.x,900*(1-this.scale),0);this.y=clamp(this.y,590*(1-this.scale),0);this.viewport.setAttribute('transform',`translate(${this.x} ${this.y}) scale(${this.scale})`);this.viewport.style.setProperty('--map-scale',this.scale);this.onChange?.(this.scale);}
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
      const elapsed=this.plan.hours*this.progress,sailingHours=this.plan.sailingHours??this.plan.hours;
      const sailingProgress=Math.min(1,elapsed/sailingHours),waitingElapsed=Math.max(0,elapsed-sailingHours);
      const fuel=(this.plan.sailingFuel??this.plan.fuel)*sailingProgress+waitingElapsed*(this.plan.waitingHours?this.plan.idleBurn:0);
      const target=this.cumulative.at(-1)*sailingProgress;let lo=1,hi=this.cumulative.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(this.cumulative[mid]<target)lo=mid+1;else hi=mid;}
      const i=lo,a=this.plan.path[i-1],b=this.plan.path[i],length=this.cumulative[i]-this.cumulative[i-1],t=length>0?(target-this.cumulative[i-1])/length:0;
      const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));const y=merc(a[1])+(merc(b[1])-merc(a[1]))*t;
      const coords=[a[0]+(b[0]-a[0])*t,(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI];
      return{progress:this.progress,playing:this.playing,rate:this.rate,coords,index:i,heading:Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI,distance:this.plan.distance*sailingProgress,elapsed,remaining:this.plan.hours*(1-this.progress),fuel,co2:fuel*3.114,waiting:sailingProgress>=1&&this.progress<1,eta:this.departure+this.plan.hours*3600000,path:this.plan.path.slice(0,i).concat([coords])};
    }
    emit(){const state=this.state();if(state)this.onUpdate(state);}
  }
  window.VoyageExperience={MapView,Replay};
})();
