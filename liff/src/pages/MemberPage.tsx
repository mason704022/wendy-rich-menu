import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { LoadError, apiErrorMessage } from "../components/LoadError";
import { RegisterForm, useMemberRegistered } from "../components/RegisterForm";
import {
  MemberProfileFieldsForm,
  emptyMemberProfileFields,
} from "../components/MemberProfileFieldsForm";
import {
  validateMemberProfile,
  type AgeRange,
  type HsinchuDistrict,
  type Occupation,
  type MemberProfileFields,
} from "../lib/memberProfileOptions";
import { PageShell } from "../components/PageShell";
import type { AvailableCoupon } from "../components/CouponPicker";

interface Summary {
  name: string;
  phone: string;
  totalSessions: number;
  remainingSessions: number;
  memberSince: string;
  ageLabel: string;
  occupationLabel: string;
  residenceLabel: string;
  ageRange: string;
  occupation: string;
  occupationOther: string;
  residenceKind: string;
  residenceDistrict: string;
  residenceOther: string;
}

function summaryToProfileFields(s: Summary): MemberProfileFields {
  return {
    ageRange: (s.ageRange || "") as MemberProfileFields["ageRange"],
    occupation: (s.occupation || "") as MemberProfileFields["occupation"],
    occupationOther: s.occupationOther ?? "",
    residenceKind: (s.residenceKind || "") as MemberProfileFields["residenceKind"],
    residenceDistrict: (s.residenceDistrict || "") as MemberProfileFields["residenceDistrict"],
    residenceOther: s.residenceOther ?? "",
  };
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
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [profileFields, setProfileFields] = useState(emptyMemberProfileFields());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [myCoupons, setMyCoupons] = useState<AvailableCoupon[]>([]);
  const [editing, setEditing] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);

  const phoneChanged =
    phone.replace(/\D/g, "") !== originalPhone.replace(/\D/g, "");

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
        setPhone(s.phone);
        setOriginalPhone(s.phone);
        setProfileFields(summaryToProfileFields(s));
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

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function resetEditForm() {
    if (!summary) return;
    setName(summary.name);
    setPhone(summary.phone);
    setOriginalPhone(summary.phone);
    setProfileFields(summaryToProfileFields(summary));
    setOtpCode("");
    setOtpSent(false);
    setDevCode("");
  }

  function startEdit() {
    resetEditForm();
    setEditing(true);
    setMessage("");
  }

  function cancelEdit() {
    resetEditForm();
    setEditing(false);
    setMessage("");
  }

  async function sendOtp() {
    if (!phone.trim()) {
      setMessage("請先填寫手機號碼");
      return;
    }
    setSendingOtp(true);
    setMessage("");
    try {
      const res = await api<{ ok: boolean; devCode?: string }>("/members/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setOtpSent(true);
      setCooldown(60);
      if (res.devCode) setDevCode(res.devCode);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "發送失敗");
    } finally {
      setSendingOtp(false);
    }
  }

  async function saveDetails() {
    if (!name.trim()) {
      setMessage("請填寫姓名");
      return;
    }
    const profileError = validateMemberProfile(profileFields);
    if (profileError) {
      setMessage(profileError);
      return;
    }
    if (phoneChanged && (!otpSent || otpCode.length !== 6)) {
      setMessage("變更手機請先完成簡訊驗證");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim(),
        profile: {
          ageRange: profileFields.ageRange as AgeRange,
          occupation: profileFields.occupation as Occupation,
          occupationOther: profileFields.occupationOther,
          residenceKind: profileFields.residenceKind as "hsinchu" | "other",
          residenceDistrict:
            profileFields.residenceKind === "hsinchu"
              ? (profileFields.residenceDistrict as HsinchuDistrict)
              : undefined,
          residenceOther: profileFields.residenceOther,
        },
      };
      if (phoneChanged) body.otpCode = otpCode;

      const res = await api<{
        profile: { ageLabel: string; occupationLabel: string; residenceLabel: string };
        member: { name: string; phone: string };
      }>(`/members/${profile.userId}/details`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      setMessage("會員資料已更新");
      setEditing(false);
      if (summary) {
        setSummary({
          ...summary,
          name: res.member.name,
          phone: res.member.phone,
          ageLabel: res.profile.ageLabel,
          occupationLabel: res.profile.occupationLabel,
          residenceLabel: res.profile.residenceLabel,
          ageRange: profileFields.ageRange,
          occupation: profileFields.occupation,
          occupationOther: profileFields.occupationOther,
          residenceKind: profileFields.residenceKind,
          residenceDistrict: profileFields.residenceDistrict,
          residenceOther: profileFields.residenceOther,
        });
        setOriginalPhone(res.member.phone);
      }
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
        <p className="page-hint">請先完成會員註冊（以下欄位皆為必填）</p>
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

  const headerAction = editing ? (
    <button type="button" className="header-text-btn" onClick={cancelEdit} disabled={saving}>
      取消
    </button>
  ) : (
    <button type="button" className="header-text-btn" onClick={startEdit}>
      編輯
    </button>
  );

  return (
    <PageShell
      title="會員資訊"
      leftAlign
      showMemberLink={false}
      headerAction={headerAction}
    >
      {message && (
        <div className={message.includes("已更新") ? "success-box" : "error-box"}>
          {message}
        </div>
      )}

      {summary && (
        <section className="info-card">
          {!editing ? (
            <dl className="member-info-dl">
              <div>
                <dt>姓名</dt>
                <dd>{summary.name}</dd>
              </div>
              <div>
                <dt>手機</dt>
                <dd>{summary.phone}</dd>
              </div>
              <div>
                <dt>年齡</dt>
                <dd>{summary.ageLabel || "—"}</dd>
              </div>
              <div>
                <dt>職業</dt>
                <dd>{summary.occupationLabel || "—"}</dd>
              </div>
              <div>
                <dt>居住地</dt>
                <dd>{summary.residenceLabel || "—"}</dd>
              </div>
            </dl>
          ) : (
            <div className="member-profile-edit">
              {devCode && (
                <div className="dev-otp-hint">【開發模式】驗證碼：{devCode}</div>
              )}
              <div className="form-group">
                <label>
                  姓名 <span className="field-required">（必填）</span>
                </label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <MemberProfileFieldsForm
                value={profileFields}
                onChange={setProfileFields}
                idPrefix="member"
                required
              />
              <div className="form-group">
                <label>
                  手機 <span className="field-required">（必填）</span>
                </label>
                <div className="phone-row">
                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setOtpSent(false);
                      setOtpCode("");
                    }}
                    required
                    inputMode="tel"
                  />
                  {phoneChanged && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={sendingOtp || cooldown > 0}
                      onClick={sendOtp}
                    >
                      {cooldown > 0 ? `${cooldown}s` : sendingOtp ? "發送中…" : "驗證手機"}
                    </button>
                  )}
                </div>
                {phoneChanged && (
                  <p className="slot-meta">變更手機需重新簡訊驗證</p>
                )}
              </div>
              {phoneChanged && (
                <div className="form-group">
                  <label>
                    簡訊驗證碼 <span className="field-required">（必填）</span>
                  </label>
                  <input
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    maxLength={6}
                    required
                  />
                </div>
              )}
              <button
                type="button"
                className="btn btn-purple btn-lg"
                disabled={saving}
                onClick={saveDetails}
              >
                {saving ? "儲存中…" : "儲存會員資料"}
              </button>
            </div>
          )}

          <hr className="member-info-divider" />
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
              <p className="slot-meta">請至選擇我的課程頁選用</p>
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
                {b.coffee_name && ` · 飲品：${b.coffee_name}`}
              </p>
            </div>
          ))}
        </section>
      )}
    </PageShell>
  );
}
