let pCtx,fCtx,pCanvas,fCanvas,series=[];
const COLORS={ pv:'#E69F00', wind:'#D55E00', load:'#374151', diesel:'#0072B2', bess:'#009E73', freq:'#6A3D9A' };

export function mount(){
  pCanvas = document.getElementById('pPlot'); fCanvas=document.getElementById('fPlot');
  pCtx=pCanvas.getContext('2d'); fCtx=fCanvas.getContext('2d');
}
function line(ctx,xs,ys,color, dashed=false, w=2.2){
  ctx.beginPath(); dashed?ctx.setLineDash([6,6]):ctx.setLineDash([]);
  xs.forEach((x,i)=> i?ctx.lineTo(x,ys[i]):ctx.moveTo(x,ys[i]));
  ctx.strokeStyle=color; ctx.lineWidth=w; ctx.stroke(); ctx.setLineDash([]);
}

export function draw(snapshot, windowHours=4){
  series.push(snapshot);
  const DPR=window.devicePixelRatio||1;
  const t = snapshot.t, t0 = Math.max(0, t - windowHours*3600), t1 = t;

  // Power
  const w=pCanvas.width=Math.floor(pCanvas.clientWidth*DPR);
  const h=pCanvas.height=Math.floor(pCanvas.clientHeight*DPR);
  const seg=series.filter(d=>d.t>=t0&&d.t<=t1); if(seg.length<2) return;
  const xs=seg.map(d=>((d.t-t0)/(t1-t0))*(w-60)+40);
  const allP=seg.flatMap(d=>[d.Ppv,d.Pwind,d.Pload,d.Pdg,d.Pb]);
  const pmin=Math.min(0,...allP), pmax=Math.max(...allP,1);
  const y=v=>(1-(v-pmin)/(pmax-pmin||1))*(h-36)+18;
  pCtx.clearRect(0,0,w,h); pCtx.strokeStyle='#f3f4f6';
  for(let i=0;i<5;i++){const yy=(i/4)*(h-36)+18; pCtx.beginPath(); pCtx.moveTo(40,yy); pCtx.lineTo(w-12,yy); pCtx.stroke();}
  const map=k=>seg.map(d=>y(d[k]));
  line(pCtx,xs,map('Ppv'),COLORS.pv);
  line(pCtx,xs,map('Pwind'),COLORS.wind,true);
  line(pCtx,xs,map('Pload'),COLORS.load);
  line(pCtx,xs,map('Pdg'),COLORS.diesel);
  line(pCtx,xs,map('Pb'),COLORS.bess);

  // Freq/SOC
  const wf=fCanvas.width=Math.floor(fCanvas.clientWidth*DPR);
  const hf=fCanvas.height=Math.floor(fCanvas.clientHeight*DPR);
  const fVals=seg.map(d=>d.f), sVals=seg.map(d=>d.soc), f0=60;
  let fmin=Math.min(...fVals,f0-0.8), fmax=Math.max(...fVals,f0+0.8);
  const yF=v=>(1-(v-fmin)/(fmax-fmin||1))*(hf-36)+18; const yS=v=>(1-(v-0)/100)*(hf-36)+18;
  fCtx.clearRect(0,0,wf,hf); fCtx.strokeStyle='#f3f4f6';
  for(let i=0;i<5;i++){const yy=(i/4)*(hf-36)+18; fCtx.beginPath(); fCtx.moveTo(40,yy); fCtx.lineTo(wf-12,yy); fCtx.stroke();}
  line(fCtx,xs,fVals.map(yF),COLORS.freq);
  line(fCtx,xs,sVals.map(yS),'#009E73',true);
}
