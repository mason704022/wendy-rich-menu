# Wendy LINE Rich Menu 互動系統

Wendy 工作室 LINE 官方帳號 Rich Menu + LIFF 預約／購課系統。

## 功能

| Rich Menu 格 | 功能 |
|-------------|------|
| ① 大圖（左） | 跳轉 Instagram |
| ② 大圖（右） | 跳轉 Instagram |
| ③ 課程資訊 | LIFF 課程說明 |
| ④ 購買課程 | 註冊 → 注意事項 → 手動匯款 |
| ⑤ 我要預約 | 日曆（週三/五/六，8+2 名額） |
| ⑥ 會員資訊 | 堂數查詢 |

## 快速開始

### 1. 安裝

```bash
npm run install:all
```

### 2. 設定環境變數

```bash
copy server\.env.example server\.env
copy liff\.env.example liff\.env
```

填入 LINE 憑證與 LIFF ID。本專案需 **兩個 Channel**（同一 Provider）：

- **Messaging API** → Channel Secret、Access Token、Webhook、Rich Menu
- **LINE Login** → LIFF App（**不可**加在 Messaging API Channel）

詳見 [docs/LINE_SETUP.md](docs/LINE_SETUP.md)。

編輯 `server/content/payment.json`、`courses.json`、`terms.json`。

### 3. 開發模式

```bash
# 終端 1
npm run dev:server

# 終端 2
npm run dev:liff
```

LIFF 開發時 Vite 會 proxy `/api` 到 `localhost:3000`。

未設定 `VITE_LIFF_ID` 時，前端使用 `dev-user` 測試帳號。

### 4. 建置與生產

```bash
npm run build
cd server && npm run dev
```

Server 會提供 `liff/dist` 靜態檔。

### 5. 建立 Rich Menu

```bash
npm run create-rich-menu
```

需先在 `server/.env` 設定 token，並確認 `line-rich-menu-wendy-yunspa-style.png` 在專案根目錄。

### 6. 確認付款（管理員）

```bash
npm run confirm-purchase -- 1
```

## 預約規則

- **週三** 09:00–11:00
- **週五** 19:00–21:00
- **週六** 09:00–11:00
- 每堂正取 8 人、備取 2 人
- **正取**才扣堂數；備取不扣，遞補時再扣

## 部署

**正式上線 + 換新 LINE 官方帳號**（建議順序）：

1. [`docs/LINE_ACCOUNT_MIGRATION.md`](docs/LINE_ACCOUNT_MIGRATION.md) — 完整 SOP（Phase 1–7）
2. [`docs/RAILWAY_CHECKLIST.md`](docs/RAILWAY_CHECKLIST.md) — Railway Volume 與變數
3. [`scripts/railway-env.template.env`](scripts/railway-env.template.env) — Railway Variables 範本
4. [`docs/DEPLOY.md`](docs/DEPLOY.md) — 部署概覽

GitHub：`https://github.com/mason704022/wendy-rich-menu`（連接 Railway 部署）

部署後驗證：

```bash
BASE_URL=https://你的-railway-網域 npm run verify-deploy
```

## 專案結構

```
Rich Menu/
├── line-rich-menu-wendy-yunspa-style.png
├── server/          # Express API + Webhook + Rich Menu 腳本
├── liff/            # React LIFF 前端
├── docs/
└── reference picture/
```
