# LINE Developers 設定指南

> **重要變更（請依序閱讀）：**
>
> 1. **2024/9/4 起** — 無法從 Developers Console **直接建立** Messaging API 通道，須從 [Official Account Manager](https://manager.line.biz/) 啟用。
> 2. **LIFF 限制** — **無法**在 Messaging API Channel 新增 LIFF，須使用 **LINE Login Channel**。  
>    官方說明：[Users can no longer add LIFF apps to Messaging API channels](https://developers.line.biz/en/docs/liff/getting-started/)

本專案需要 **兩個 Channel**（同一 Provider 下）：

| Channel 類型 | 用途 |
|-------------|------|
| **Messaging API** | Rich Menu、Webhook、推播通知 |
| **LINE Login** | LIFF 網頁（課程、購課、預約、會員） |

---

## 1. 建立 LINE 官方帳號（若尚未有）

1. 前往 [LINE Official Account Manager](https://manager.line.biz/)
2. 建立 Wendy 工作室官方帳號（或選擇既有帳號）

---

## 2. 從官方帳號後台啟用 Messaging API

1. 登入 [LINE Official Account Manager](https://manager.line.biz/)
2. 選擇 **Wendy 官方帳號**
3. 右上角 **設定** → 左側 **Messaging API**
4. 點 **使用 Messaging API**（Messaging API を利用する）
5. 填寫開發者資訊、選擇 **Provider**（建立後 Channel 無法搬移）
6. 完成後，**Messaging API Channel** 會自動出現在 Developers Console

官方文件：[Get started with the Messaging API](https://developers.line.biz/en/docs/messaging-api/getting-started/)

---

## 3. 建立 LINE Login Channel（LIFF 用）

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 進入**同一個 Provider**（與 Messaging API 相同）
3. **Create a new channel** → 選 **LINE Login**
4. 填寫 Channel 名稱（例如 `Wendy LIFF`）、App types 選 **Web app**
5. 建立完成

### 3-1. 連結官方帳號 Bot（Linked bots）

在 LINE Login Channel → **Basic settings** → **Linked bots** → Edit：

- 選擇你的 **Messaging API Channel**（Wendy 官方帳號）
- 儲存

這樣 LIFF 開啟時才能正確關聯官方帳號，使用者也可加好友。

---

## 4. 在 LINE Login Channel 建立 LIFF App

> ⚠️ 請在 **LINE Login Channel** 的 LIFF 分頁新增，**不是** Messaging API Channel。

1. 開啟 LINE Login Channel → **LIFF** → **Add**
2. 設定：

| 項目 | 值 |
|------|-----|
| LIFF app name | Wendy Studio |
| Size | Full |
| Endpoint URL | `https://YOUR_DOMAIN/`（部署後；本機用 ngrok） |
| Scope | `openid`, `profile` |
| Bot link feature | **On (Aggressive)**（建議，方便加好友） |

3. 建立後複製 **LIFF ID**
4. 填入 `server/.env`：
   ```
   LIFF_ID=你的_LIFF_ID
   LIFF_BASE_URL=https://liff.line.me/你的_LIFF_ID
   ```
5. 填入 `liff/.env`：
   ```
   VITE_LIFF_ID=你的_LIFF_ID
   ```

Rich Menu 的連結格式：`https://liff.line.me/{LIFF_ID}?page=courses` 等（本專案 `create-rich-menu` 腳本已自動處理；使用 query 參數以避免 LIFF 登入後路徑遺失）。

---

## 5. 取得 Messaging API 憑證

在 **Messaging API Channel**（不是 LINE Login）：

| 變數 | 位置 |
|------|------|
| `LINE_CHANNEL_SECRET` | Basic settings → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → Issue channel access token（long-lived） |

複製到 `server/.env`。

---

## 6. Webhook（Messaging API Channel）

1. Messaging API 分頁 → **Webhook URL**: `https://YOUR_DOMAIN/webhook/line`
2. 啟用 **Use webhook** → 點 **Verify**
3. 建議關閉 **Auto-reply messages**

### Webhook Verify 失敗排查

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 404 Not Found | ngrok 指到錯誤 port（常見：5173 而非 3000） | 執行 `ngrok http 3000` |
| 404 Not Found | server 未啟動 | `cd server && npm run dev` |
| 404 Not Found | 路徑打錯 | 必须是 `/webhook/line` |
| 無法解析網域 | 用了 localhost 或 ngrok 已關閉 | 重新啟動 ngrok |

**驗證指令（本機）：**

```bash
curl -X POST http://localhost:3000/webhook/line -H "Content-Type: application/json" -d "{\"events\":[]}"
```

應回傳 `{"ok":true}`。

**驗證指令（經 ngrok）：**

```bash
curl -X POST https://你的ngrok網域/webhook/line -H "Content-Type: application/json" -d "{\"events\":[]}"
```

若本機 OK 但 ngrok 404 → 確認 ngrok 指令是 `ngrok http 3000`（不是 5173）。

---

## 7. Rich Menu（Messaging API）

- **不要**在 Official Account Manager 後台設定 Rich Menu
- 使用 API 腳本：

```bash
npm run create-rich-menu
```

---

## 8. 本機開發（ngrok）

```bash
# 終端 1
cd server && npm run dev

# 終端 2（可選）
cd liff && npm run dev

# 終端 3
ngrok http 3000
```

將 ngrok HTTPS URL 設為：
- Messaging API → **Webhook URL**
- LINE Login LIFF → **Endpoint URL**

---

## 9. 待填項目

- `IG_URL`：Instagram 完整網址
- `ADMIN_LINE_USER_ID`：管理員 LINE User ID
- 匯款資訊：`server/content/payment.json`

---

## 流程摘要

```
Official Account Manager
  └─ 啟用 Messaging API
       ↓
Developers Console（同一 Provider）
  ├─ Messaging API Channel → Token、Webhook、Rich Menu
  └─ LINE Login Channel → Linked bots → 新增 LIFF
       ↓
server/.env + npm run create-rich-menu
```
