import { useEffect, useState } from "react";
import { api, apiOptional, ApiError } from "../lib/api";
import { getProfile } from "../lib/liff";
import {
  MemberProfileFieldsForm,
  emptyMemberProfileFields,
} from "./MemberProfileFieldsForm";
import { SITE_BRAND_TITLE } from "../lib/siteBrand";
import {
  validateMemberProfile,
  type AgeRange,
  type HsinchuDistrict,
  type Occupation,
} from "../lib/memberProfileOptions";

interface Props {
  onRegistered: () => void;
  onCancel?: () => void;
}

const LIFF_ID = import.meta.env.VITE_LIFF_ID ?? "";

function isValidLineUserId(id: string): boolean {
  return /^U[a-f0-9]{32}$/i.test(id.trim());
}

export function RegisterForm({ onRegistered, onCancel }: Props) {
  const profile = getProfile();
  const lineIdFromLiff = Boolean(LIFF_ID) && profile.userId !== "dev-user";
  const [lineUserId, setLineUserId] = useState(profile.userId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileFields, setProfileFields] = useState(emptyMemberProfileFields());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [duplicateMember, setDuplicateMember] = useState<{ name: string; phone: string } | null>(
    null
  );

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
    setLineUserId(profile.userId);
  }, [profile.userId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("請填寫姓名");
      return;
    }
    const lineId = lineUserId.trim();
    if (!lineId) {
      setError("請填寫 LINE ID");
      return;
    }
    if (!isValidLineUserId(lineId)) {
      setError("LINE ID 格式不正確（應為 U 開頭的一組英數）");
      return;
    }
    if (lineIdFromLiff && lineId !== profile.userId) {
      setError("LINE ID 須與目前登入的 LINE 帳號一致");
      return;
    }
    if (!phone.trim()) {
      setError("請填寫手機");
      return;
    }
    const profileError = validateMemberProfile(profileFields);
    if (profileError) {
      setError(profileError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/members/register", {
        method: "POST",
        body: JSON.stringify({
          lineUserId: lineId,
          displayName: profile.displayName,
          name,
          phone,
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
        }),
      });
      onRegistered();
    } catch (err) {
      if (err instanceof ApiError && err.code === "PHONE_ALREADY_REGISTERED") {
        setDuplicateMember(
          err.existingMember ?? { name: "其他會員", phone }
        );
        setError("");
      } else {
        setError(err instanceof Error ? err.message : "註冊失敗");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="purchase-page register-page">
      <p className="site-brand-title">{SITE_BRAND_TITLE}</p>
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
        <p>以下欄位皆為必填。</p>
        {error && <div className="error-box">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>
              LINE ID <span className="field-required">（必填）</span>
            </label>
            <input
              value={lineUserId}
              onChange={(e) => setLineUserId(e.target.value.trim())}
              required
              readOnly={lineIdFromLiff}
              className={lineIdFromLiff ? "input-readonly" : undefined}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="slot-meta">
              {lineIdFromLiff
                ? "已由 LINE 自動帶入，與您登入的帳號綁定。"
                : "請貼上您的 LINE User ID（開發測試可手動輸入）。"}
            </p>
          </div>
          <div className="form-group">
            <label>
              姓名 <span className="field-required">（必填）</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <MemberProfileFieldsForm
            value={profileFields}
            onChange={setProfileFields}
            idPrefix="reg"
            required
          />

          <div className="form-group">
            <label>
              手機 <span className="field-required">（必填）</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              placeholder="09xxxxxxxx"
            />
          </div>
          <button
            className="btn btn-purple btn-lg"
            type="submit"
            disabled={
              loading ||
              !lineUserId.trim() ||
              !name.trim() ||
              !phone.trim() ||
              validateMemberProfile(profileFields) !== null
            }
          >
            {loading ? "處理中…" : "完成註冊"}
          </button>
        </form>
      </div>

      {duplicateMember && (
        <div className="sheet-overlay" onClick={() => setDuplicateMember(null)}>
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <button
                type="button"
                className="sheet-close-btn"
                onClick={() => setDuplicateMember(null)}
              >
                關閉
              </button>
              <h2 className="sheet-title">重複註冊</h2>
            </div>
            <div className="sheet-body">
              <p className="sheet-intro">此手機號碼已被註冊，無法重複建立會員。</p>
              <div className="slot-card">
                <h3>{duplicateMember.name}</h3>
                <p className="slot-meta">手機：{duplicateMember.phone}</p>
              </div>
              <p className="slot-meta">
                若這是您的帳號，請使用當初註冊的 LINE 帳號登入；若手機填錯，請修改後再試。
              </p>
            </div>
            <div className="sheet-footer confirm-cancel-footer">
              <button
                type="button"
                className="btn btn-purple"
                onClick={() => setDuplicateMember(null)}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
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
