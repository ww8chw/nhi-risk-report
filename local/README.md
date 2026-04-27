# 安安診所 · 健檢風險評估報告（本地版 / Windows）

完全本地端跑、自動透過國健署「科學算病館」算 5 種慢性病 10 年風險。

## 安裝（一次）

1. 把整個 `local/` 資料夾複製到診所電腦（建議放桌面）
2. 雙擊 `start.bat`
3. 第一次會跳「Windows 已保護您的電腦」→ 點「其他資訊」→「仍要執行」
4. PowerShell 自動裝 Bun（約 30 秒，僅這一次）→ 啟動代理 → Chrome 自動開報告頁

## 平常使用

### 方式 A：從 Clinic Hub 點

1. 雙擊 `start.bat` 啟動代理（cmd 視窗會留著，**別關**）
2. 在 Clinic Hub 點「健檢報告產生器（本機）」卡片 → Chrome 新分頁開到 `http://localhost:7777`
3. 填表 → 「產生報告」→ 「列印 / 存 PDF」

### 方式 B：直接雙擊 .bat

1. 雙擊 `start.bat` → 自動開 Chrome 到 `http://localhost:7777`
2. 同樣填表 → 產生報告 → 列印

### 結束

關閉 cmd 視窗即停止代理（病人資料即消失）。

## 列印設定

- 紙張：**A5**
- 方向：**橫向**

Chrome 列印對話框會自動帶入（@page CSS），但人員務必再次確認。

## 為什麼要本地跑

國健署 API（`cdrc.hpa.gov.tw`）在 TCP 層拒絕非台灣 IP 的連線。海外雲端 server（Railway us-west2 / Vercel 等）都是 `UND_ERR_CONNECT_TIMEOUT`。從台灣本地電腦直接打沒問題。

## 檔案結構

```
local/
├── start.bat        # Windows 雙擊啟動腳本
├── proxy.ts        # Bun 寫的本地代理（port 7777）
│                   # 同時 serve report.html 與 /api/risk-assessment
├── report.html     # 單檔 SPA — 全部 UI
└── README.md
```

## 疑難排解

**雙擊 `start.bat` 沒反應 / SmartScreen 擋**
- 點「其他資訊」→「仍要執行」

**Bun 安裝失敗（PowerShell ExecutionPolicy）**
- 手動開 PowerShell 跑：`irm bun.sh/install.ps1 | iex`
- 完成後再雙擊 `start.bat`

**Port 7777 已被佔用**
- 上一次的 cmd 視窗沒關。打開「工作管理員」結束所有 `bun.exe`，或重啟電腦。

**Clinic Hub 點「健檢報告產生器（本機）」連不上 / 顯示 `localhost 拒絕連線`**
- 確認 cmd 視窗還開著、有顯示「Proxy: http://localhost:7777」
- 沒有就再雙擊 `start.bat`

**產生報告時所有疾病都「請求逾時」**
- 確認電腦能上網
- 確認沒掛 VPN（VPN 出口若是海外 IP 會被擋）

## 隱私

所有病人資料只在診所這台電腦的記憶體與瀏覽器 session 中。
代理不存任何資料到硬碟、不送任何資料到第三方（除了把計算用的數值送到國健署官方 API）。
關閉 cmd 視窗後資料即消失。
