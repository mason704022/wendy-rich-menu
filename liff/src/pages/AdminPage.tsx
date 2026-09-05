import { useEffect, useState } from "react";

import { api } from "../lib/api";

import { getProfile } from "../lib/liff";

import { PageShell } from "../components/PageShell";
import { AdminThemesPanel } from "../components/AdminThemesPanel";
import { AdminCouponsPanel } from "../components/AdminCouponsPanel";



interface PendingPurchase {

  id: number;

  payer_name: string;

  transfer_last5: string;

  sessions_count: number;

  amount: number;

  original_amount: number | null;

  discount_amount: number;

  coupon_name?: string;

  created_at: string;

  member_name: string;

  member_phone: string;

}



interface SessionAttendee {

  booking_id: number;

  member_name: string;

  member_phone: string;

  status: string;

  coffee_name: string;

}



interface BookingSession {

  slot_date: string;

  start_time: string;

  end_time: string;

  label: string;

  confirmed_count: number;

  waitlist_count: number;

  total_count: number;

  attendees: SessionAttendee[];

}



type Tab = "purchases" | "bookings" | "themes" | "coupons";

type BookingDayTab = 3 | 5 | 6;

const BOOKING_DAY_TABS: { weekday: BookingDayTab; label: string }[] = [
  { weekday: 3, label: "週三" },
  { weekday: 5, label: "週五" },
  { weekday: 6, label: "週六" },
];

