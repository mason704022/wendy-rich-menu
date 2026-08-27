#!/usr/bin/env node
/**
 * 部署驗證腳本
 * 用法：BASE_URL=https://your-app.up.railway.app npm run verify-deploy
 */

const baseUrl = (process.env.BASE_URL ?? process.argv[2] ?? "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("請設定 BASE_URL 環境變數或傳入網域參數");
  console.error("例：BASE_URL=https://wendy.up.railway.app npm run verify-deploy");
  process.exit(1);
}

const checks = [
  {
    name: "Health",
    url: `${baseUrl}/health`,
    method: "GET",
    expectStatus: 200,
    expectBodyIncludes: "ok",
  },
  {
    name: "Webhook",
    url: `${baseUrl}/webhook/line`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: [] }),
    expectStatus: 200,
    expectBodyIncludes: "ok",
  },
  {
    name: "LIFF index",
    url: `${baseUrl}/`,
    method: "GET",
    expectStatus: 200,
    expectBodyIncludes: "html",
  },
  {
    name: "API coffee menu",
    url: `${baseUrl}/api/bookings/coffee-menu`,
    method: "GET",
    expectStatus: 200,
  },
];

async function runCheck(check) {
  const res = await fetch(check.url, {
    method: check.method,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(check.headers ?? {}),
    },
    body: check.body,
  });
  const text = await res.text();
  const okStatus = res.status === check.expectStatus;
  const okBody = check.expectBodyIncludes
    ? text.toLowerCase().includes(check.expectBodyIncludes.toLowerCase())
    : true;
  return { ok: okStatus && okBody, status: res.status, snippet: text.slice(0, 120) };
}

async function main() {
  console.log(`驗證部署：${baseUrl}\n`);
  let failed = 0;

  for (const check of checks) {
    try {
      const result = await runCheck(check);
      if (result.ok) {
        console.log(`✓ ${check.name}`);
      } else {
        failed++;
        console.log(`✗ ${check.name} (HTTP ${result.status})`);
        console.log(`  ${result.snippet}`);
      }
    } catch (err) {
      failed++;
      console.log(`✗ ${check.name}`);
      console.log(`  ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("");
  if (failed === 0) {
    console.log("全部通過。請繼續 LINE Webhook Verify 與 LIFF 實機驗收。");
    process.exit(0);
  } else {
    console.log(`${failed} 項失敗，請檢查 Railway 部署與環境變數。`);
    process.exit(1);
  }
}

main();
