// modules/plots.js
// 负责把私库 step() 的快照画到两个 <canvas>

let P, E;        // canvas ctx
let cP, cE;      // canvas node
let inited = false;

function acquireCanvas(id) {
  const el = document.getElementById(id);
  if (!el) return { el:null, ctx:null };
  // 适配 HiDPI
  const dpr = window.devicePixelRatio || 1;
  el.width  = Math.max(300, el.clientWidth  * dpr);
  el.height = Math.max(200, el.clientHeight * dpr);
  const ctx = el.getContext('2d');
  return { el, ctx };
}

export function initPlots() {
  ({ el: cP, ctx: P } = acquireCanvas('plot-power'));
  ({ el: cE, ctx: E } = acquireCanvas('plot-energy'));
  inited = !!(P && E);
  if (!inited) {
    console.warn('plots: canvas not ready');
  }
  window.addEventListener('resize', () => {
    if (!cP || !cE) return;
    initPlots(); // 重新尺寸
  }, { passive:true });
}

export function setIdle(idle = true) {
  if (!inited) initPlots();
  if (!P || !E) return;

  const paint = (ctx, label) => {
    const { width:w, height:h } = ctx.canvas;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#e5e7eb';
    ctx.setLineDash([6,6]);
    ctx.strokeRect(8,8,w-16,h-16);
    ctx.setLineDash([]);
    ctx.fillStyle = '#6b7280';
    ctx.font = `${12*(window.devicePixelRatio||1)}px sans-serif`;
    ctx.fillText(idle? 'Press Start' : label, 16, 24);
  };

  paint(P, 'Power (kW) · live');
  paint(E, 'Energy / Fuel / SOC · live');
}

function line(ctx, xs, ys, style) {
  ctx.beginPath();
  for (let i=0;i<xs.length;i++) (i?ctx.lineTo(xs[i],ys[i]):ctx.moveTo(xs[i],ys[i]));
  ctx.strokeStyle = style || '#111';
  ctx.lineWidth = 2;
  ctx.stroke();
}

const q = []; // 最近窗口的样条缓冲
const maxPoints = 600;

export function updatePlots(snap) {
  if (!inited) initPlots();
  if (!P || !E || !snap) return;

  // 累积窗口（等距采样）
  q.push({
    t: snap.t_s || 0,
    Ppv: snap.kW?.pv || 0,
    Pw:  snap.kW?.wind || 0,
    Pd:  snap.kW?.diesel || 0,
    Pb:  snap.kW?.bess || 0,
    PL:  snap.kW?.load || 0,
    fuel: snap.fuel?.cum_l || 0,
    soc:  (snap.bess?.soc ?? 0)*100
  });
  if (q.length > maxPoints) q.shift();

  // ---- Power canvas
  {
    const { width:w, height:h } = P.canvas;
    P.clearRect(0,0,w,h);

    const xs = q.map((_,i)=> 12 + (i/(q.length-1||1))*(w-24));
    const allP = q.flatMap(d => [d.Ppv, d.Pw, d.Pd, d.Pb, d.PL]);
    const mn = Math.min(0, ...allP), mx = Math.max(1, ...allP);
    const y = v => (1-(v-mn)/(mx-mn||1))*(h-30)+15;

    // grid
    P.strokeStyle = '#eef2f7'; P.lineWidth=1;
    for (let i=0;i<5;i++){ const yy=15 + i*((h-30)/4); P.beginPath(); P.moveTo(10,yy); P.lineTo(w-10,yy); P.stroke(); }

    line(P, xs, q.map(d=>y(d.PL)), '#374151'); // Load
    line(P, xs, q.map(d=>y(d.Ppv)), '#E69F00'); // PV
    line(P, xs, q.map(d=>y(d.Pw )), '#D55E00'); // Wind
    line(P, xs, q.map(d=>y(d.Pd )), '#0072B2'); // Diesel
    line(P, xs, q.map(d=>y(d.Pb )), '#009E73'); // BESS
  }

  // ---- Energy / SOC canvas
  {
    const { width:w, height:h } = E.canvas;
    E.clearRect(0,0,w,h);

    const xs = q.map((_,i)=> 12 + (i/(q.length-1||1))*(w-24));
    const socMin = 0, socMax = 100;
    const ySoc = v => (1-(v-socMin)/(socMax-socMin||1))*(h-30)+15;

    // grid
    E.strokeStyle = '#eef2f7'; E.lineWidth=1;
    for (let i=0;i<5;i++){ const yy=15 + i*((h-30)/4); E.beginPath(); E.moveTo(10,yy); E.lineTo(w-10,yy); E.stroke(); }

    line(E, xs, q.map(d=>ySoc(d.soc)), '#6A3D9A');

    // fuel cumulative（次轴简单归一）
    const fmn = Math.min(...q.map(d=>d.fuel)), fmx = Math.max(...q.map(d=>d.fuel), 1);
    const yFuel = v => (1-(v-fmn)/(fmx-fmn||1))*(h-30)+15;
    E.setLineDash([6,6]);
    line(E, xs, q.map(d=>yFuel(d.fuel)), '#9CA3AF');
    E.setLineDash([]);
  }
}
