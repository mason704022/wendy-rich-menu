import { useState } from "react";
import { PageShell } from "./PageShell";
import { PaymentConfirmSheet } from "./PaymentConfirmSheet";

export interface Plan {
  id: string;
  name: string;
  description: string;
  durationLabel: string;
  sessionsCount: number;
  price: number;
}

export interface PlanCategory {
  id: string;
  label: string;
  plans: Plan[];
}

export interface PaymentInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  note: string;
}

interface Props {
  categories: PlanCategory[];
  payment: PaymentInfo;
  selectedPlanId: string | null;
  onSelectPlan: (planId: string) => void;
  onSubmit: (data: { payerName: string; transferLast5: string }) => void;
  loading: boolean;
  onBack: () => void;
  defaultPayerName?: string;
}

export function PlanSelector({
  categories,
  payment,
  selectedPlanId,
  onSelectPlan,
  onSubmit,
  loading,
  onBack,
  defaultPayerName = "",
}: Props) {
  const selectedPlan = categories
    .flatMap((c) => c.plans)
    .find((p) => p.id === selectedPlanId);

  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  return (
    <PageShell title="購買課程" leftAlign>
      <header className="plan-header-inline">
        <button type="button" className="plan-back" onClick={onBack}>
          取消
        </button>
        <span className="plan-hint">請選擇方案</span>
      </header>

      <div className="plan-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`plan-tab ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="plan-list">
        {categories
          .find((c) => c.id === activeCategory)
          ?.plans.map((plan) => {
            const selected = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                className={`plan-card ${selected ? "selected" : ""}`}
                onClick={() => onSelectPlan(plan.id)}
              >
                {selected && <span className="plan-check">✓</span>}
                <h3>{plan.name}</h3>
                <p className="plan-desc">{plan.description}</p>
                <div className="plan-meta">
                  <span>⏱ {plan.durationLabel}</span>
                  <span>NT${plan.price.toLocaleString()}</span>
                </div>
              </button>
            );
          })}
      </div>

      {selectedPlan && (
        <section className="payment-card">
          <h3>匯款資訊</h3>
          <dl className="payment-dl">
            <div>
              <dt>銀行</dt>
              <dd>{payment.bankName}</dd>
            </div>
            <div>
              <dt>帳號</dt>
              <dd>{payment.accountNumber}</dd>
            </div>
            <div>
              <dt>戶名</dt>
              <dd>{payment.accountName}</dd>
            </div>
            <div>
              <dt>金額</dt>
              <dd>
                NT$ {selectedPlan.price.toLocaleString()}（{selectedPlan.sessionsCount} 堂）
              </dd>
            </div>
          </dl>
          <p className="payment-note">{payment.note}</p>
        </section>
      )}

      <div className="plan-footer">
        <div className="plan-summary">
          {selectedPlan ? (
            <>
              <span>
                已選 1 項 / {selectedPlan.sessionsCount} 堂 / NT$
                {selectedPlan.price.toLocaleString()}
              </span>
              <button
                type="button"
                className="plan-clear"
                onClick={() => onSelectPlan("")}
              >
                清空
              </button>
            </>
          ) : (
            <span>請選擇課程方案</span>
          )}
        </div>
        <div className="plan-actions">
          <button type="button" className="plan-nav-back" onClick={onBack}>
            ←
          </button>
          <button
            type="button"
            className="btn btn-purple btn-lg plan-submit"
            disabled={!selectedPlan || loading}
            onClick={() => setShowPaymentForm(true)}
          >
            我已完成匯款 →
          </button>
        </div>
      </div>

      <PaymentConfirmSheet
        open={showPaymentForm}
        defaultName={defaultPayerName}
        onClose={() => setShowPaymentForm(false)}
        loading={loading}
        onConfirm={(data) => {
          setShowPaymentForm(false);
          onSubmit(data);
        }}
      />
    </PageShell>
  );
}
