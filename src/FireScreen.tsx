import {useEffect,useRef} from 'react';

export default function FireScreen({color,speed=1,density=1}:{color?:string;speed?:number;density?:number}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const element=canvas.current!,ctx=element.getContext('2d');if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,time=0,last=0,frame=0;
  function draw(){
   ctx!.clearRect(0,0,width,height);
   ctx!.fillStyle='rgba(35,12,6,.3)';ctx!.fillRect(0,0,width,height);
   const glow=ctx!.createLinearGradient(0,height,0,0);
   glow.addColorStop(0,'rgba(255,75,5,.38)');glow.addColorStop(.4,'rgba(255,130,20,.12)');glow.addColorStop(1,'rgba(255,140,20,0)');
   ctx!.fillStyle=glow;ctx!.fillRect(0,0,width,height);
   const tint=color?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(','):null;
   // Paint distant fire first, then the brighter, larger foreground fire.
   const rows=[
    {spacing:95,size:.65,alpha:.36,speed:3100,offset:.4,base:.48},
    {spacing:75,size:.74,alpha:.52,speed:2400,offset:1.8,base:.78},
    {spacing:65,size:.95,alpha:.88,speed:1800,offset:3.2,base:1.04},
   ];
   for(const row of rows){
    const count=Math.max(8,Math.ceil(width/row.spacing*density));
    ctx!.save();ctx!.globalAlpha=row.alpha;
    for(let i=0;i<count;i++){
     const x=width*(i+.22*Math.sin(row.offset))/(count-1),base=height*row.base+30;
     const length=height*row.size*(.65+.35*(.5+.5*Math.sin(i*2.71+time/row.speed+row.offset)));
     const sway=Math.sin(time/(row.speed*.43)+i*1.7+row.offset)*28;
     for(let layer=0;layer<3;layer++){
      const span=(row.spacing*.72+Math.sin(i+row.offset)*14)*(1-layer*.23),tip=base-length*(1-layer*.22);
      const gradient=ctx!.createLinearGradient(0,base,0,tip);
      gradient.addColorStop(0,tint?`rgba(${tint},.9)`:layer===2?'rgba(255,244,175,.95)':'rgba(255,125,12,.85)');
      gradient.addColorStop(.65,tint?`rgba(${tint},.65)`:layer===2?'rgba(255,194,67,.75)':'rgba(243,61,12,.65)');
      gradient.addColorStop(1,tint?`rgba(${tint},0)`:'rgba(255,77,5,0)');
      ctx!.fillStyle=gradient;ctx!.beginPath();ctx!.moveTo(x-span,base);
      ctx!.bezierCurveTo(x-span*1.2,base-length*.45,x+sway+span,tip+length*.24,x+sway,tip);
      ctx!.bezierCurveTo(x+sway-span*.2,tip+length*.38,x+span,base-length*.3,x+span,base);
      ctx!.closePath();ctx!.fill();
     }
    }
    ctx!.restore();
   }
   for(let i=0;i<Math.round(48*density);i++){
    const phase=(time/6500+i*.137)%1;
    const x=((i*.618%1)*width)+Math.sin(time/1400+i)*24,y=height-phase*height*.86;
    ctx!.globalAlpha=(1-phase)*.7;ctx!.fillStyle=color||(i%3?'#ff9d32':'#ffdc91');
    ctx!.beginPath();ctx!.ellipse(x,y,1.2,2.8,phase,0,Math.PI*2);ctx!.fill();
   }
   ctx!.globalAlpha=1;
  }
  function resize(){width=innerWidth;height=innerHeight;const ratio=Math.min(devicePixelRatio||1,2);element.width=width*ratio;element.height=height*ratio;ctx!.setTransform(ratio,0,0,ratio,0,0);draw();}
  function tick(now:number){if(last)time+=Math.min(now-last,60)*speed;last=now;draw();frame=requestAnimationFrame(tick);}
  function resume(){cancelAnimationFrame(frame);last=0;draw();if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);}
  resize();resume();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',resume);reduced.addEventListener('change',resume);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resume);reduced.removeEventListener('change',resume);};
 },[color,speed,density]);
 return <canvas ref={canvas} className="fire-screen" aria-hidden="true"/>;
}
