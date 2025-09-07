/* modules/plots.js */
let cvsPower, ctxPower, cvsEnergy, ctxEnergy;
const MAX_POINTS = 1800; // 30min @ 1s

function makeCanvas(selector) {
  const c = document.querySelector(selector);
  const ctx = c.getContext("2d");
  // 物理像素提高清晰度
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  c.width = Math.max(600, Math.floor(w * dpr));
  c.height = Math.max(260, Math.floor(h * dpr));
  ctx.scale(dpr, dpr);
  return [c, ctx, w, h];
}

export function mount(powerSel, energySel) {
  [cvsPower, ctxPower]   = makeCanvas(powerSel);
  [cvsEnergy, ctxEnergy] = makeCanvas(energySel);
  window.addEventListener("resize", () => {
    [cvsPower, ctxPower]   = makeCanvas(powerSel);
    [cvsEnergy, ctxEnergy] = makeCanvas(energySel);
  });
}

// 环形缓冲
const series = {
  power: { t: [], load: [], pv: [], wind: [], diesel: [], bess: [] },
  energy: { t: [], fuelLph: [], soc: [], cumFuel: [] }
};

function pushSeries(s, t, obj, cap=MAX_POINTS) {
  s.t.push(t); if (s.t.length>cap) s.t.shift();
  for (const [k,v] of Object.entries(obj)) {
    s[k].push(v);
    if (s[k].length>cap) s[k].shift();
  }
}

function drawAxes(ctx, w, h, yLabel) {
  ctx.clearRect(0,0,w,h);
  ctx.save();
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  // x grid
  for (let i=0;i<=10;i++){
    const x=i*(w/10); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
  }
  // y grid
  for (let i=0;i<=6;i++){
    const y=i*(h/6); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }
  ctx.fillStyle="#666"; ctx.font="12px ui-monospace,monospace";
  ctx.fillText(yLabel, 6, 14);
  ctx.restore();
}

function normalize(arr, h) {
  if (arr.length===0) return [];
  const mn = Math.min(...arr), mx = Math.max(...arr);
  const span = (mx - mn) || 1;
  return arr.map(v => h - ( (v - mn) / span ) * (h - 18));
}

function strokeLine(ctx, xs, ys) {
  if (xs.length<2) return;
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for (let i=1;i<xs.length;i++) ctx.lineTo(xs[i], ys[i]);
  ctx.stroke();
}

export function appendPoint(t, p /* {load,pv,wind,diesel,bess, fuelLph, soc, cumFuel} */) {
  // POWER
  pushSeries(series.power, t, {
    load: p.load, pv: p.pv, wind: p.wind, diesel: p.diesel, bess: p.bess
  });
  // ENERGY
  pushSeries(series.energy, t, {
    fuelLph: p.fuelLph, soc: p.soc, cumFuel: p.cumFuel
  });

  // draw POWER
  {
    const ctx = ctxPower;
    const w = cvsPower.clientWidth, h = cvsPower.clientHeight;
    drawAxes(ctx, w, h, "kW");
    const n = series.power.t.length;
    const xs = Array.from({length:n}, (_,i)=> i*(w/(n-1||1)));
    const yLoad  = normalize(series.power.load, h);
    const yPV    = normalize(series.power.pv,   h);
    const yWind  = normalize(series.power.wind, h);
    const yDies  = normalize(series.power.diesel, h);
    const yBess  = normalize(series.power.bess, h);
    ctx.lineWidth=2;
    // 不设特定颜色，遵循要求（除非用户指定）
    strokeLine(ctx, xs, yLoad);
    strokeLine(ctx, xs, yPV);
    strokeLine(ctx, xs, yWind);
    strokeLine(ctx, xs, yDies);
    strokeLine(ctx, xs, yBess);
  }

  // draw ENERGY
  {
    const ctx = ctxEnergy;
    const w = cvsEnergy.clientWidth, h = cvsEnergy.clientHeight;
    drawAxes(ctx, w, h, "SOC / Fuel");
    const n = series.energy.t.length;
    const xs = Array.from({length:n}, (_,i)=> i*(w/(n-1||1)));
    const yFuel  = normalize(series.energy.fuelLph, h);
    const ySOC   = normalize(series.energy.soc,     h);
    const yCum   = normalize(series.energy.cumFuel, h);
    ctx.lineWidth=2;
    strokeLine(ctx, xs, yFuel);
    strokeLine(ctx, xs, ySOC);
    strokeLine(ctx, xs, yCum);
  }
}
