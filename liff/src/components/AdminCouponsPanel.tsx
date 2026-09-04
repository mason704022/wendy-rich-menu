import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { PlanCategory } from "./PlanSelector";

interface CouponTemplate {
  id: number;
  name: string;
  discount_type: "fixed" | "percent";
  discount_value: number;
  plan_ids: string;
  expires_at: string | null;
  note: string;
  created_at: string;
}

interface CouponAssignment {
  id: number;
  template_id: number;
  line_user_id: string;
  status: "available" | "reserved" | "used" | "expired";
  assigned_at: string;
  used_at: string | null;
  purchase_id: number | null;
  template_name: string;
  discount_type: "fixed" | "percent";
  discount_value: number;
  expires_at: string | null;
}

interface MemberSearchResult {
  line_user_id: string;
  name: string;
  phone: string;
  display_name: string;
  total_sessions: number;
  has_confirmed_purchase: boolean;
}

interface Props {
  adminQuery: string;
  onMessage: (msg: { error?: string; success?: string }) => void;
}

function parsePlanIds(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function formatDiscountType(type: string, value: number): string {
  return type === "fixed" ? `NT$${value}` : `${value}%`;
}

function statusLabel(status: CouponAssignment["status"]): string {
  if (status === "available") return "可用";
  if (status === "reserved") return "已保留";
  if (status === "used") return "已使用";
  return "已過期";
}

export function AdminCouponsPanel({ adminQuery, onMessage }: Props) {
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [assignments, setAssignments] = useState<CouponAssignment[]>([]);
  const [plans, setPlans] = useState<PlanCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const [assignTemplateId, setAssignTemplateId] = useState<number | "">("");
  const [memberQuery, setMemberQuery] = useState("");
  const [onlyWithPurchase, setOnlyWithPurchase] = useState(true);
  const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    onMessage({});
    try {
      const [tplRes, assignRes, planRes] = await Promise.all([
        api<{ templates: CouponTemplate[] }>(`/admin/coupons/templates?${adminQuery}`),
        api<{ assignments: CouponAssignment[] }>(`/admin/coupons/assignments?${adminQuery}`),
        api<{ categories: PlanCategory[] }>("/purchases/plans"),
      ]);
      setTemplates(tplRes.templates);
      setAssignments(assignRes.assignments);
      setPlans(planRes.categories);
      setAssignTemplateId((prev) =>
        prev !== "" ? prev : tplRes.templates[0]?.id ?? ""
      );
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "載入失敗" });
    } finally {
      setLoading(false);
    }
  }, [adminQuery, onMessage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!memberQuery.trim()) {
      setMemberResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ members: MemberSearchResult[] }>(
        `/admin/members/search?${adminQuery}&q=${encodeURIComponent(memberQuery)}&onlyWithPurchase=${onlyWithPurchase}`
      )
        .then((res) => setMemberResults(res.members))
        .catch(() => setMemberResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [memberQuery, onlyWithPurchase, adminQuery]);

  async function createTemplate() {
    const value = Number(discountValue);
    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      onMessage({ error: "請填寫券名稱與有效折扣數值" });
      return;
    }
    setSaving(true);
    onMessage({});
    try {
      await api(`/admin/coupons/templates?${adminQuery}`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          discountType,
          discountValue: value,
          planIds: selectedPlanIds,
          expiresAt: expiresAt || null,
          note: note.trim(),
        }),
      });
      setName("");
      setDiscountValue("");
      setExpiresAt("");
      setSelectedPlanIds([]);
      setNote("");
      onMessage({ success: "折扣券已建立" });
      await loadData();
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "建立失敗" });
    } finally {
      setSaving(false);
    }
  }

  async function assignCoupon() {
    if (!assignTemplateId || !selectedMemberId) {
      onMessage({ error: "請選擇券模板與會員" });
      return;
    }
    setSaving(true);
    onMessage({});
    try {
      await api(`/admin/coupons/assignments?${adminQuery}`, {
        method: "POST",
        body: JSON.stringify({
          templateId: assignTemplateId,
          lineUserId: selectedMemberId,
        }),
      });
      setSelectedMemberId("");
      setMemberQuery("");
      onMessage({ success: "已指派折扣券，並已通知會員" });
      await loadData();
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "指派失敗" });
    } finally {
      setSaving(false);
    }
  }

  async function revokeAssignment(id: number) {
    setSaving(true);
    onMessage({});
    try {
      await api(`/admin/coupons/assignments/${id}?${adminQuery}`, {
        method: "DELETE",
      });
      onMessage({ success: "已撤回折扣券" });
      await loadData();
    } catch (err) {
      onMessage({ error: err instanceof Error ? err.message : "撤回失敗" });
    } finally {
      setSaving(false);
    }
  }

  const allPlans = plans.flatMap((c) => c.plans);

  if (loading) {
    return <div className="loading">載入折扣券…</div>;
  }

  return (
    <div className="admin-coupons">
      <section className="info-card">
        <h3>建立折扣券</h3>
        <div className="admin-form-grid">
          <label>
            券名稱
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="舊生回饋 500 元" />
          </label>
          <label>
            折扣類型
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "fixed" | "percent")}
            >
              <option value="fixed">固定金額</option>
              <option value="percent">百分比</option>
            </select>
          </label>
          <label>
            {discountType === "fixed" ? "折抵金額（NT$）" : "折扣百分比（1–100）"}
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              min={1}
            />
          </label>
          <label>
            到期日（選填）
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        </div>
        {allPlans.length > 0 && (
          <div className="coupon-plan-checkboxes">
            <p className="slot-meta">適用方案（不勾 = 全部適用）</p>
            {allPlans.map((plan) => (
              <label key={plan.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedPlanIds.includes(plan.id)}
                  onChange={(e) => {
                    setSelectedPlanIds((prev) =>
                      e.target.checked
                        ? [...prev, plan.id]
                        : prev.filter((id) => id !== plan.id)
                    );
                  }}
                />
                {plan.name}
              </label>
            ))}
          </div>
        )}
        <label>
          備註
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-purple"
          disabled={saving}
          onClick={createTemplate}
        >
          建立券模板
        </button>
      </section>

      <section className="info-card">
        <h3>指派給會員</h3>
        <div className="admin-form-grid">
          <label>
            券模板
            <select
              value={assignTemplateId}
              onChange={(e) =>
                setAssignTemplateId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">請選擇</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{formatDiscountType(t.discount_type, t.discount_value)}）
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyWithPurchase}
              onChange={(e) => setOnlyWithPurchase(e.target.checked)}
            />
            僅顯示曾購課會員（舊生）
          </label>
        </div>
        <label>
          搜尋會員（姓名 / 電話）
          <input
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder="輸入姓名或電話"
          />
        </label>
        {memberResults.length > 0 && (
          <div className="member-search-results">
            {memberResults.map((m) => (
              <button
                key={m.line_user_id}
                type="button"
                className={`member-search-item ${selectedMemberId === m.line_user_id ? "selected" : ""}`}
                onClick={() => setSelectedMemberId(m.line_user_id)}
              >
                <strong>{m.name || m.display_name}</strong>
                <span className="slot-meta">
                  {m.phone}
                  {m.has_confirmed_purchase ? " · 舊生" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn btn-purple"
          disabled={saving || !assignTemplateId || !selectedMemberId}
          onClick={assignCoupon}
        >
          指派折扣券
        </button>
      </section>

      <section className="info-card">
        <h3>券模板列表</h3>
        {templates.length === 0 && <p>尚無券模板</p>}
        {templates.map((t) => (
          <div className="slot-card" key={t.id}>
            <h4>{t.name}</h4>
            <p className="slot-meta">
              {formatDiscountType(t.discount_type, t.discount_value)}
              {t.expires_at ? ` · 至 ${t.expires_at.slice(0, 10)}` : ""}
            </p>
            <p className="slot-meta">
              適用：
              {parsePlanIds(t.plan_ids).length === 0
                ? "全部方案"
                : parsePlanIds(t.plan_ids).join("、")}
            </p>
          </div>
        ))}
      </section>

      <section className="info-card">
        <h3>指派紀錄</h3>
        {assignments.length === 0 && <p>尚無指派紀錄</p>}
        {assignments.map((a) => (
          <div className="slot-card" key={a.id}>
            <h4>{a.template_name}</h4>
            <p className="slot-meta">
              會員 ID：{a.line_user_id.slice(0, 8)}… · {statusLabel(a.status)}
            </p>
            <p className="slot-meta">
              指派：{a.assigned_at}
              {a.purchase_id ? ` · 訂單 #${a.purchase_id}` : ""}
            </p>
            {a.status === "available" && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => revokeAssignment(a.id)}
              >
                撤回
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
