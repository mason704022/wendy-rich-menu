# Railway 部署檢查清單

## 前置

- [ ] 專案已在 GitHub（不含 `.env`、`credentials/`、`*.db`）
- [ ] 新 LINE OA 憑證已準備（見 [`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md)）

## 建立專案

1. [Railway](https://railway.app/) → **New Project** → **Deploy from GitHub**
2. 選擇本 repo，Root Directory 留空（專案根目錄）
3. Build / Start 由 [`railway.toml`](../railway.toml) 提供，或手動設定：
   - **Build**: `npm run install:all && npm run build`
   - **Start**: `node server/dist/index.js`

## 公開網域

1. Service → **Settings** → **Networking** → **Generate Domain**
2. 記下網域，例如 `https://wendy-studio-production.up.railway.app`
3. 填入環境變數 `BASE_URL`（不含結尾 `/`）

## Volume（必做）

Service → **Volumes** → **Add Volume**，掛載至：

| 容器路徑 | 用途 |
|----------|------|
| `/app/server/data` | SQLite（`DATABASE_PATH=/app/server/data/wendy.db`） |
| `/app/server/content` | 課程主題、上傳圖片 |
| `/app/server/credentials` | Google Service Account JSON（選填） |

首次部署後，若 `content/` 為空，可從本機複製 `server/content/session-themes.json` 與預設圖到 Volume。

## 環境變數

複製 [`server/.env.example`](../server/.env.example) 全部項目到 Railway Variables。

**建置時必要（LIFF 打包）**

```
VITE_LIFF_ID=（與 LIFF_ID 相同）
VITE_API_BASE=/api
```

**正式環境**

```
OTP_DEV_MODE=false
DATABASE_PATH=/app/server/data/wendy.db
```

每次修改 `VITE_*` 變數後必須 **Redeploy**。

## Google Sheets 憑證

1. 將 JSON 檔上傳至 Volume 的 `/app/server/credentials/`
2. 設定 `GOOGLE_SERVICE_ACCOUNT_JSON=/app/server/credentials/檔名.json`

## 部署後驗證

```bash
curl https://你的網域/health
npm run verify-deploy
```

## 連接 LINE

見 [`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md) Phase 4–7。
