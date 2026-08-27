# Google Sheets 同步設定

本專案會將 **預約** 與 **匯款訂單** 自動同步到 Google 試算表，方便查看與分析。資料為單向同步（SQLite → Sheet），請勿在 Sheet 手動改狀態。

---

## 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案（例如 `Wendy Studio`）
3. 左側 **API 和服務** → **程式庫** → 搜尋 **Google Sheets API** → **啟用**

---

## 2. 建立 Service Account

1. **API 和服務** → **憑證** → **建立憑證** → **Service Account**
2. 建立帳號（例如 `wendy-sheets-sync`）
3. 進入該 Service Account → **金鑰** → **新增金鑰** → **JSON**
4. 下載 JSON 檔，放到：

```
server/credentials/google-service-account.json
```

> 此檔案已在 `.gitignore`，請勿 commit 到 Git。

---

## 3. 建立 Google 試算表

1. 前往 [Google Sheets](https://sheets.google.com/) 建立新試算表
2. 建立兩個工作表（分頁）：
   - `預約`
   - `匯款訂單`
3. 複製試算表 ID（網址中 `/d/` 與 `/edit` 之間的字串）  
   例：`https://docs.google.com/spreadsheets/d/1ABC...xyz/edit` → ID 為 `1ABC...xyz`
4. 點 **共用**，加入 Service Account 的 email（JSON 內的 `client_email`），權限選 **編輯者**

---

## 4. 設定 server/.env

在 [`server/.env`](../server/.env) 新增：

```env
GOOGLE_SHEETS_SPREADSHEET_ID=你的試算表ID
GOOGLE_SERVICE_ACCOUNT_JSON=./credentials/google-service-account.json
GOOGLE_SHEETS_BOOKINGS_TAB=預約
GOOGLE_SHEETS_PURCHASES_TAB=匯款訂單
# 選填：管理頁顯示「在 Google Sheet 查看」連結
GOOGLE_SHEETS_URL=https://docs.google.com/spreadsheets/d/你的試算表ID/edit
```

未設定上述變數時，系統仍可正常運作，只是不會同步到 Sheet。

---

## 5. 回填既有資料

設定完成後，在 `server` 目錄執行：

```bash
npm run sync-to-sheets
```

會將資料庫中所有預約與匯款訂單寫入試算表。

---

## 6. 試算表欄位

### 預約分頁

| 預約編號 | 會員姓名 | 手機 | 日期 | 星期 | 時段 | 狀態 | 咖啡品項 | 建立時間 | 更新時間 |

### 匯款訂單分頁

| 訂單編號 | 會員姓名 | 手機 | 匯款人 | 後五碼 | 堂數 | 金額 | 狀態 | 建立時間 | 確認時間 |

---

## 7. 手機管理頁

管理員可在 LINE 內開啟 LIFF 管理頁：

```
https://liff.line.me/{LIFF_ID}?page=admin
```

需設定 `ADMIN_LINE_USER_ID`（您的 LINE User ID）。管理頁可確認匯款、查看近期預約；確認後會同步更新 Sheet 並通知會員。

---

## 疑難排解

| 問題 | 解法 |
|------|------|
| `The caller does not have permission` | 確認試算表已共用給 Service Account email |
| 同步沒有資料 | 檢查 `.env` 的 `GOOGLE_SHEETS_SPREADSHEET_ID` 與分頁名稱 |
| 管理頁顯示無權限 | 確認 `ADMIN_LINE_USER_ID` 為您的 LINE User ID |
