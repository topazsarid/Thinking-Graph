import {useEffect,useRef} from 'react';

// Petals move between scattered flowers and a pair of beating wings.
// This is decorative canvas drawing; it never handles pointer events.
export default function FlowerBirds({color,speed=1,density=1}:{color:string;speed?:number;density?:number}){
 const canvas=useRef<HTMLCanvasElement>(null),colorRef=useRef(color);
 colorRef.current=color;
 useEffect(()=>{
   const element=canvas.current!,ctx=element.getContext('2d');if(!ctx)return;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   let width=0,height=0,frame=0,last=0,time=0;
   let scrollDistance=0,previousScroll=window.scrollY,lastBirth=-1000,sequence=0;
   let newcomers:{born:number;x:number;y:number;seed:number}[]=[];
   function onScroll(){
     const next=window.scrollY;
     scrollDistance+=Math.abs(next-previousScroll);previousScroll=next;
     if(document.hidden||scrollDistance<100||time-lastBirth<700)return;
     scrollDistance=0;lastBirth=time;
     // Viewport-relative birth positions never depend on the document scroll offset.
     sequence++;
     newcomers.push({born:time,x:.2+(sequence*.381966%1)*.6,y:.2+(sequence*.618034%1)*.6,seed:sequence+10});
     newcomers=newcomers.slice(-6);
     if(reduced.matches){lastBirth=-1000;draw();}
   }
   function resize(){width=innerWidth;height=innerHeight;const scale=Math.min(devicePixelRatio||1,2);element.width=width*scale;element.height=height*scale;ctx!.setTransform(scale,0,0,scale,0,0);draw();}
   function draw(){
     ctx!.clearRect(0,0,width,height);
     newcomers=newcomers.filter(b=>time-b.born<28000);
     const flock=[...Array.from({length:Math.max(2,Math.round(5*density))},(_,seed)=>({seed,born:-1,x:0,y:0})),...newcomers];
     for(const entry of flock){
       const bird=entry.seed,age=time-entry.born,isNew=entry.born>=0;
       const fade=isNew?Math.min(1,age/1400,Math.max(0,(28000-age)/3000)):1;
       const phase=isNew?Math.min(age/16000,1):(time/14000+bird*.19)%1;
       const formation=reduced.matches?.85:Math.pow(Math.sin(phase*Math.PI),2);
       const cx=isNew?entry.x*width+Math.sin(age/6500)*65:((bird*.23+time/85000)%1)*(width+260)-130;
       const cy=isNew?entry.y*height-Math.sin(age/8500)*45:height*(.16+(bird*.14)%.7)+Math.sin(time/3500+bird)*32;
       for(let petal=0;petal<66;petal++){
         const side=petal%2?1:-1,u=Math.floor(petal/2)/32;
         const wingX=side*u*115;
         const wingY=-Math.sin(u*Math.PI*.85)*65*(.65+Math.sin(time/650+bird)*.35)+u*14;
         const flower=Math.floor(petal/6),angle=(petal%6)*Math.PI/3;
         const scatteredX=Math.sin(flower*2.4+bird)*145+Math.cos(angle)*10;
         const scatteredY=Math.cos(flower*1.7+bird)*100+Math.sin(angle)*10;
         const x=cx+scatteredX*(1-formation)+wingX*formation;
         const y=cy+scatteredY*(1-formation)+wingY*formation;
         ctx!.save();ctx!.translate(x,y);ctx!.rotate(angle+formation*side*u+time/11000);
         ctx!.globalAlpha=(.22+formation*.24)*(reduced.matches?1:fade);
         ctx!.fillStyle=petal%4===0?'#df9c52':colorRef.current;
         ctx!.beginPath();ctx!.ellipse(0,0,3+u*2,7,0,0,Math.PI*2);ctx!.fill();ctx!.restore();
       }
     }
   }
   function tick(now:number){if(last)time+=Math.min(now-last,60)*speed;last=now;draw();frame=requestAnimationFrame(tick);}
   function update(){cancelAnimationFrame(frame);last=0;if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);else draw();}
   const observer=new MutationObserver(()=>{if(reduced.matches)draw();});observer.observe(document.documentElement,{attributes:true,attributeFilter:['style']});
   window.addEventListener('scroll',onScroll,{passive:true});
   resize();update();window.addEventListener('resize',resize);document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);
   return()=>{observer.disconnect();window.removeEventListener('scroll',onScroll);cancelAnimationFrame(frame);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',update);reduced.removeEventListener('change',update);};
 },[speed,density]);
 return <canvas ref={canvas} className="flower-birds" aria-hidden="true"/>;
}
