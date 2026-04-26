import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// CORS — only needed if Clinic Hub or other origins call /api directly.
// Currently the SPA is served from the same origin so this is just a safety net.
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.options("/api/{*splat}", (_req, res) => {
  res.sendStatus(204);
});

const CDRC_BASE = "https://cdrc.hpa.gov.tw/nhri2/api/open/hra/v4";
const TIMEOUT_MS = 15_000;
const DISEASES = ["chd", "stroke", "diabetes", "hypertension", "mace"] as const;
type Disease = (typeof DISEASES)[number];

interface RiskRequest {
  gender: 0 | 1;
  age: number;
  sbp?: number; dbp?: number;
  hdlc?: number; ldlc?: number; chol?: number; tg?: number;
  glu?: number; hba1c?: number;
  height?: number; weight?: number; bmi?: number; waist?: number;
  hbp?: 0 | 1; diabetes?: 0 | 1; smoke?: 0 | 1;
}

interface CdrcResponse {
  code: number;
  message: string;
  data: Array<{ risk: number; populationAvg: number; multipleDiff: number }>;
}

type Outcome =
  | { risk: number; populationAvg: number; multipleDiff: number }
  | { error: string };

function buildPayload(req: RiskRequest): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(req)) {
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

async function callDisease(d: Disease, body: RiskRequest): Promise<Outcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const r = await fetch(`${CDRC_BASE}/${d}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(body)),
      signal: ctrl.signal,
    });
    if (!r.ok) return { error: `國健署回應 HTTP ${r.status}` };
    const j = (await r.json()) as CdrcResponse;
    if (j.code !== 0 || !j.data?.[0]) return { error: j.message || "未知錯誤" };
    const o = j.data[0];
    return { risk: o.risk, populationAvg: o.populationAvg, multipleDiff: o.multipleDiff };
  } catch (e) {
    const elapsed = Date.now() - startedAt;
    const msg = e instanceof Error ? e.message : String(e);
    const cause = (e as { cause?: { code?: string } }).cause;
    if (msg.includes("abort") || msg.includes("aborted")) {
      return { error: `請求逾時 (>${(elapsed / 1000).toFixed(0)}s)` };
    }
    if (cause?.code) return { error: `網路錯誤 ${cause.code}` };
    return { error: msg };
  } finally {
    clearTimeout(timer);
  }
}

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * Diagnostic: confirms outbound connectivity to cdrc.hpa.gov.tw.
 * Useful immediately after deploy to verify the region can reach upstream.
 */
app.get("/api/diag", async (_req, res) => {
  const dns = await import("node:dns/promises");
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env["NODE_ENV"] ?? null,
  };
  const t1 = Date.now();
  try {
    const addrs = await dns.lookup("cdrc.hpa.gov.tw", { all: true });
    result["dnsLookup"] = { ok: true, ms: Date.now() - t1, addresses: addrs };
  } catch (e) {
    result["dnsLookup"] = {
      ok: false, ms: Date.now() - t1,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const t2 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(`${CDRC_BASE}/chd`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gender: 1, age: 55, hdlc: 45, waist: 90, hbp: 0 }),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    result["chdProbe"] = {
      ok: true, ms: Date.now() - t2, status: r.status, body: txt.slice(0, 300),
    };
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause;
    result["chdProbe"] = {
      ok: false, ms: Date.now() - t2,
      error: e instanceof Error ? e.message : String(e),
      causeCode: cause?.code ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
  res.json(result);
});

app.post("/api/risk-assessment", async (req, res) => {
  const body = req.body as RiskRequest;
  if (body?.gender !== 0 && body?.gender !== 1) {
    res.status(400).json({ error: "gender 必須為 0 或 1" });
    return;
  }
  if (typeof body.age !== "number" || body.age < 20 || body.age > 100) {
    res.status(400).json({ error: "age 必須在 20-100 之間" });
    return;
  }
  const settled = await Promise.all(DISEASES.map((d) => callDisease(d, body)));
  const out = Object.fromEntries(
    DISEASES.map((d, i) => [d, settled[i]]),
  ) as Record<Disease, Outcome>;
  res.json(out);
});

// Serve the built React SPA
const clientDist = path.resolve(__dirname, "client");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const port = Number(process.env["PORT"] ?? 3001);
app.listen(port, () => {
  console.log(`[nhi-risk-report] listening on :${port}`);
});
