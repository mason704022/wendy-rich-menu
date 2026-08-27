# 換新 LINE 官方帳號 + 正式上線 SOP

本文件對應「部署上線 + 換新 LINE 官方帳號」計畫，適用於：

- **全新 LINE 官方帳號**（新 Messaging API + 新 LIFF ID）
- **正式環境空資料庫**（不搬移本機測試資料）

詳細 LINE Console 操作請搭配 [`LINE_SETUP.md`](LINE_SETUP.md)。  
Railway 部署請搭配 [`DEPLOY.md`](DEPLOY.md) 與 [`RAILWAY_CHECKLIST.md`](RAILWAY_CHECKLIST.md)。

---

## 總流程

```
Phase 1  建立新 LINE OA + 取得憑證
    ↓
Phase 2  部署 Railway（固定 HTTPS 網域 + Volume）
    ↓
Phase 3  設定正式環境變數並 Redeploy
    ↓
Phase 4  Webhook / LIFF Endpoint 指向 Railway
    ↓
Phase 5  create-rich-menu
    ↓
Phase 6  設定 ADMIN_LINE_USER_ID
    ↓
Phase 7  驗收
```

**不要**先把新 LIFF 指到 ngrok 再改 Railway（會改兩次、Rich Menu 也要重做）。

---

## Phase 1：建立新 LINE 官方帳號

### 1-1. 官方帳號

