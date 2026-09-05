export interface AvailableCoupon {
  id: number;
  templateName: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  expiresAt: string | null;
  planIds: string[];
}

export interface PricePreview {
  original: number;
  discount: number;
  final: number;
  templateName: string;
}

export interface PlanCouponPrice extends PricePreview {
  couponAssignmentId: number;
  expiresAt: string | null;
}

interface Props {
  coupons: AvailableCoupon[];
  selectedCouponId: number | null;
  onSelectCoupon: (id: number | null) => void;
  pricePreview: PricePreview | null;
  loading?: boolean;
}

function formatDiscount(coupon: AvailableCoupon): string {
  if (coupon.discountType === "fixed") {
    return `折 NT$${coupon.discountValue.toLocaleString()}`;
  }
  return `${coupon.discountValue}% off`;
}

export function CouponPicker({
  coupons,
  selectedCouponId,
  onSelectCoupon,
  pricePreview,
  loading,
}: Props) {
  if (coupons.length === 0) return null;

  return (
    <section className="coupon-section">
      <h3>折扣券</h3>
      <select
        className="coupon-select"
        value={selectedCouponId ?? ""}
        disabled={loading}
        onChange={(e) => {
          const val = e.target.value;
          onSelectCoupon(val ? Number(val) : null);
        }}
      >
        <option value="">不使用折扣券</option>
        {coupons.map((c) => (
          <option key={c.id} value={c.id}>
            {c.templateName}（{formatDiscount(c)}）
            {c.expiresAt ? ` · 至 ${c.expiresAt.slice(0, 10)}` : ""}
          </option>
        ))}
      </select>

      {pricePreview && pricePreview.discount > 0 && (
        <div className="coupon-price-breakdown">
          <p>
            原價 <span className="price-original">NT${pricePreview.original.toLocaleString()}</span>
          </p>
          <p className="price-discount">
            折抵 -NT${pricePreview.discount.toLocaleString()}
          </p>
          <p className="price-final">
            實付 <strong>NT${pricePreview.final.toLocaleString()}</strong>
          </p>
        </div>
      )}
    </section>
  );
}
