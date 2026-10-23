import { useEffect, useState } from "react";

export interface CoffeeItem {
  id: string;
  name: string;
  description: string;
  hotCold?: boolean;
}

interface Props {
  open: boolean;
  title: string;
  items: CoffeeItem[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (coffeeItemId: string, coffeeTemperature?: "hot" | "ice") => void;
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
  const [temperature, setTemperature] = useState<"hot" | "ice" | "">("");

  useEffect(() => {
    if (!open) return;
    setSelectedId(items[0]?.id ?? "");
    setTemperature("");
  }, [open, items]);

  if (!open) return null;

  const selected = items.find((i) => i.id === selectedId);
  const needsTemp = Boolean(selected?.hotCold);
  const canConfirm =
    selectedId && (!needsTemp || temperature === "hot" || temperature === "ice");

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
            const isSelected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                className={`plan-card coffee-card ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  setSelectedId(item.id);
                  setTemperature("");
                }}
              >
                {isSelected && <span className="plan-check">✓</span>}
                <h3>
                  {item.name}
                  {item.hotCold ? "（熱/冰）" : ""}
                </h3>
                {item.description ? (
                  <p className="plan-desc">{item.description}</p>
                ) : null}
              </button>
            );
          })}

          {needsTemp && (
            <fieldset className="radio-fieldset coffee-temp-fieldset">
              <legend className="radio-legend">溫度</legend>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="coffee-temp"
                    checked={temperature === "hot"}
                    onChange={() => setTemperature("hot")}
                  />
                  <span>熱</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="coffee-temp"
                    checked={temperature === "ice"}
                    onChange={() => setTemperature("ice")}
                  />
                  <span>冰</span>
                </label>
              </div>
            </fieldset>
          )}
        </div>

        <div className="sheet-footer coffee-picker-footer">
          <button
            type="button"
            className="btn btn-purple btn-lg sheet-next-full"
            disabled={!canConfirm || loading}
            onClick={() =>
              onConfirm(
                selectedId,
                needsTemp ? (temperature as "hot" | "ice") : undefined
              )
            }
          >
            {loading ? "預約中…" : "確認預約"}
          </button>
        </div>
      </div>
    </div>
  );
}
