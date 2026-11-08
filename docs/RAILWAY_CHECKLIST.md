# Railway 部署檢查清單

正式環境：`wendy-rich-menu-production`（或你的 Production service）。  
建置／啟動見根目錄 [`railway.toml`](../railway.toml)。

---

## A. 例行更新（已上線、只推新程式）

### 部署前（本機）

- [ ] `git status` 確認不會誤 commit `.env`、`credentials/`、`*.db`
- [ ] `npm run build` 通過（含 `liff` + `server`）
- [ ] 若只改資料庫腳本／補堂數：**不要**靠 redeploy 當資料修正手段（見下方「資料庫腳本」）
- [ ] 若改動含 **購買份數**：務必 **同一版** 含後端 + LIFF（見「購買份數」小節）

### 推送與部署

- [ ] `git push` 到 Railway 連線的分支（通常 `master`）
- [ ] Railway → Deployments → 確認 **Build 成功**、**Active**
- [ ] Deploy Logs 無啟動錯誤；`/health` 回 200

### 部署後（自動）

服務啟動時會執行 SQLite **migrate**（只加欄位、不刪資料）。  
本次「購買份數」會新增 `purchases.plan_quantity`（預設 1）、`plan_id`（預設空）；舊訂單不受影響。

### 快速驗證（約 5 分鐘）

```bash
# 本機（PowerShell 範例）
$env:BASE_URL="https://wendy-rich-menu-production.up.railway.app"
npm run verify-deploy
```

- [ ] `verify-deploy` 全綠
- [ ] LINE Developers → Webhook → **Verify** 成功
- [ ] 手機 LIFF：**購買課程** 出現「購買份數」、預設 1
- [ ] **預約一堂**（確認與購課無關功能正常）
- [ ] **會員資訊** 堂數顯示正常
- [ ] （選測）1 份無券下單 → 管理員待確認 → 確認後堂數入帳
- [ ] （選測）2 份同一筆訂單 → 確認後 **一次** 加總堂數

### 購買份數（quantity）部署順序

| 情況 | 結果 |
|------|------|
| **整包 redeploy**（`npm run build` 在 Railway 建置） | ✅ 正確（後端與 LIFF 同版） |
| 只上舊後端、新 LIFF 已快取新前端 | ❌ 選 2 份可能只收 1 份價 |
| 只上後端、學員仍看舊 LIFF | ✅ 安全（一律當 1 份） |

**建議：** 推送 commit 後做一次完整 redeploy，並用無痕／重開 LIFF 測 2 份。

---

## B. 首次建立 Railway（新專案）

### 前置

- [ ] 專案已在 GitHub（不含 `.env`、`credentials/`、`*.db`）
- [ ] 新 LINE OA 憑證已準備（見 [`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md)）

### 建立專案

1. [Railway](https://railway.app/) → **New Project** → **Deploy from GitHub**
2. Root Directory 留空
3. Build / Start（或由 `railway.toml`）：
   - **Build**: `npm run install:all && npm run build`
   - **Start**: `node server/dist/index.js`

### 公開網域

1. Service → **Settings** → **Networking** → **Generate Domain**
2. 記下網域，填入 `BASE_URL`（**不含**結尾 `/`）

### Volume（必做）

**建議只掛一顆**（與 [`DEPLOY.md`](DEPLOY.md) 一致）：

| 容器路徑 | 用途 |
|----------|------|
| `/app/server/data` | SQLite（`DATABASE_PATH=/app/server/data/wendy.db`）、課程主題上傳（`data/content/`） |

選填：Google JSON 可放 `/app/server/data/credentials/` 或獨立 Volume。

- [ ] `DATABASE_PATH=/app/server/data/wendy.db` 已設
- [ ] Redeploy 後舊會員／舊訂單仍在（證明 Volume 有掛對）

### 環境變數

複製 [`server/.env.example`](../server/.env.example) 到 Railway Variables。

**建置 LIFF 必要**

```
VITE_LIFF_ID=（與 LIFF_ID 相同）
VITE_API_BASE=/api
```

**正式環境建議**

```
OTP_DEV_MODE=false
DATABASE_PATH=/app/server/data/wendy.db
BASE_URL=https://你的-railway-網域
ADMIN_LINE_USER_ID=...
DRINK_ORDER_LINE_USER_ID=...   # 開班飲品通知（回咖啡）
```

- [ ] 修改任何 `VITE_*` 後已 **Redeploy**
- [ ] LINE Console：Webhook URL、`LIFF Endpoint URL` 指向 `BASE_URL`

### Google Sheets

- [ ] `GOOGLE_SHEETS_SPREADSHEET_ID`、Service Account 已設
- [ ] 試算表已分享給 Service Account 信箱

---

## C. 資料庫腳本（補堂數、同步試算表）

**勿用** `railway run` 當「改正式 DB」的預設方式（常在**本機**跑、路徑不是 Production Volume）。

**正式環境請用 SSH 在容器內執行：**

```bash
railway link   # 選 production service
railway ssh -- "node server/dist/scripts/sync-members-to-sheets.js"
railway ssh -- "node server/dist/scripts/apply-legacy-session-credits.js --apply"
```

- [ ] 腳本跑在 **ssh** 內，且 `DATABASE_PATH` 指向 Volume
- [ ] 只改 DB、沒改程式時：**不必** redeploy

---

## D. 完整功能驗收（重大上線或換 OA）

- [ ] Webhook Verify 成功
- [ ] Rich Menu 五格點擊正確
- [ ] 課程資訊頁載入
- [ ] 購課：注意事項 → 匯款 → 待確認通知
- [ ] 購課：份數 1～5、折扣券整筆折價
- [ ] 管理員確認／拒絕 → 堂數與券狀態正確
- [ ] 預約三時段 + 名額／備取
- [ ] 開課截止後通知（含 `DRINK_ORDER_LINE_USER_ID`）
- [ ] 會員資訊：堂數、折扣券
- [ ] 管理後台：待確認付款、課程主題、折扣券
- [ ] Redeploy 後資料與主題圖仍在（Volume）

---

## E. 常見問題

| 症狀 | 檢查 |
|------|------|
| LIFF 白屏／API 404 | `BASE_URL`、`VITE_API_BASE=/api`、是否 redeploy 過 |
| 部署後資料清空 | Volume 未掛在 `/app/server/data` 或 `DATABASE_PATH` 錯 |
| 補堂數沒生效 | 用了 `railway run` 而非 `railway ssh` |
| Google Sheets 429 | 批次同步間隔；必要時單人 `syncMemberToSheet` |
| Webhook 失敗 | LINE 後台 URL 是否為 `https://網域/webhook/line` |

---

## 相關文件

- [`DEPLOY.md`](DEPLOY.md) — ngrok 本機、Render 替代
- [`DEV_PROD_ENVIRONMENTS.md`](DEV_PROD_ENVIRONMENTS.md) — 本機 OA vs 正式 OA
- [`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md) — 換官方帳號
- [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md) — 試算表欄位
