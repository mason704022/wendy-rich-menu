import { useState } from "react";

interface Props {
  open: boolean;
  defaultName?: string;
  onClose: () => void;
  onConfirm: (data: { payerName: string; transferLast5: string }) => void;
  loading: boolean;
}

export function PaymentConfirmSheet({
  open,
  defaultName = "",
  onClose,
  onConfirm,
  loading,
}: Props) {
  const [payerName, setPayerName] = useState(defaultName);
  const [transferLast5, setTransferLast5] = useState("");

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (transferLast5.length !== 5) return;
    onConfirm({ payerName: payerName.trim(), transferLast5 });
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button type="button" className="sheet-close-btn" onClick={onClose}>
            關閉
          </button>
          <h2 className="sheet-title">匯款確認</h2>
        </div>
        <form className="sheet-body" onSubmit={submit}>
          <p className="sheet-intro">請填寫匯款資訊，以便工作室對帳確認。</p>
          <div className="form-group">
            <label>匯款姓名</label>
            <input
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              required
              placeholder="請輸入匯款人姓名"
            />
          </div>
          <div className="form-group">
            <label>轉帳後五碼</label>
            <input
              value={transferLast5}
              onChange={(e) =>
                setTransferLast5(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              required
              inputMode="numeric"
              placeholder="12345"
              maxLength={5}
            />
          </div>
          <button
            type="submit"
            className="btn btn-purple btn-lg"
            disabled={loading || transferLast5.length !== 5 || !payerName.trim()}
          >
            {loading ? "提交中…" : "確認提交"}
          </button>
        </form>
      </div>
    </div>
  );
}
