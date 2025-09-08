// modules/plots.js
// 轻量 Canvas 绘图；基于“索引等距”的 X 轴，避免依赖 t 单位导致直线

function $(sel){ return document.querySelector(sel); }

function makeCanvas(id){
  const el = $(id);
  if(!el) return null;
  // 处理 DPR，保证清晰
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = el.clientWidth || 600;
  const cssH = el.clientHeight || 300;
  if (el.width !== Math.floor(cssW * dpr) || el.height !== Math.floor(cssH * dpr)){
    el.width  = Math.floor(cssW * dpr);
    el.height = Math.floor(cssH * dpr);
  }
  const ctx = el.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return { el, ctx, w: cssW, h: cssH, dpr };
}

function drawAxes(ctx, w, h, y0Label){
  ctx.save();
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  // 边框
  ctx.strokeRect(8,8,w-16,h-16);
  // 零/基线（虚线）
  ctx.setLineDash([4,4]);
  ctx.beginPath();
  ctx.moveTo(12, h-24);
  ctx.lineTo(w-12, h-24);
  ctx.stroke();
  ctx.setLineDash([]);
  // label
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px ui-sans-serif, system-ui';
  if (y0Label) ctx.fillText(y0Label, 14, h-28);
  ctx.restore();
}

function poly(ctx, xs, ys){
  ctx.beginPath();
  for(let i=0;i<xs.length;i++){
    const x=xs[i], y=ys[i];
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
}

function legend(ctx, items, x, y){
  ctx.save();
  ctx.font = '12px ui-sans-serif, system-ui';
  let cx = x, cy = y;
  items.forEach(({name, color})=>{
    ctx.fillStyle = color; ctx.fillRect(cx, cy-8, 18, 3);
    ctx.fillStyle = '#111'; ctx.fillText(name, cx+24, cy-4);
    cx += ctx.measureText(name).width + 80;
  });
  ctx.restore();
}

function computeMinMax(arr){
  let lo = +Infinity, hi = -Infinity;
  for (const v of arr){ if(v<lo) lo=v; if(v>hi) hi=v; }
  if (lo===+Infinity) lo=0, hi=1;
  if (hi===lo){ hi = lo + (Math.abs(lo) || 1); }
  // padding
  const pad = 0.08 * (hi-lo);
  return { lo: lo-pad, hi: hi+pad };
}

export function initPlots(){
  // 仅做一次尺寸初始化，让 first paint 不空白
  makeCanvas('#plot-power');
  makeCanvas('#plot-energy');
}

export function updatePlots(state){
  const s = Array.isArray(state?.samples) ? state.samples : [];
  if (s.length < 2){
    const c1 = makeCanvas('#plot-power');
    const c2 = makeCanvas('#plot-energy');
    if(c1){ c1.ctx.clearRect(0,0,c1.w,c1.h); drawAxes(c1.ctx,c1.w,c1.h,''); }
    if(c2){ c2.ctx.clearRect(0,0,c2.w,c2.h); drawAxes(c2.ctx,c2.w,c2.h,''); }
    return;
  }

  // 只取窗口内的点（最多近 N 点）
  const N = 600;
  const win = s.length > N ? s.slice(-N) : s;

  // === 图1：功率 ===
  {
    const C = makeCanvas('#plot-power'); if(!C) return;
    const {ctx,w,h} = C; ctx.clearRect(0,0,w,h);
    drawAxes(ctx,w,h,'baseline');

    const padL=20,padR=12,padT=14,padB=26;
    const innerW = w-padL-padR, innerH = h-padT-padB;

    // X：按索引均匀
    const xs = win.map((_,i)=> padL + i*(innerW/(win.length-1)));

    // Y：各条曲线独立缩放，避免“直线”
    const series = [
      { key:'pv',    name:'PV',     color:'#f59e0b' },
      { key:'wind',  name:'Wind',   color:'#22c55e' },
      { key:'load',  name:'Load',   color:'#3b82f6' },
      { key:'diesel',name:'Diesel', color:'#1f2937' },
      { key:'bess',  name:'BESS (+dis/−ch)', color:'#8b5cf6' },
    ];

    // 先画网格
    ctx.save();
    ctx.strokeStyle = '#f3f4f6'; ctx.lineWidth = 1;
    ctx.setLineDash([3,3]);
    for(let k=1;k<=4;k++){
      const y = padT + k*(innerH/5);
      ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke();
    }
    ctx.restore();

    series.forEach(sr=>{
      const arr = win.map(r=> +r[sr.key] || 0);
      const {lo,hi} = computeMinMax(arr);
      const ys = arr.map(v => padT + (1 - (v-lo)/(hi-lo)) * innerH );
      ctx.save();
      ctx.strokeStyle = sr.color;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.95;
      poly(ctx, xs, ys);
      ctx.restore();
    });

    legend(ctx, series.map(({name,color})=>({name,color})), padL, padT+14);
  }

  // === 图2：频率 & SOC ===
  {
    const C = makeCanvas('#plot-energy'); if(!C) return;
    const {ctx,w,h} = C; ctx.clearRect(0,0,w,h);
    drawAxes(ctx,w,h,'f₀ / SOC baseline');

    const padL=20,padR=12,padT=14,padB=26;
    const innerW = w-padL-padR, innerH = h-padT-padB;
    const xs = win.map((_,i)=> padL + i*(innerW/(win.length-1)));

    // 频率
    const fArr = win.map(r=> +r.f || 60);
    const {lo:fLo, hi:fHi} = computeMinMax(fArr);
    const fYs = fArr.map(v=> padT + (1 - (v-fLo)/(fHi-fLo)) * innerH);

    // SOC（0~100 直接映射）
    const socArr = win.map(r=> +r.soc || 0);
    const {lo:sLo, hi:sHi} = computeMinMax(socArr);
    const socYs = socArr.map(v=> padT + (1 - (v-sLo)/(sHi-sLo)) * innerH);

    ctx.save();
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.8; poly(ctx,xs,fYs); ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.4; poly(ctx,xs,socYs); ctx.restore();

    legend(ctx, [
      {name:'Freq', color:'#10b981'},
      {name:'SOC',  color:'#a855f7'},
      {name:'f₀=60 Hz baseline', color:'#9ca3af'}
    ], padL, padT+14);

    // 频率基线（f0≈60）
    ctx.save(); ctx.setLineDash([4,4]); ctx.strokeStyle = '#9ca3af';
    const f0y = padT + (1 - (60 - fLo)/(fHi - fLo)) * innerH;
    ctx.beginPath(); ctx.moveTo(padL, f0y); ctx.lineTo(w-padR, f0y); ctx.stroke();
    ctx.restore();
  }
}
