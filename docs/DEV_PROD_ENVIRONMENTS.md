# 開發環境 vs 正式環境

本專案支援 **雙 LINE 官方帳號** 並行：

| 環境 | LINE 帳號 | 執行位置 | 設定檔 |
|------|-----------|----------|--------|
| **開發** | 舊 OA（保留測試） | 本機 + ngrok | `server/.env.development` → `server/.env` |
| **正式** | 新 OA（給會員使用） | Railway | `server/.env.production` → Railway Variables |

兩邊 **憑證、LIFF ID、User ID、資料庫完全分開**，互不干擾。

---

## 檔案對照

| 用途 | Server | LIFF 前端 |
|------|--------|-----------|
| 空白範本（可 commit） | [`server/.env.example`](../server/.env.example) | [`liff/.env.example`](../liff/.env.example) |
| 你的環境設定（勿 commit） | `server/.env.development`、`server/.env.production` | `liff/.env.development`、`liff/.env.production` |
| 程式實際讀取 | `server/.env` | `liff/.env` |
| Railway | Service → Variables | 同 production 中的 `VITE_*` |

`.env.development` / `.env.production` 含真實憑證，已在 `.gitignore` 排除。程式只讀 `server/.env` 與 `liff/.env`。

---

## 架構

```
舊 OA（開發）                         新 OA（正式）
    │                                     │
    ├─ ngrok → localhost:3000             ├─ Railway 固定 HTTPS
    ├─ server/.env（舊憑證）               ├─ Railway Variables（新憑證）
    ├─ liff/.env（舊 VITE_LIFF_ID）        ├─ VITE_LIFF_ID（Build 時嵌入）
    ├─ server/data/wendy.db               ├─ Volume /app/server/data/wendy.db
    └─ 舊 LIFF / Webhook → ngrok          └─ 新 LIFF / Webhook → Railway
```

**重要：** 同一個 LIFF App 的 Endpoint URL 只能指向一個網域。因此舊、新帳號各需 **獨立的 LINE Login Channel + LIFF ID**。

---

## 初次設定

### 1. 開發環境（舊 OA）

PowerShell（專案根目錄）：

```powershell
Copy-Item server\.env.development server\.env
Copy-Item liff\.env.development liff\.env
```

編輯 `server/.env`、`liff/.env`，填入**舊帳號**憑證。

在**舊帳號** LINE Developers Console 設定：

| 項目 | 值 |
|------|-----|
| Webhook URL | `https://你的ngrok/webhook/line` |
| LIFF Endpoint URL | `https://你的ngrok/` |

### 2. 正式環境（新 OA）

1. 開 [`server/.env.production`](../server/.env.production) 對照填寫
2. Railway → **wendy-rich-menu** → **Variables** → 逐項貼上
3. **Redeploy**（`VITE_*` 變更需重新建置）

在**新帳號** LINE Developers Console 設定：

| 項目 | 值 |
|------|-----|
| Webhook URL | `https://wendy-rich-menu-production.up.railway.app/webhook/line` |
| LIFF Endpoint URL | `https://wendy-rich-menu-production.up.railway.app/` |

也可參考 [`scripts/railway-env.template.env`](../scripts/railway-env.template.env)（內容與 production 範本一致）。

---

## 日常：本機開發

```powershell
# 1. 確認使用開發設定
Copy-Item server\.env.development server\.env -Force
Copy-Item liff\.env.development liff\.env -Force
# ↑ 若 .env 已填好舊帳號憑證，可跳過覆蓋

# 2. 啟動 server
npm run dev:server

# 3. 另開終端：ngrok
ngrok http 3000

# 4. 將 ngrok HTTPS 網址更新至：
#    - server/.env → BASE_URL
#    - 舊 OA Console → Webhook、LIFF Endpoint

# 5. LIFF 前端（改過 liff/.env 時）
cd liff
npm run build
# 或開發模式：npm run dev（根目錄 npm run dev:liff）
```

測試 LIFF：

```
https://liff.line.me/舊LIFF_ID?page=courses
```

---

## 日常：部署正式環境

程式碼 push 至 GitHub 後，Railway 會自動建置部署。**不需改本機 `.env`**。

確認 Railway Variables 與 [`server/.env.production`](../server/.env.production) 一致，且已 **Redeploy**。

測試正式 LIFF：

```
https://liff.line.me/新LIFF_ID?page=courses
```

---

## 對正式 OA 執行本機腳本

Rich Menu、list-status 等腳本讀 `server/.env`。要操作**新 OA** 時：

```powershell
# 暫時切換為正式憑證
Copy-Item server\.env.production server\.env -Force
# 編輯 server/.env 填入真實新 OA 憑證（若範本尚未填）

# 例：上傳 Rich Menu 至新 OA
cd server
npm run create-rich-menu

# 例：查管理員 User ID
npm run list-status

# 完成後改回開發
Copy-Item server\.env.development server\.env -Force
# 若 .env.development 只是範本，請改回你保存的舊帳號 .env 備份
```

**建議：** 填好舊帳號憑證後，另存一份 `server/.env.local.backup`（已 gitignore）避免被範本覆蓋。

---

## 變數差異速查

| 變數 | 開發（舊 OA） | 正式（新 OA） |
|------|---------------|---------------|
| `LINE_CHANNEL_SECRET` | 舊 | 新 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 舊 | 新 |
| `LIFF_ID` / `VITE_LIFF_ID` | 舊 | 新 |
| `BASE_URL` | ngrok HTTPS | Railway 網域 |
| `ADMIN_LINE_USER_ID` | 舊 OA 的 `U...` | 新 OA 的 `U...` |
| `OTP_DEV_MODE` | `true` 或省略 | `false` |
| `DATABASE_PATH` | `./data/wendy.db` | `/app/server/data/wendy.db` |
| `VITE_*` | 本機 `liff/.env` | Railway Variables + Redeploy |

---

## Rich Menu

| 環境 | 做法 |
|------|------|
| 開發 | `server/.env` 用舊 token → `npm run create-rich-menu` |
| 正式 | `server/.env` 暫改新 token → `npm run create-rich-menu` → 改回舊 token |

Rich Menu **不會**因 Railway redeploy 改變，只會因執行 `create-rich-menu` 而更新對應 OA。

---

## 常見問題

| 問題 | 原因 | 解法 |
|------|------|------|
| `channel not found`（正式） | Railway `VITE_LIFF_ID` 錯或未 Redeploy | 對照新 LIFF ID，Redeploy |
| Webhook Verify 500（正式） | Railway Secret/Token 仍是舊 OA | 更新 Variables 後 Redeploy |
| 本機 LIFF 登入後空白 | ngrok 網址變了 | 更新 `BASE_URL` 與舊 OA LIFF Endpoint |
| 管理頁 403 | `ADMIN_LINE_USER_ID` 用錯 OA 的 ID | 各 OA 分別 `list-status` |
| 改程式後正式壞、本機正常 | 通常無關 LINE 帳號 | 查 Railway log；確認 push 成功 |

---

## 相關文件

- LINE Console 操作：[`LINE_SETUP.md`](LINE_SETUP.md)
- 換新官方帳號 SOP：[`LINE_ACCOUNT_MIGRATION.md`](LINE_ACCOUNT_MIGRATION.md)
- Railway 部署：[`RAILWAY_CHECKLIST.md`](RAILWAY_CHECKLIST.md)、[`DEPLOY.md`](DEPLOY.md)