function sessionWeekday(session: BookingSession): number {
  const [y, m, d] = session.slot_date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function matchesBookingDay(session: BookingSession, weekday: BookingDayTab): boolean {
  if (session.label) return session.label === BOOKING_DAY_TABS.find((t) => t.weekday === weekday)?.label;
  return sessionWeekday(session) === weekday;
}



export function AdminPage() {

  const profile = getProfile();

  const [tab, setTab] = useState<Tab>("purchases");

  const [bookingDayTab, setBookingDayTab] = useState<BookingDayTab>(3);

  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);

  const [purchases, setPurchases] = useState<PendingPurchase[]>([]);

  const [sessions, setSessions] = useState<BookingSession[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const [confirmPurchase, setConfirmPurchase] = useState<PendingPurchase | null>(null);

  const [rejectPurchase, setRejectPurchase] = useState<PendingPurchase | null>(null);



  const adminQuery = `lineUserId=${encodeURIComponent(profile.userId)}`;



  async function loadData() {

    setError("");

    const [check, pending, sessionData] = await Promise.all([

      api<{ ok: boolean; sheetsUrl: string | null }>(`/admin/check?${adminQuery}`),

      api<{ purchases: PendingPurchase[] }>(`/admin/purchases/pending?${adminQuery}`),

      api<{ sessions: BookingSession[] }>(

        `/admin/bookings/sessions?days=28&${adminQuery}`

      ),

    ]);

    setSheetsUrl(check.sheetsUrl);

    setPurchases(pending.purchases);

    setSessions(sessionData.sessions);

  }



  useEffect(() => {

    api<{ ok: boolean; sheetsUrl: string | null }>(`/admin/check?${adminQuery}`)

      .then((check) => {

        setAuthorized(true);

        setSheetsUrl(check.sheetsUrl);

        return loadData();

      })

      .catch((err) => {

        const msg = err instanceof Error ? err.message : "載入失敗";

        if (msg === "FORBIDDEN" || msg.includes("403")) {

          setAuthorized(false);

        } else if (msg === "ADMIN_NOT_CONFIGURED" || msg.includes("503")) {

          setError("後端尚未設定 ADMIN_LINE_USER_ID，請檢查 server/.env");

        } else if (msg.includes("404") || msg.includes("API 不存在")) {

          setError(
            "無法連線管理 API（HTTP 404）。請確認：1) server 已重啟 2) ngrok 指向 port 3000 3) LIFF Endpoint URL 與 ngrok 網址一致 4) 已執行 cd liff && npm run build"
          );

        } else {

          setError(msg);

        }

      })

      .finally(() => setLoading(false));

  }, [profile.userId]);



  async function confirmPurchaseAction() {

    if (!confirmPurchase) return;

    setActionLoading(true);

    setError("");

    setSuccess("");

    try {

      await api(`/admin/purchases/${confirmPurchase.id}/confirm`, {

        method: "POST",

        body: JSON.stringify({ lineUserId: profile.userId }),

      });

      setSuccess(`訂單 #${confirmPurchase.id} 已確認`);

      setConfirmPurchase(null);

      await loadData();

    } catch (err) {

      setError(err instanceof Error ? err.message : "確認失敗");

    } finally {

      setActionLoading(false);

    }

  }



  async function rejectPurchaseAction() {

    if (!rejectPurchase) return;

    setActionLoading(true);

    setError("");

    setSuccess("");

    try {

      await api(`/admin/purchases/${rejectPurchase.id}/reject`, {

        method: "POST",

        body: JSON.stringify({ lineUserId: profile.userId }),

      });

      setSuccess(`訂單 #${rejectPurchase.id} 已拒絕`);

      setRejectPurchase(null);

      await loadData();

    } catch (err) {

      setError(err instanceof Error ? err.message : "操作失敗");

    } finally {

      setActionLoading(false);

    }

  }



  if (loading) {

    return <div className="loading">載入中…</div>;

  }



  if (authorized === false) {

    return (

      <PageShell title="管理後台" leftAlign showMemberLink={false}>

        <div className="error-box">您沒有管理權限</div>

      </PageShell>

    );

  }



  return (

    <PageShell title="管理後台" leftAlign showMemberLink={false}>

      {error && <div className="error-box">{error}</div>}

      {success && <div className="success-box">{success}</div>}



      <div className="admin-tabs">

        <button

          type="button"

          className={`admin-tab admin-tab-with-count ${tab === "purchases" ? "active" : ""}`}

          onClick={() => setTab("purchases")}

        >

          待確認付款

          {purchases.length > 0 && (

            <span className="admin-tab-count">{purchases.length}</span>

          )}

        </button>

        <button

          type="button"

          className={`admin-tab ${tab === "themes" ? "active" : ""}`}

          onClick={() => setTab("themes")}

        >

          課程管理

        </button>

        <button

          type="button"

          className={`admin-tab ${tab === "coupons" ? "active" : ""}`}

          onClick={() => setTab("coupons")}

        >

          折扣券

        </button>

        <button

          type="button"

          className={`admin-tab ${tab === "bookings" ? "active" : ""}`}

          onClick={() => setTab("bookings")}

        >

          訂課資訊

        </button>

      </div>



      {tab === "purchases" && (

        <section className="info-card">

          {purchases.length === 0 && <p>目前沒有待確認付款</p>}

          {purchases.map((p) => (

            <div className="slot-card" key={p.id}>

              <h3>訂單 #{p.id}</h3>

              <p className="slot-meta">

                會員：{p.member_name} · {p.member_phone}

              </p>

              <p className="slot-meta">

                匯款人：{p.payer_name} · 後五碼 {p.transfer_last5}

              </p>

              <p className="slot-meta">

                {p.sessions_count} 堂 · 實付 NT${p.amount.toLocaleString()}

              </p>

              {(p.discount_amount ?? 0) > 0 && (

                <p className="slot-meta coupon-order-discount">

                  原價 NT${(p.original_amount ?? p.amount).toLocaleString()} → 折 NT$

                  {p.discount_amount.toLocaleString()}

                  {p.coupon_name ? ` · ${p.coupon_name}` : ""}

                </p>

              )}

              <p className="slot-meta">通知時間：{p.created_at}</p>

              <div className="admin-actions">

                <button

                  type="button"

                  className="btn btn-purple"

                  onClick={() => setConfirmPurchase(p)}

                >

                  確認匯款

                </button>

                <button

                  type="button"

                  className="btn btn-outline"

                  onClick={() => setRejectPurchase(p)}

                >

                  拒絕

                </button>

              </div>

            </div>

          ))}

        </section>

      )}



      {tab === "bookings" && (

        <section className="info-card">

          <div className="admin-tabs admin-sub-tabs">

            {BOOKING_DAY_TABS.map((day) => {

              const daySessions = sessions.filter((s) => matchesBookingDay(s, day.weekday));

              return (

                <button

                  key={day.weekday}

                  type="button"

                  className={`admin-tab ${bookingDayTab === day.weekday ? "active" : ""}`}

                  onClick={() => setBookingDayTab(day.weekday)}

                >

                  {day.label}

                  {daySessions.length > 0 && (

                    <span className="admin-badge">{daySessions.length}</span>

                  )}

                </button>

              );

            })}

          </div>

          {(() => {

            const daySessions = sessions.filter((s) => matchesBookingDay(s, bookingDayTab));

            const dayLabel = BOOKING_DAY_TABS.find((d) => d.weekday === bookingDayTab)?.label ?? "";

            if (daySessions.length === 0) {

              return <p>近四週沒有{dayLabel}的預約</p>;

            }

            return daySessions.map((session) => (

              <div

                className="slot-card admin-session-card"

                key={`${session.slot_date}-${session.start_time}`}

              >

                <h3>

                  {session.slot_date}（{session.label}）{session.start_time}-

                  {session.end_time}

                </h3>

                <p className="slot-meta">

                  正取 {session.confirmed_count} 人 · 備取 {session.waitlist_count} 人 · 共{" "}

                  {session.total_count} 人

                </p>

                <ul className="admin-roster">

                  {session.attendees.map((a) => (

                    <li key={a.booking_id}>

                      <strong>{a.member_name}</strong>

                      <span className="slot-meta">

                        {a.status === "waitlist" ? "備取" : "正取"}

                        {a.coffee_name && ` · ${a.coffee_name}`}

                      </span>

                    </li>

                  ))}

                </ul>

              </div>

            ));

          })()}

        </section>

      )}



      {tab === "themes" && (

        <AdminThemesPanel

          adminQuery={adminQuery}

          lineUserId={profile.userId}

          onMessage={({ error: err, success: ok }) => {

            if (err) {

              setError(err);

              setSuccess("");

            } else if (ok) {

              setSuccess(ok);

              setError("");

            } else {

              setError("");

              setSuccess("");

            }

          }}

        />

      )}



      {tab === "coupons" && (

        <AdminCouponsPanel

          adminQuery={adminQuery}

          onMessage={({ error: err, success: ok }) => {

            if (err) {

              setError(err);

              setSuccess("");

            } else if (ok) {

              setSuccess(ok);

              setError("");

            } else {

              setError("");

              setSuccess("");

            }

          }}

        />

      )}



      {sheetsUrl && (

        <p className="admin-sheets-link">

          <a href={sheetsUrl} target="_blank" rel="noreferrer">

            在 Google Sheet 查看完整資料

          </a>

        </p>

      )}



      {confirmPurchase && (

        <div

          className="sheet-overlay"

          onClick={() => !actionLoading && setConfirmPurchase(null)}

        >

          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>

            <div className="sheet-header">

              <button

                type="button"

                className="sheet-close-btn"

                disabled={actionLoading}

                onClick={() => setConfirmPurchase(null)}

              >

                關閉

              </button>

              <h2 className="sheet-title">確認匯款</h2>

            </div>

            <div className="sheet-body">

              <p className="sheet-intro">確定要確認以下匯款嗎？</p>

              <div className="slot-card">

                <h3>訂單 #{confirmPurchase.id}</h3>

                <p className="slot-meta">

                  {confirmPurchase.member_name} · 後五碼 {confirmPurchase.transfer_last5}

                </p>

                <p className="slot-meta">

                  {confirmPurchase.sessions_count} 堂 · 實付 NT$

                  {confirmPurchase.amount.toLocaleString()}

                </p>

                {(confirmPurchase.discount_amount ?? 0) > 0 && (

                  <p className="slot-meta">

                    原價 NT$

                    {(confirmPurchase.original_amount ?? confirmPurchase.amount).toLocaleString()}{" "}

                    → 折 NT${confirmPurchase.discount_amount.toLocaleString()}

                    {confirmPurchase.coupon_name

                      ? ` · ${confirmPurchase.coupon_name}`

                      : ""}

                  </p>

                )}

              </div>

            </div>

            <div className="sheet-footer confirm-cancel-footer">

              <button

                type="button"

                className="btn btn-outline btn-lg"

                disabled={actionLoading}

                onClick={() => setConfirmPurchase(null)}

              >

                返回

              </button>

              <button

                type="button"

                className="btn btn-purple btn-lg"

                disabled={actionLoading}

                onClick={confirmPurchaseAction}

              >

                {actionLoading ? "處理中…" : "確認"}

              </button>

            </div>

          </div>

        </div>

      )}



      {rejectPurchase && (

        <div

          className="sheet-overlay"

          onClick={() => !actionLoading && setRejectPurchase(null)}

        >

          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>

            <div className="sheet-header">

              <button

                type="button"

                className="sheet-close-btn"

                disabled={actionLoading}

                onClick={() => setRejectPurchase(null)}

              >

                關閉

              </button>

              <h2 className="sheet-title">拒絕匯款</h2>

            </div>

            <div className="sheet-body">

              <p className="sheet-intro">確定要拒絕訂單 #{rejectPurchase.id} 嗎？</p>

            </div>

            <div className="sheet-footer confirm-cancel-footer">

              <button

                type="button"

                className="btn btn-outline btn-lg"

                disabled={actionLoading}

                onClick={() => setRejectPurchase(null)}

              >

                返回

              </button>

              <button

                type="button"

                className="btn btn-purple btn-lg"

                disabled={actionLoading}

                onClick={rejectPurchaseAction}

              >

                {actionLoading ? "處理中…" : "確認拒絕"}

              </button>

            </div>

          </div>

        </div>

      )}

    </PageShell>

  );

}


