export class Plot {
  constructor(canvas, { yMin = null, yMax = null, grid = true } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.series = [];
    this.yMin = yMin; this.yMax = yMax; this.grid = grid;
    this.margin = { l: 42, r: 10, t: 14, b: 20 };
    this.dataX = [];
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }
  resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(300, Math.floor(width * dpr));
    this.canvas.height = Math.max(150, Math.floor(height * dpr));
    this.draw();
  }
  setData(xSec, series) {
    this.dataX = xSec;
    this.series = series;
    this.draw();
  }
  draw() {
    const ctx = this.ctx, c = this.canvas;
    ctx.save(); ctx.clearRect(0, 0, c.width, c.height);
    const m = this.margin, W = c.width - m.l - m.r, H = c.height - m.t - m.b;
    ctx.translate(m.l, m.t);

    // X scale
    const t0 = this.dataX.length ? this.dataX[0] : 0;
    const t1 = this.dataX.length ? this.dataX[this.dataX.length - 1] : 1;
    const xOf = t => W * (t - t0) / Math.max(1e-6, (t1 - t0));

    // Y scale
    let yMin = this.yMin, yMax = this.yMax;
    if (yMin == null || yMax == null) {
      yMin = +Infinity; yMax = -Infinity;
      for (const s of this.series) for (const v of s.values) { if (v==null) continue; if (v<yMin) yMin=v; if (v>yMax) yMax=v; }
      if (!isFinite(yMin) || !isFinite(yMax)) { yMin = 0; yMax = 1; }
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
    }
    const yOf = v => H - (H * (v - yMin) / (yMax - yMin));

    // Grid + Y labels
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    for (let i=0;i<=4;i++){ const y=(H*i)/4; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.fillStyle = "#6b7280"; ctx.font = "12px system-ui,-apple-system,Segoe UI,Roboto"; ctx.textAlign="right";
    for (let i=0;i<=4;i++){ const v=yMin+(yMax-yMin)*i/4; const y=(H*i)/4; ctx.fillText(v.toFixed(1), -6, y+4); }

    // Lines
    ctx.lineWidth = 2;
    for (const s of this.series) {
      ctx.beginPath(); ctx.strokeStyle = s.color;
      let first = true;
      for (let i=0;i<this.dataX.length;i++){
        const val = s.values[i]; if (val==null) { first=true; continue; }
        const x = xOf(this.dataX[i]); const y = yOf(val);
        if (first) { ctx.moveTo(x,y); first=false; } else { ctx.lineTo(x,y); }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
