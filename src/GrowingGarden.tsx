import {useEffect,useRef} from 'react';

// Repeating growth, full bloom, and gentle fade; reduced motion stays static.
export default function GrowingGarden({color,speed=1,density=1}:{color:string;speed?:number;density?:number}){
 const canvas=useRef<HTMLCanvasElement>(null),colorRef=useRef(color);
 colorRef.current=color;
 useEffect(()=>{
  const element=canvas.current!,ctx=element.getContext('2d');if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,elapsed=0,last=0,frame=0;
  const duration=9000+Math.round(36*density)*220+1000,hold=2000,fade=2500;
  const cycle=duration+hold+fade;
  const clamp=(n:number)=>Math.max(0,Math.min(1,n));
  function draw(){
   ctx!.clearRect(0,0,width,height);
   const time=reduced.matches?duration:elapsed%cycle;
   const opacity=reduced.matches?1:1-clamp((time-duration-hold)/fade);
   ctx!.save();ctx!.globalAlpha=opacity;
   for(let i=0;i<Math.round(36*density);i++){
    const progress=clamp((time-i*220)/9000);
    if(!progress)continue;
    const x=(i*.61803398875%1)*width;
    const length=height*(.25+(i*17%29)/40);
    const direction=i%2?1:-1;
    const bend=direction*(30+i%5*12);
    const point=(t:number)=>({x:x+Math.sin(t*2.2)*bend,y:height+15-length*t});
    ctx!.strokeStyle='rgba(63,112,83,.55)';ctx!.lineWidth=1.5+i%3*.6;ctx!.lineCap='round';
    ctx!.beginPath();ctx!.moveTo(x,height+15);
    for(let step=1;step<=48;step++){const p=point(progress*step/48);ctx!.lineTo(p.x,p.y);}ctx!.stroke();
    for(let leaf=1;leaf<=5;leaf++){
     const at=leaf*.14,opening=clamp((progress-at)*5);if(!opening)continue;
     const p=point(at),side=leaf%2?1:-1;
     ctx!.save();ctx!.translate(p.x,p.y);ctx!.rotate(side*.8);
     ctx!.fillStyle='rgba(86,140,104,.32)';ctx!.beginPath();
     ctx!.ellipse(side*12*opening,-8*opening,18*opening,6*opening,-side*.4,0,Math.PI*2);ctx!.fill();ctx!.restore();
    }
    const bloom=clamp((progress-.8)*5);if(!bloom)continue;
    const tip=point(progress);
    ctx!.save();ctx!.translate(tip.x,tip.y);ctx!.fillStyle=colorRef.current;ctx!.globalAlpha=.55*opacity;
    for(let petal=0;petal<7;petal++){ctx!.rotate(Math.PI*2/7);ctx!.beginPath();ctx!.ellipse(0,-12*bloom,6*bloom,14*bloom,0,0,Math.PI*2);ctx!.fill();}
    ctx!.globalAlpha=.9*opacity;ctx!.fillStyle='#eac66a';ctx!.beginPath();ctx!.arc(0,0,5*bloom,0,Math.PI*2);ctx!.fill();ctx!.restore();
   }
   ctx!.restore();
  }
  function resize(){width=innerWidth;height=innerHeight;const ratio=Math.min(devicePixelRatio||1,2);element.width=width*ratio;element.height=height*ratio;ctx!.setTransform(ratio,0,0,ratio,0,0);draw();}
  function tick(now:number){if(last)elapsed=(elapsed+Math.min(now-last,80)*speed)%cycle;last=now;draw();frame=requestAnimationFrame(tick);}
  function resume(){cancelAnimationFrame(frame);last=0;draw();if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
  // Theme updates also repaint the static reduced-motion garden.
  const observer=new MutationObserver(draw);observer.observe(document.documentElement,{attributes:true,attributeFilter:['style']});
  resize();resume();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);};
 },[speed,density]);
 return <canvas ref={canvas} className="growing-garden" aria-hidden="true"/>;
}
