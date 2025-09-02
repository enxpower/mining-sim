export function exportCSV(series) {
  if (!series || !series.length) return;
  const cols = ['t','Ppv','Pwind','Pload','Pdg','Pb','f','soc','fuelLh','pvCurtMW','windCurtMW'];
  const lines = [cols.join(',')];
  for (const p of series) lines.push(cols.map(k => String(p[k] ?? '')).join(','));
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv' }), 'simulation.csv');
}
export function exportPNG(canvases) {
  const W = Math.max(...canvases.map(c => c.width));
  const H = canvases.reduce((s,c)=>s+c.height,0);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d'); let y = 0;
  for (const c of canvases) { ctx.drawImage(c, 0, y); y += c.height; }
  out.toBlob(b => triggerDownload(b, 'charts.png'));
}
function triggerDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
