import { useState } from "react";
import { PageShell } from "./PageShell";
import { CouponPicker, type AvailableCoupon, type PricePreview, type PlanCouponPrice } from "./CouponPicker";
import { TermsSheet, type PurchaseTerms } from "./TermsSheet";
import { PurchaseCheckout } from "./PurchaseCheckout";

export interface Plan {
  id: string;
  name: string;
  description: string;
  durationLabel: string;
  sessionsCount: number;
  price: number;
  priceLabel?: string;
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
  purchaseTerms: PurchaseTerms;
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

function formatPlanPrice(plan: Plan, planDiscount?: PlanCouponPrice) {
  if (planDiscount) {
    return (
      <>
        <span className="price-original">{plan.priceLabel ?? `NT$${plan.price.toLocaleString()}`}</span>
        NT${planDiscount.final.toLocaleString()}
      </>
    );
  }
  return <>{plan.priceLabel ?? `NT$${plan.price.toLocaleString()}`}</>;
}

export function PlanSelector({
  categories,
  payment,
  purchaseTerms,
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
  const [showTerms, setShowTerms] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const showCategoryTabs = categories.length > 1;

  if (showCheckout && selectedPlan) {
    return (
      <PurchaseCheckout
        payment={payment}
        amount={displayPrice}
        defaultName={defaultPayerName}
        loading={loading}
        onBack={() => setShowCheckout(false)}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <PageShell title="選擇我的課程" leftAlign>
      <header className="plan-header-inline">
        <button type="button" className="plan-back" onClick={onBack}>
          取消
        </button>
        <span className="plan-hint">請選擇方案</span>
      </header>

      {showCategoryTabs && (
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
      )}

      <div className="plan-list">
        {(showCategoryTabs
          ? categories.find((c) => c.id === activeCategory)?.plans
          : categories.flatMap((c) => c.plans)
        )?.map((plan) => {
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
                {plan.durationLabel ? <span>⏱ {plan.durationLabel}</span> : null}
                <span className="plan-price">{formatPlanPrice(plan, planDiscount)}</span>
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
        <button
          type="button"
          className="btn btn-purple btn-lg plan-submit-full"
          disabled={!selectedPlan || loading}
          onClick={() => setShowTerms(true)}
        >
          購買課程
        </button>
      </div>

      <TermsSheet
        terms={purchaseTerms}
        open={showTerms}
        onClose={() => setShowTerms(false)}
        onNext={() => {
          setShowTerms(false);
          setShowCheckout(true);
        }}
      />
    </PageShell>
  );
}
