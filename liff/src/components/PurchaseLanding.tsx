import { useState } from "react";
import { PageShell } from "./PageShell";

interface Terms {
  title: string;
  intro: string[];
  sections: string[];
  disclaimer?: string;
}

interface Props {
  terms: Terms;
  onNext: () => void;
}

export function PurchaseLanding({ terms, onNext }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <PageShell title="購買課程" leftAlign>
      <section className="info-card terms-inline">
        <h3>{terms.title}</h3>
        {terms.intro.map((line) => (
          <p key={line} className="sheet-intro">
            {line}
          </p>
        ))}
        <ul className="sheet-list">
          {terms.sections.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {terms.disclaimer && <p className="purchase-disclaimer">{terms.disclaimer}</p>}
      </section>

      <div className="purchase-footer landing-footer">
        <label className="sheet-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>我已閱讀並同意內容</span>
        </label>
        <button
          type="button"
          className="btn btn-purple btn-lg"
          disabled={!agreed}
          onClick={onNext}
        >
          下一步
        </button>
      </div>
    </PageShell>
  );
}
