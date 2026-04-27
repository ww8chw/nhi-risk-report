#!/bin/bash
# 安安診所 · 健檢風險評估報告 — Mac 啟動腳本
# 雙擊即執行：啟動本地代理 → 自動開瀏覽器

set -e
cd "$(dirname "$0")"

# 確保 PATH 包含 Bun 預設安裝位置
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# 檢查 Bun 是否已安裝
if ! command -v bun &> /dev/null; then
  echo "==============================================="
  echo "  首次使用 — 正在安裝 Bun (約 10MB，僅這一次)"
  echo "==============================================="
  echo ""
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  echo ""
  if ! command -v bun &> /dev/null; then
    echo "❌ Bun 安裝失敗。請手動執行："
    echo "    curl -fsSL https://bun.sh/install | bash"
    echo "  完成後再雙擊本檔。"
    read -p "按 Enter 結束..."
    exit 1
  fi
  echo "✓ Bun 安裝完成"
  echo ""
fi

# 檢查 7777 port 是否已被佔用
if lsof -i :7777 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "⚠️  port 7777 已被其他程式使用。"
  echo "   可能是上一次沒關閉。請先結束舊的，或重啟電腦。"
  read -p "按 Enter 結束..."
  exit 1
fi

echo "==============================================="
echo "  安安診所 · 健檢風險評估報告"
echo "==============================================="
echo ""
echo "正在啟動本地代理..."

# 在背景跑 Bun proxy
bun proxy.ts &
SERVER_PID=$!

# 等 server 起來（最多 5 秒）
for i in {1..50}; do
  if curl -s http://localhost:7777/api/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if ! curl -s http://localhost:7777/api/healthz >/dev/null 2>&1; then
  echo "❌ 代理啟動失敗"
  kill $SERVER_PID 2>/dev/null
  read -p "按 Enter 結束..."
  exit 1
fi

echo "✓ 代理運作中 (PID $SERVER_PID, port 7777)"
echo ""
echo "正在開啟瀏覽器..."
# 用 Chrome 開（診所主要瀏覽器）；Chrome 沒裝就 fallback 到預設瀏覽器
if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "http://localhost:7777"
else
  open "http://localhost:7777"
fi

echo ""
echo "👉 使用完畢後，關閉這個視窗即可停止伺服器。"
echo ""

# 監聽中斷訊號，乾淨關閉
trap "echo ''; echo '正在停止...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

# 等到 server 結束
wait $SERVER_PID