1. 前往 [LINE Official Account Manager](https://manager.line.biz/)
2. 建立新的 Wendy 工作室官方帳號

### 1-2. 啟用 Messaging API

1. OA 後台 → **設定** → **Messaging API** → **使用 Messaging API**
2. 選擇 Provider（建立後 Channel 無法搬移）

### 1-3. LINE Login Channel

1. [LINE Developers Console](https://developers.line.biz/console/) → 同一 Provider
2. **Create a new channel** → **LINE Login** → App type: **Web app**
3. **Basic settings** → **Linked bots** → 連結新 Messaging API Channel

### 1-4. 建立 LIFF App

在 **LINE Login Channel**（不是 Messaging API）→ **LIFF** → **Add**：

| 項目 | 值 |
|------|-----|
| Size | Full |
| Endpoint URL | 先填 `https://example.com/` 佔位，Phase 4 再改為 Railway 網域 |
| Scope | `openid`, `profile` |
| Bot link feature | On (Aggressive) |

### 1-5. 記下憑證（勿 commit）

| 變數 | 取得位置 |
|------|----------|
| `LINE_CHANNEL_SECRET` | Messaging API → Basic settings |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → Issue long-lived token |
| `LIFF_ID` | LINE Login → LIFF |
| `LIFF_BASE_URL` | `https://liff.line.me/{LIFF_ID}` |

### 1-6. 加好友

用您的 LINE 帳號加**新官方帳號**為好友（Phase 6 取管理員 User ID 用）。

**Phase 1 完成檢查**

- [ ] 新 OA 已建立
- [ ] Messaging API 已啟用
- [ ] LINE Login Channel 已連結 Bot
- [ ] LIFF 已建立，LIFF ID 已記錄
- [ ] Channel Secret 與 Access Token 已記錄

---

## Phase 2：部署 Railway

1. 專案已推送到 GitHub（見 [`RAILWAY_CHECKLIST.md`](RAILWAY_CHECKLIST.md)）
2. [Railway](https://railway.app/) → New Project → Deploy from GitHub
3. 確認 Build / Start 指令（[`railway.toml`](../railway.toml) 已含預設）
4. Settings → Networking → Generate Domain
5. **掛載 Volume**（必做）：

| Volume 掛載路徑 | 用途 |
|----------------|------|
| `/app/server/data` | SQLite 資料庫 |
| `/app/server/content` | 課程主題 JSON、上傳圖片 |
| `/app/server/credentials` | Google Service Account JSON（若使用 Sheets） |

**Phase 2 完成檢查**

- [ ] Railway 部署成功
- [ ] `https://你的網域/health` 回傳 `{"status":"ok"}`
- [ ] Volume 已掛載

---

## Phase 3：正式環境變數

在 Railway → Variables 設定（參考 [`server/.env.example`](../server/.env.example)）：

```env
LINE_CHANNEL_SECRET=（新 OA）
LINE_CHANNEL_ACCESS_TOKEN=（新 OA）
LIFF_ID=（新）
LIFF_BASE_URL=https://liff.line.me/（新 LIFF_ID）
BASE_URL=https://你的-railway-網域
PORT=3000

VITE_LIFF_ID=（與 LIFF_ID 相同，建置 LIFF 用）
VITE_API_BASE=/api

OTP_DEV_MODE=false
DATABASE_PATH=/app/server/data/wendy.db

IG_URL=（您的 Instagram）
ADMIN_LINE_USER_ID=（Phase 6 再填）

DEFAULT_SESSIONS_PER_PURCHASE=10
DEFAULT_PURCHASE_AMOUNT=3000

# Google Sheets（選填）
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=/app/server/credentials/your-file.json
GOOGLE_SHEETS_BOOKINGS_TAB=預約
GOOGLE_SHEETS_PURCHASES_TAB=匯款訂單
GOOGLE_SHEETS_URL=
```

設定後按 **Redeploy**（`VITE_LIFF_ID` 需重新建置才會嵌入 LIFF）。

**Phase 3 完成檢查**

- [ ] 所有必填變數已設定
- [ ] `OTP_DEV_MODE=false`
- [ ] Redeploy 成功

---

## Phase 4：連接 LINE 到 Railway

### Messaging API Channel

1. Webhook URL：`https://你的-railway-網域/webhook/line`
2. 開啟 **Use webhook** → 按 **Verify**（應成功）
3. 關閉 **Auto-reply messages**

### LINE Login Channel → LIFF

1. Endpoint URL：`https://你的-railway-網域/`（結尾要有 `/`）

### 快速驗證

```bash
curl https://你的-railway-網域/health
curl -X POST https://你的-railway-網域/webhook/line -H "Content-Type: application/json" -d "{\"events\":[]}"
```

瀏覽器開啟：`https://liff.line.me/新LIFF_ID?page=courses`

**Phase 4 完成檢查**

- [ ] Webhook Verify 成功
- [ ] LIFF 課程頁可載入

---

## Phase 5：建立 Rich Menu

在本機 `server/.env` 暫時填入**新 OA** 的 token 與 LIFF 設定，且 `BASE_URL` 指向 Railway 網域，然後：

```bash
npm run create-rich-menu
```

或在 Railway Shell：

```bash
node server/dist/index.js &
# 或直接在本機對新 OA 執行 create-rich-menu
npm run create-rich-menu
```

**注意**：不要在 LINE 後台手動設定 Rich Menu（會與 API 衝突）。

**Phase 5 完成檢查**

- [ ] Rich Menu 已套用至新 OA
- [ ] 五格連結可開啟正確 LIFF 頁

---

## Phase 6：設定管理員

1. 確認您已加新 OA 為好友
2. 本機 `server/.env` 指向新 OA token，執行：

```bash
cd server && npm run list-status
```

3. 找到您的 LINE User ID，填入 Railway `ADMIN_LINE_USER_ID`
4. Redeploy
5. 測試：`https://liff.line.me/新LIFF_ID?page=admin`

**Phase 6 完成檢查**

- [ ] 管理頁可進入（非 403）
- [ ] 可上傳課程圖片並儲存

---

## Phase 7：驗收清單

```bash
# 將 BASE_URL 設為 Railway 網域後執行
npm run verify-deploy
```

手動驗收：

- [ ] Webhook Verify 成功
- [ ] Rich Menu 五格正確
- [ ] 課程資訊 / 購課 / 預約 / 會員頁
- [ ] 管理後台課程主題（後五週）
- [ ] 匯款 → 管理員確認 → 堂數更新
- [ ] Google Sheets 同步（若啟用）
- [ ] Redeploy 後上傳圖片仍在（Volume 正常）

---

## 舊 OA 處理

- 本機 ngrok / 舊 LIFF / 舊 token **保留作開發測試**
- 正式會員引導加**新官方帳號**
- 舊 OA 可設停止服務或自動回覆導流訊息

---

## 常見問題

| 問題 | 解法 |
|------|------|
| ERR_NGROK_3200 | 正式環境改用 Railway 固定網域 |
| LIFF 空白 | 確認 LIFF Endpoint = Railway 網域；Redeploy 含正確 `VITE_LIFF_ID` |
| 管理頁 403 | `ADMIN_LINE_USER_ID` 須為新 OA 下您的 User ID |
| 圖片 redeploy 後消失 | Volume 掛載 `/app/server/content` |
| Webhook 404 | 確認 `ngrok http 3000` 改為 Railway；路徑為 `/webhook/line` |
