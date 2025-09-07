/* modules/plots.js — safe canvas mount & simple line drawing */

const DPR = window.devicePixelRatio || 1;

function ensureCanvas(container) {
  const el = (typeof container === 'string')
    ? document.querySelector(container)
    : container;

  if (!el) {
    console.warn('[plots] container not found:', container);
    return null;
  }

  // 清空容器并创建 canvas
  el.innerHTML = '';
  const cvs = document.createElement('canvas');
  cvs.style.width = '100%';
  cvs.style.height = '280px';
  cvs.width  = Math.max(320, el.clientWidth) * DPR;
  cvs.height = 280 * DPR;
  el.appendChild(cvs);

  const ctx = cvs.getContext('2d');
  if (!ctx) {
    console.warn('[plots] getContext failed');
    return null;
  }
  ctx.scale(DPR, DPR);
  return { el, cvs, ctx };
}

function drawGrid(ctx, w, h) {
  ctx.save();
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (h - 20) * (i / 4);
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 12, y); ctx.stroke();
  }
  ctx.restore();
}

function drawLine(ctx, xs, ys, color = '#111', dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) (i ? ctx.lineTo(xs[i], ys[i]) : ctx.moveTo(xs[i], ys[i]));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function mountPowerPlot(container) {
  const box = ensureCanvas(container);
  if (!box) return { ok:false, draw:()=>{} };

  const { ctx, cvs, el } = box;
  const W = cvs.width / DPR, H = cvs.height / DPR;

  function resize() {
    cvs.width  = Math.max(320, el.clientWidth) * DPR;
    cvs.height = 280 * DPR;
  }

  function draw(seg) {
    const w = cvs.width / DPR, h = cvs.height / DPR;
    ctx.clearRect(0, 0, w, h);
    if (!seg || seg.length < 2) return drawGrid(ctx, w, h);

    drawGrid(ctx, w, h);
    const t0 = seg[0].t, t1 = seg[seg.length - 1].t;
    const x = t => 40 + (w - 60) * ((t - t0) / Math.max(1e-6, t1 - t0));

    const all = seg.flatMap(d => [d.Ppv, d.Pwind, d.Pload, d.Pdg, d.Pb]);
    const ymin = Math.min(0, ...all), ymax = Math.max(1, ...all);
    const y = v => 10 + (h - 20) * (1 - (v - ymin) / Math.max(1e-6, ymax - ymin));

    const xs = seg.map(d => x(d.t));
    drawLine(ctx, xs, seg.map(d => y(d.Ppv)),   '#E69F00');             // PV
    drawLine(ctx, xs, seg.map(d => y(d.Pwind)), '#D55E00', [6,6]);      // Wind
    drawLine(ctx, xs, seg.map(d => y(d.Pload)), '#374151');             // Load
    drawLine(ctx, xs, seg.map(d => y(d.Pdg)),   '#0072B2');             // Diesel
    drawLine(ctx, xs, seg.map(d => y(d.Pb)),    '#009E73');             // BESS
  }

  window.addEventListener('resize', () => { resize(); draw([]); });
  return { ok:true, draw };
}

export function mountFreqPlot(container) {
  const box = ensureCanvas(container);
  if (!box) return { ok:false, draw:()=>{} };

  const { ctx, cvs, el } = box;

  function resize() {
    cvs.width  = Math.max(320, el.clientWidth) * DPR;
    cvs.height = 280 * DPR;
  }

  function draw(seg, f0 = 60) {
    const w = cvs.width / DPR, h = cvs.height / DPR;
    ctx.clearRect(0, 0, w, h);
    if (!seg || seg.length < 2) return drawGrid(ctx, w, h);

    drawGrid(ctx, w, h);
    const t0 = seg[0].t, t1 = seg[seg.length - 1].t;
    const x = t => 40 + (w - 60) * ((t - t0) / Math.max(1e-6, t1 - t0));

    const fv = seg.map(d => d.f);
    let fmin = Math.min(f0 - 0.8, ...fv), fmax = Math.max(f0 + 0.8, ...fv);
    if (!isFinite(fmin) || !isFinite(fmax) || (fmax - fmin) < 0.1) { fmin = f0 - 0.8; fmax = f0 + 0.8; }
    const yF = v => 10 + (h - 20) * (1 - (v - fmin) / Math.max(1e-6, fmax - fmin));

    const xs = seg.map(d => x(d.t));
    drawLine(ctx, xs, seg.map(d => yF(d.f)), '#6A3D9A'); // Freq

    // f0 baseline
    ctx.save();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(40, yF(f0)); ctx.lineTo(w - 12, yF(f0)); ctx.stroke();
    ctx.restore();
  }

  window.addEventListener('resize', () => { resize(); draw([]); });
  return { ok:true, draw };
}
