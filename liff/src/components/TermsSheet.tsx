import { useState } from "react";

interface Terms {
  title: string;
  intro: string[];
  sections: string[];
}

interface Props {
  terms: Terms;
  open: boolean;
  onClose: () => void;
  onNext: () => void;
}

export function TermsSheet({ terms, open, onClose, onNext }: Props) {
  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button type="button" className="sheet-close-btn" onClick={onClose}>
            關閉
          </button>
          <h2 className="sheet-title">{terms.title}</h2>
        </div>

        <div className="sheet-body">
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
        </div>

        <TermsFooter onNext={onNext} />
      </div>
    </div>
  );
}

function TermsFooter({ onNext }: { onNext: () => void }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="sheet-footer">
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
        className="btn btn-purple sheet-next"
        disabled={!agreed}
        onClick={onNext}
      >
        下一步
      </button>
    </div>
  );
}
