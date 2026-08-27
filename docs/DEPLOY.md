# 部署指南

本機測試用 ngrok；**正式上線**請依 [`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md) 與 [`RAILWAY_CHECKLIST.md`](RAILWAY_CHECKLIST.md)。

---

## 本機測試（ngrok）

1. 啟動服務：
   ```bash
   npm run build
   cd server && npm run dev
   ```

2. 安裝並啟動 [ngrok](https://ngrok.com/)：
   ```bash
   ngrok http 3000
   ```

3. 複製 ngrok HTTPS URL（例如 `https://abc123.ngrok-free.app`）

4. 在 LINE Developers Console 更新：
   - **Webhook URL**: `https://abc123.ngrok-free.app/webhook/line`
   - **LIFF Endpoint URL**: `https://abc123.ngrok-free.app/`

5. 更新 `server/.env`（參考 [`server/.env.example`](../server/.env.example)）：
   ```
   BASE_URL=https://abc123.ngrok-free.app
   LIFF_BASE_URL=https://liff.line.me/YOUR_LIFF_ID
   ```

6. 重新執行 Rich Menu 腳本（若 LIFF URL 有變）：
   ```bash
   npm run create-rich-menu
   ```

---

## Railway 部署（正式環境建議）

### 1. 推送 GitHub

確認 `.gitignore` 已排除 `.env`、`credentials/`、`*.db`。

### 2. 建立 Railway 專案

1. [Railway](https://railway.app/) → New Project → Deploy from GitHub
2. 建置／啟動指令見根目錄 [`railway.toml`](../railway.toml)：
   - **Build**: `npm run install:all && npm run build`
   - **Start**: `node server/dist/index.js`

### 3. Volume（必做）

| 掛載路徑 | 用途 |
|----------|------|
| `/app/server/data` | SQLite |
| `/app/server/content` | 課程主題、上傳圖片 |
| `/app/server/credentials` | Google 憑證（選填） |

### 4. 環境變數

複製 [`server/.env.example`](../server/.env.example) 至 Railway Variables。

建置 LIFF 還需：

```
VITE_LIFF_ID=（與 LIFF_ID 相同）
VITE_API_BASE=/api
```

正式環境：

```
OTP_DEV_MODE=false
DATABASE_PATH=/app/server/data/wendy.db
BASE_URL=https://你的-railway-網域
```

修改 `VITE_*` 後必須 **Redeploy**。

### 5. 連接 LINE + Rich Menu

完整步驟見 [`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md)。

### 6. 部署驗證

```bash
BASE_URL=https://你的-railway-網域 npm run verify-deploy
```

---

## Render 部署（替代）

1. New Web Service → 連接 repo
2. Build: `npm run install:all && npm run build`
3. Start: `node server/dist/index.js`
4. 環境變數同上；需自行設定持久化磁碟

---

## 驗收清單

- [ ] Webhook Verify 成功（LINE Console → Verify）
- [ ] Rich Menu 五格點擊正確
- [ ] 課程資訊頁載入
- [ ] 購課三步驟 + 匯款通知
- [ ] 管理員確認後堂數更新
- [ ] 預約三時段 + 名額限制
- [ ] 會員資訊顯示堂數
- [ ] 管理後台課程主題（後五週）可上傳圖片
- [ ] Redeploy 後資料與圖片仍在（Volume）

---

## 注意

- 請勿同時在 LINE 後台與 API 管理 Rich Menu
- LIFF 必須 HTTPS
- 正式環境請設定 `ADMIN_LINE_USER_ID` 與 `OTP_DEV_MODE=false`
- 換新 LINE 官方帳號見 [`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md)
