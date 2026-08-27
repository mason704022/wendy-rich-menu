import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { LoadError, apiErrorMessage } from "../components/LoadError";
import { RegisterForm, useMemberRegistered } from "../components/RegisterForm";
import { CoffeePickerSheet, type CoffeeItem } from "../components/CoffeePickerSheet";
import { PageShell } from "../components/PageShell";
import { SessionThumb } from "../components/SessionThumb";

interface Slot {
  slotDate: string;
  weekday: number;
  label: string;
  startTime: string;
  endTime: string;
  confirmedCount: number;
  waitlistCount: number;
  maxConfirmed: number;
  maxWaitlist: number;
  canBookConfirmed: boolean;
  canBookWaitlist: boolean;
  alreadyBooked: boolean;
  sessionTitle: string;
  sessionIntro: string;
  sessionImageUrl: string;
}

interface Booking {
  id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  coffee_name: string;
  can_cancel: boolean;
}

function todayIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fourWeeksLater(from: string) {
  const [y, m, d] = from.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 28);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function BookingPage() {
  const { registered, setRegistered, profile } = useMemberRegistered();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [coffeeMenu, setCoffeeMenu] = useState<{ title: string; items: CoffeeItem[] } | null>(
    null
  );
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAvailability = useCallback(() => {
    const from = todayIsoLocal();
    const to = fourWeeksLater(from);
    return Promise.all([
      api<{ slots: Slot[] }>(
        `/bookings/availability?from=${from}&to=${to}&lineUserId=${encodeURIComponent(profile.userId)}`
      ),
      api<{ bookings: Booking[] }>(`/bookings/user/${profile.userId}`),
    ]).then(([a, b]) => {
      setSlots(
        a.slots.filter((s) => (s.canBookConfirmed || s.canBookWaitlist) && !s.alreadyBooked)
      );
      setMyBookings(b.bookings);
    });
  }, [profile.userId]);

  const loadInitialData = useCallback(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      api<{ title: string; items: CoffeeItem[] }>("/bookings/coffee-menu"),
      loadAvailability(),
    ])
      .then(([menu]) => setCoffeeMenu(menu))
      .catch((err) => setLoadError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [loadAvailability]);

  function loadData() {
    return loadAvailability();
  }

  useEffect(() => {
    if (registered === null) return;
    if (!registered) {
      setLoading(false);
      return;
    }
    loadInitialData();
  }, [registered, loadInitialData]);

  function openCoffeePicker(slot: Slot) {
    setPendingSlot(slot);
    setError("");
  }

  async function confirmBook(coffeeItemId: string) {
    if (!pendingSlot) return;
    setBookingLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api<{ booking: Booking }>("/bookings/", {
        method: "POST",
        body: JSON.stringify({
          lineUserId: profile.userId,
          slotDate: pendingSlot.slotDate,
          startTime: pendingSlot.startTime,
          coffeeItemId,
        }),
      });
      const statusText =
        res.booking.status === "waitlist" ? "（備取）" : "（正取）";
      setSuccess(`預約成功${statusText}`);
      setPendingSlot(null);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "預約失敗";
      setError(msg === "ALREADY_BOOKED" ? "您已預約此時段" : msg);
    } finally {
      setBookingLoading(false);
    }
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    setCancelLoading(true);
    setError("");
    setSuccess("");
    try {
      await api(`/bookings/${pendingCancel.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ lineUserId: profile.userId }),
      });
      setSuccess("已取消預約");
      setPendingCancel(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消失敗");
    } finally {
      setCancelLoading(false);
    }
  }

  if (registered === null || loading) {
    return <div className="loading">載入中…</div>;
  }

  if (!registered) {
    return (
      <PageShell title="我要預約" leftAlign showMemberLink={false}>
        <p className="page-hint">請先完成會員註冊</p>
        <RegisterForm onRegistered={() => setRegistered(true)} />
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell title="我要預約" leftAlign>
        <LoadError message={loadError} onRetry={loadInitialData} />
      </PageShell>
    );
  }

  if (!coffeeMenu) {
    return (
      <PageShell title="我要預約" leftAlign>
        <LoadError onRetry={loadInitialData} />
      </PageShell>
    );
  }

  return (
    <PageShell title="我要預約" leftAlign>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <p className="page-hint">開課前 24 小時截止預約；開課前 24 小時內無法取消。</p>

      {myBookings.length > 0 && (
        <section className="info-card">
          <h2>近期預約</h2>
          {myBookings.map((b) => {
            return (
              <div className="slot-card" key={b.id}>
                <h3>
                  {b.slot_date} {b.start_time}-{b.end_time}
                </h3>
                <p className="slot-meta">
                  狀態：{b.status === "waitlist" ? "備取" : "正取"}
                  {!b.can_cancel && " · 開課前 24 小時內不可取消"}
                </p>
                {b.coffee_name && (
                  <p className="slot-meta">咖啡品項：{b.coffee_name}</p>
                )}
                <button
                  className="btn btn-outline"
                  disabled={!b.can_cancel}
                  onClick={() => setPendingCancel(b)}
                >
                  取消預約
                </button>
              </div>
            );
          })}
        </section>
      )}

      <section className="info-card">
        <h2>可預約時段（後四週）</h2>
        {slots.length === 0 && <p>近期無可預約時段</p>}
        {slots.map((slot) => (
          <div className="slot-card" key={`${slot.slotDate}-${slot.startTime}`}>
            <div className="slot-preview">
              {slot.sessionImageUrl ? (
                <SessionThumb src={slot.sessionImageUrl} />
              ) : (
                <div className="slot-thumb slot-thumb-placeholder" aria-hidden="true" />
              )}
              <div className="slot-preview-body">
                <h3>
                  {slot.slotDate}（{slot.label}）{slot.startTime}-{slot.endTime}
                </h3>
                {slot.sessionTitle ? (
                  <p className="slot-theme-title">{slot.sessionTitle}</p>
                ) : null}
                {slot.sessionIntro ? (
                  <p className="slot-intro">{slot.sessionIntro}</p>
                ) : null}
                <p className="slot-meta">
                  正取 {slot.confirmedCount}/{slot.maxConfirmed} · 備取{" "}
                  {slot.waitlistCount}/{slot.maxWaitlist}
                </p>
              </div>
            </div>
            <button className="btn btn-purple" onClick={() => openCoffeePicker(slot)}>
              {slot.canBookConfirmed ? "預約（正取）" : "預約（備取）"}
            </button>
          </div>
        ))}
      </section>

      <CoffeePickerSheet
        open={pendingSlot !== null}
        title={coffeeMenu.title}
        items={coffeeMenu.items}
        loading={bookingLoading}
        onClose={() => !bookingLoading && setPendingSlot(null)}
        onConfirm={confirmBook}
      />

      {pendingCancel && (
        <div
          className="sheet-overlay"
          onClick={() => !cancelLoading && setPendingCancel(null)}
        >
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <button
                type="button"
                className="sheet-close-btn"
                disabled={cancelLoading}
                onClick={() => setPendingCancel(null)}
              >
                關閉
              </button>
              <h2 className="sheet-title">取消預約</h2>
            </div>
            <div className="sheet-body">
              <p className="sheet-intro">確定要取消以下預約嗎？</p>
              <div className="slot-card">
                <h3>
                  {pendingCancel.slot_date} {pendingCancel.start_time}-
                  {pendingCancel.end_time}
                </h3>
                {pendingCancel.coffee_name && (
                  <p className="slot-meta">咖啡品項：{pendingCancel.coffee_name}</p>
                )}
              </div>
            </div>
            <div className="sheet-footer confirm-cancel-footer">
              <button
                type="button"
                className="btn btn-outline btn-lg"
                disabled={cancelLoading}
                onClick={() => setPendingCancel(null)}
              >
                返回
              </button>
              <button
                type="button"
                className="btn btn-purple btn-lg"
                disabled={cancelLoading}
                onClick={confirmCancel}
              >
                {cancelLoading ? "取消中…" : "確認取消"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
