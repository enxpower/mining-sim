// 仅包含“协议”与最小聚合逻辑，不含任何机密算法
let ENDPOINT = "";
let TOKEN = ""; // 若配 CF Access/登陆门禁，前端可不放 token

async function loadEndpoint() {
  if (ENDPOINT) return ENDPOINT;
  const res = await fetch("./vendor/endpoint.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Missing vendor/endpoint.json");
  const j = await res.json();
  ENDPOINT = (j.base || "").replace(/\/+$/,"");
  TOKEN    = j.token || "";
  return ENDPOINT;
}

async function api(path, body) {
  await loadEndpoint();
  const res = await fetch(`${ENDPOINT}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(TOKEN ? { "authorization": `Bearer ${TOKEN}` } : {})
    },
    body: JSON.stringify(body || {}),
    cache: "no-store",
    credentials: "omit"
  });
  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`API ${path} ${res.status}: ${t}`);
  }
  return res.json();
}

export const buildInfo = {
  name: "ems-engine (remote)",
  version: "rpc",
  rev: "-",
  builtAt: new Date().toISOString()
};

export async function init(config) { return api("/api/init", { config }); }
export async function reset(config, scenario) { return api("/api/reset", { config, scenario }); }
export async function step(dt) { return api("/api/step", { dt }); }
export function metrics() { return api("/api/metrics").catch(()=>({})); }
export function state() { return api("/api/state").catch(()=>({})); }
