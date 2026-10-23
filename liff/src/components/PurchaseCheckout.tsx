import { useState } from "react";
import { PageShell } from "./PageShell";
import type { PaymentInfo } from "./PlanSelector";

interface Props {
  payment: PaymentInfo;
  amount: number;
  defaultName?: string;
  loading: boolean;
  onBack: () => void;
  onSubmit: (data: { payerName: string; transferLast5: string }) => void;
}

export function PurchaseCheckout({
  payment,
  amount,
  defaultName = "",
  loading,
  onBack,
  onSubmit,
}: Props) {
  const [payerName, setPayerName] = useState(defaultName);
  const [transferLast5, setTransferLast5] = useState("");

  const canSubmit =
    payerName.trim().length > 0 && transferLast5.length === 5 && !loading;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ payerName: payerName.trim(), transferLast5 });
  }

  return (
    <PageShell title="結帳頁面｜填寫匯款單" leftAlign>
      <header className="plan-header-inline">
        <button type="button" className="plan-back" onClick={onBack}>
          返回
        </button>
      </header>

      <section className="checkout-step">
        <h3 className="checkout-step-title">Step 1｜課程費用匯款帳號</h3>
        <dl className="checkout-bank-dl">
          <div>
            <dd>{payment.bankName}</dd>
          </div>
          <div>
            <dt>銀行帳號</dt>
            <dd>{payment.accountNumber}</dd>
          </div>
        </dl>
      </section>

      <form className="checkout-step" onSubmit={submit}>
        <h3 className="checkout-step-title">Step 2｜回填付款資訊</h3>
        <div className="form-group">
          <label>匯款金額</label>
          <input
            readOnly
            value={`NT$ ${amount.toLocaleString()}`}
            className="input-readonly"
          />
        </div>
        <div className="form-group">
          <label>匯款帳號後五碼</label>
          <input
            value={transferLast5}
            onChange={(e) =>
              setTransferLast5(e.target.value.replace(/\D/g, "").slice(0, 5))
            }
            inputMode="numeric"
            placeholder="請輸入後五碼"
            maxLength={5}
          />
        </div>
        <div className="form-group">
          <label>真實姓名</label>
          <input
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="請輸入匯款人姓名"
          />
        </div>

        <div className="checkout-submit-wrap">
          <button
            type="submit"
            className="btn btn-purple btn-lg"
            disabled={!canSubmit}
          >
            {loading ? "提交中…" : "送出資料"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
