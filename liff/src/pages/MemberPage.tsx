import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { LoadError, apiErrorMessage } from "../components/LoadError";
import { RegisterForm, useMemberRegistered } from "../components/RegisterForm";
import { PageShell } from "../components/PageShell";
import type { AvailableCoupon } from "../components/CouponPicker";

interface Summary {
  name: string;
  phone: string;
  totalSessions: number;
  remainingSessions: number;
  memberSince: string;
}

interface Booking {
  id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  coffee_name: string;
}

export function MemberPage() {
  const { registered, setRegistered, profile } = useMemberRegistered();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [name, setName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [myCoupons, setMyCoupons] = useState<AvailableCoupon[]>([]);

  const loadMemberData = useCallback(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      api<Summary>(`/members/${profile.userId}/summary`),
      api<{ bookings: Booking[] }>(`/bookings/user/${profile.userId}`),
    ])
      .then(([s, b]) => {
        setSummary(s);
        setName(s.name);
        setBookings(b.bookings.slice(0, 5));
      })
      .catch((err) => setLoadError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [profile.userId]);

  useEffect(() => {
    if (registered !== true) return;
    api<{ coupons: AvailableCoupon[] }>(`/purchases/coupons/${profile.userId}`)
      .then((res) => setMyCoupons(res.coupons))
      .catch(() => setMyCoupons([]));
  }, [registered, profile.userId]);

  useEffect(() => {
    if (registered === null) return;
    if (!registered) {
      setLoading(false);
      return;
    }
    loadMemberData();
  }, [registered, loadMemberData]);

  async function saveName() {
    if (!name.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await api(`/members/${profile.userId}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setMessage("姓名已更新");
      if (summary) setSummary({ ...summary, name: name.trim() });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  if (registered === null || loading) {
    return <div className="loading">載入中…</div>;
  }

  if (!registered) {
    return (
      <PageShell title="會員資訊" leftAlign showMemberLink={false}>
        <p className="page-hint">請先完成會員註冊</p>
        <p className="slot-meta">您的 LINE ID：{profile.userId}</p>
        <RegisterForm onRegistered={() => setRegistered(true)} />
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell title="會員資訊" leftAlign showMemberLink={false}>
        <LoadError message={loadError} onRetry={loadMemberData} />
      </PageShell>
    );
  }

  return (
    <PageShell title="會員資訊" leftAlign showMemberLink={false}>
      {message && (
        <div className={message.includes("已更新") ? "success-box" : "error-box"}>
          {message}
        </div>
      )}

      {summary && (
        <section className="info-card">
          <div className="form-group">
            <label>姓名</label>
            <div className="phone-row">
              <input value={name} onChange={(e) => setName(e.target.value)} />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={saving || name.trim() === summary.name}
                onClick={saveName}
              >
                {saving ? "儲存中…" : "儲存"}
              </button>
            </div>
          </div>
          <p>手機：{summary.phone}</p>
          <p>
            <strong>已購買堂數：</strong>
            {summary.totalSessions} 堂
          </p>
          <p>
            <strong>剩餘堂數：</strong>
            {summary.remainingSessions} 堂
          </p>
          <p className="slot-meta">加入日期：{summary.memberSince.slice(0, 10)}</p>
          <p className="slot-meta">LINE ID：{profile.userId}</p>
        </section>
      )}

      {myCoupons.length > 0 && (
        <section className="info-card coupon-member-card">
          <h2>我的折扣券</h2>
          {myCoupons.map((c) => (
            <div className="slot-card" key={c.id}>
              <h3>{c.templateName}</h3>
              <p className="slot-meta">
                {c.discountType === "fixed"
                  ? `折 NT$${c.discountValue.toLocaleString()}`
                  : `${c.discountValue}% 折扣`}
                {c.expiresAt ? ` · 有效至 ${c.expiresAt.slice(0, 10)}` : " · 無期限"}
              </p>
              <p className="slot-meta">請至購買課程頁選用</p>
            </div>
          ))}
        </section>
      )}

      {bookings.length > 0 && (
        <section className="info-card">
          <h2>近期預約</h2>
          {bookings.map((b) => (
            <div className="slot-card" key={b.id}>
              <h3>
                {b.slot_date} {b.start_time}-{b.end_time}
              </h3>
              <p className="slot-meta">
                {b.status === "waitlist" ? "備取" : "正取"}
                {b.coffee_name && ` · 咖啡：${b.coffee_name}`}
              </p>
            </div>
          ))}
        </section>
      )}
    </PageShell>
  );
}
