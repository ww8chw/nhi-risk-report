/**
 * 本地代理伺服器 — 用 Bun 直接執行：bun proxy.ts
 *
 * 從台灣端電腦本機跑，繞過國健署 cdrc.hpa.gov.tw 對非台灣 IP 的封鎖
 * （部署到海外 server 會 UND_ERR_CONNECT_TIMEOUT）。
 */

const PORT = 7777;
const TIMEOUT_MS = 15_000;
const CDRC_BASE = "https://cdrc.hpa.gov.tw/nhri2/api/open/hra/v4";
const DISEASES = ["chd", "stroke", "diabetes", "hypertension", "mace"] as const;
type Disease = (typeof DISEASES)[number];

interface RiskRequest {
  gender: 0 | 1;
  age: number;
  [k: string]: number | undefined;
}

type Outcome =
  | { risk: number; populationAvg: number; multipleDiff: number }
  | { error: string };

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function callDisease(d: Disease, body: RiskRequest): Promise<Outcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "number") payload[k] = v;
    }
    const r = await fetch(`${CDRC_BASE}/${d}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!r.ok) return { error: `國健署回應 HTTP ${r.status}` };
    const j = (await r.json()) as {
      code: number;
      message: string;
      data?: Array<{ risk: number; populationAvg: number; multipleDiff: number }>;
    };
    if (j.code !== 0 || !j.data?.[0]) return { error: j.message || "未知錯誤" };
    const o = j.data[0];
    return { risk: o.risk, populationAvg: o.populationAvg, multipleDiff: o.multipleDiff };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) return { error: "請求逾時" };
    return { error: msg };
  } finally {
    clearTimeout(timer);
  }
}

const HTML_PATH = `${import.meta.dir}/report.html`;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    // 同時 serve 前端 HTML — Clinic Hub 卡片可直接連 http://localhost:7777
    if (url.pathname === "/" || url.pathname === "/report.html") {
      return new Response(Bun.file(HTML_PATH), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/api/healthz") {
      return Response.json({ status: "ok" }, { headers: corsHeaders() });
    }
    if (url.pathname === "/api/risk-assessment" && req.method === "POST") {
      let body: RiskRequest;
      try {
        body = (await req.json()) as RiskRequest;
      } catch {
        return Response.json({ error: "invalid JSON" }, { status: 400, headers: corsHeaders() });
      }
      if (body?.gender !== 0 && body?.gender !== 1) {
        return Response.json(
          { error: "gender 必須為 0 或 1" },
          { status: 400, headers: corsHeaders() },
        );
      }
      if (typeof body.age !== "number" || body.age < 20 || body.age > 100) {
        return Response.json(
          { error: "age 必須在 20-100 之間" },
          { status: 400, headers: corsHeaders() },
        );
      }
      const settled = await Promise.all(DISEASES.map((d) => callDisease(d, body)));
      const out = Object.fromEntries(
        DISEASES.map((d, i) => [d, settled[i]]),
      ) as Record<Disease, Outcome>;
      return Response.json(out, { headers: corsHeaders() });
    }
    return new Response("Not found", { status: 404, headers: corsHeaders() });
  },
});

console.log(`✓ 本地代理已啟動：http://localhost:${server.port}`);
console.log(`  瀏覽器打開上面網址即可使用，或從 Clinic Hub 點「健檢報告產生器（本機）」`);
console.log(`  關閉這個視窗會停止伺服器。`);
