# NHI Risk Report

安安診所體檢後病人說明報告產生器。代理呼叫國健署「科學算病館」(cdrc.hpa.gov.tw) 計算 5 種慢性病 10 年風險。

## 為什麼是獨立服務

國健署 API 對非台灣 IP 在 TCP 層拒絕連線（從 Railway us-west2 證實 `UND_ERR_CONNECT_TIMEOUT`）。本服務需部署在台灣 region（Zeabur tw / GCP asia-east1 / Fly.io tpe）才能跑通自動化流程。

## 本地開發

```bash
pnpm install
pnpm run dev      # client :5173, server :3001（vite proxy /api → :3001）
```

## 部署

GitHub push → Zeabur auto build。設定 region 為 Taiwan。

驗證部署是否能連到國健署：

```bash
curl https://<your-domain>/api/diag
```

`chdProbe.ok === true` 表示通。

## API

- `GET /api/healthz` — 健檢
- `GET /api/diag` — 診斷對外連線
- `POST /api/risk-assessment` — body 見 `server/index.ts` 的 `RiskRequest`

## Tech

Vite + React 19 · Express 5 · Tailwind v4 · esbuild。前後端同 origin、Express 起來後同時 serve dist/client 與 /api。
