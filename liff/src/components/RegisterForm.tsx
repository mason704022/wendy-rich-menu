import { useEffect, useState } from "react";
import { api, apiOptional } from "../lib/api";
import { getProfile } from "../lib/liff";

interface Props {
  onRegistered: () => void;
  onCancel?: () => void;
}

export function RegisterForm({ onRegistered, onCancel }: Props) {
  const profile = getProfile();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    apiOptional<{ registered: boolean; member?: { name: string; phone: string } }>(
      `/members/${profile.userId}`
    ).then((data) => {
      if (data?.registered && data.member) {
        setName(data.member.name);
        setPhone(data.member.phone);
      }
    });
  }, [profile.userId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendOtp() {
    if (!phone.trim()) {
      setError("請先填寫手機號碼");
      return;
    }
    setSendingOtp(true);
    setError("");
    try {
      const res = await api<{ ok: boolean; devCode?: string }>("/members/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setOtpSent(true);
      setCooldown(60);
      if (res.devCode) setDevCode(res.devCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發送失敗");
    } finally {
      setSendingOtp(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!otpSent || otpCode.length !== 6) {
      setError("請先完成手機簡訊驗證");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/members/register", {
        method: "POST",
        body: JSON.stringify({
          lineUserId: profile.userId,
          displayName: profile.displayName,
          name,
          phone,
          otpCode,
        }),
      });
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "註冊失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="purchase-page register-page">
      <header className="purchase-header">
        {onCancel ? (
          <button type="button" className="plan-back" onClick={onCancel}>
            返回
          </button>
        ) : (
          <span className="header-spacer" />
        )}
        <h1 className="purchase-page-title">會員註冊</h1>
        <span className="header-spacer" />
      </header>

      <div className="register-card">
        <h2>填寫資料</h2>
        <p>請填寫姓名與手機，並完成簡訊驗證後即可繼續購課。</p>
        {error && <div className="error-box">{error}</div>}
        {devCode && (
          <div className="dev-otp-hint">【開發模式】驗證碼：{devCode}</div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>姓名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>手機</label>
            <div className="phone-row">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                placeholder="09xxxxxxxx"
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={sendingOtp || cooldown > 0}
                onClick={sendOtp}
              >
                {cooldown > 0 ? `${cooldown}s` : sendingOtp ? "發送中…" : "發送驗證碼"}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>簡訊驗證碼</label>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              inputMode="numeric"
              placeholder="6 位數驗證碼"
              maxLength={6}
            />
          </div>
          <button
            className="btn btn-purple btn-lg"
            type="submit"
            disabled={loading || !otpSent || otpCode.length !== 6}
          >
            {loading ? "處理中…" : "完成註冊"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function useMemberRegistered() {
  const profile = getProfile();
  const [registered, setRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    apiOptional<{ registered: boolean }>(`/members/${profile.userId}`)
      .then((d) => setRegistered(d?.registered ?? false))
      .catch(() => setRegistered(false));
  }, [profile.userId]);

  return { registered, setRegistered, profile };
}
