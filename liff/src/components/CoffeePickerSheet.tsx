import { useState } from "react";

export interface CoffeeItem {
  id: string;
  name: string;
  description: string;
}

interface Props {
  open: boolean;
  title: string;
  items: CoffeeItem[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (coffeeItemId: string) => void;
}

export function CoffeePickerSheet({
  open,
  title,
  items,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");

  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button type="button" className="sheet-close-btn" onClick={onClose}>
            關閉
          </button>
          <h2 className="sheet-title">{title}</h2>
        </div>

        <div className="sheet-body coffee-picker-body">
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                className={`plan-card coffee-card ${selected ? "selected" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                {selected && <span className="plan-check">✓</span>}
                <h3>{item.name}</h3>
                <p className="plan-desc">{item.description}</p>
              </button>
            );
          })}
        </div>

        <div className="sheet-footer coffee-picker-footer">
          <button
            type="button"
            className="btn btn-purple btn-lg sheet-next-full"
            disabled={!selectedId || loading}
            onClick={() => onConfirm(selectedId)}
          >
            {loading ? "預約中…" : "確認預約"}
          </button>
        </div>
      </div>
    </div>
  );
}
