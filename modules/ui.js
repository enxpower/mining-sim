/* modules/ui.js */
const $ = (s) => document.querySelector(s);

let handlers = { onStart: null, onPause: null, onReset: null };
let running = false;

export function mount(containerSelector, h) {
  handlers = h || handlers;

  const el = typeof containerSelector === "string" ? document.querySelector(containerSelector) : containerSelector;
  if (!el) throw new Error("ui.mount container missing");

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px">
      <label> Diesel Min Loading (%)<br/><input id="f-minload" type="number" value="30" min="0" max="80"/></label>
      <label> BESS Energy (MWh)<br/><input id="f-bess-mwh" type="number" value="10" min="0.5" step="0.5"/></label>
      <label> PV Cap (MW)<br/><input id="f-pv-mw" type="number" value="5" min="0" step="0.5"/></label>
      <label> Wind Cap (MW)<br/><input id="f-wind-mw" type="number" value="6" min="0" step="0.5"/></label>
    </div>
  `;

  $("#btn-start")?.addEventListener("click", () => {
    if (running) return;
    running = true;
    $("#btn-start").disabled = true;
    $("#btn-pause").disabled = false;
    handlers.onStart?.();
  });

  $("#btn-pause")?.addEventListener("click", () => {
    if (!running) return;
    running = false;
    $("#btn-start").disabled = false;
    $("#btn-pause").disabled = true;
    handlers.onPause?.();
  });

  $("#btn-reset")?.addEventListener("click", () => {
    running = false;
    $("#btn-start").disabled = false;
    $("#btn-pause").disabled = true;
    handlers.onReset?.(getScenario());
  });
}

export function getScenario() {
  const v = (id) => Number(document.getElementById(id)?.value || 0);
  return {
    dieselMinLoadingPct: v("f-minload"),
    bessMWh: v("f-bess-mwh"),
    pvMW: v("f-pv-mw"),
    windMW: v("f-wind-mw"),
  };
}

export function renderMetrics(m) {
  const box = document.querySelector("#live-metrics");
  if (!box) return;
  const lines = [];
  for (const [k, v] of Object.entries(m || {})) {
    lines.push(`${k.padEnd(18, " ")} : ${typeof v === "number" ? v.toFixed?.(3) ?? v : v}`);
  }
  box.textContent = lines.join("\n");
}

export function renderState(s) {
  const box = document.querySelector("#live-state");
  if (!box) return;
  box.textContent = JSON.stringify(s || {}, null, 2);
}
