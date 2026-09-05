import { useState } from "react";
import { PageShell } from "./PageShell";
import { PaymentConfirmSheet } from "./PaymentConfirmSheet";
import { CouponPicker, type AvailableCoupon, type PricePreview, type PlanCouponPrice } from "./CouponPicker";

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
  coupons?: AvailableCoupon[];
  selectedCouponId?: number | null;
  onSelectCoupon?: (id: number | null) => void;
  pricePreview?: PricePreview | null;
  couponLoading?: boolean;
  planPrices?: Record<string, PlanCouponPrice>;
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
  coupons = [],
  selectedCouponId = null,
  onSelectCoupon,
  pricePreview = null,
  couponLoading = false,
  planPrices = {},
}: Props) {
  const selectedPlan = categories
    .flatMap((c) => c.plans)
    .find((p) => p.id === selectedPlanId);

  const displayPrice = pricePreview?.final ?? selectedPlan?.price ?? 0;
  const hasDiscount = (pricePreview?.discount ?? 0) > 0;

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
            const planDiscount = planPrices[plan.id];
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
                  <span className="plan-price">
                    {planDiscount ? (
                      <>
                        <span className="price-original">
                          NT${plan.price.toLocaleString()}
                        </span>
                        NT${planDiscount.final.toLocaleString()}
                      </>
                    ) : (
                      <>NT${plan.price.toLocaleString()}</>
                    )}
                  </span>
                </div>
                {planDiscount && (
                  <p className="plan-coupon-hint">
                    {planDiscount.templateName} 折 NT${planDiscount.discount.toLocaleString()}
                    {planDiscount.expiresAt
                      ? ` · 至 ${planDiscount.expiresAt.slice(0, 10)}`
                      : ""}
                  </p>
                )}
              </button>
            );
          })}
      </div>

      {selectedPlan && onSelectCoupon && (
        <CouponPicker
          coupons={coupons}
          selectedCouponId={selectedCouponId}
          onSelectCoupon={onSelectCoupon}
          pricePreview={pricePreview}
          loading={couponLoading}
        />
      )}

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
                {hasDiscount ? (
                  <>
                    <span className="price-original">NT$ {selectedPlan.price.toLocaleString()}</span>
                    {" → "}
                    <strong>NT$ {displayPrice.toLocaleString()}</strong>
                  </>
                ) : (
                  <>NT$ {displayPrice.toLocaleString()}</>
                )}
                （{selectedPlan.sessionsCount} 堂）
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
                {displayPrice.toLocaleString()}
                {hasDiscount && (
                  <span className="plan-summary-discount">（已折扣）</span>
                )}
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
