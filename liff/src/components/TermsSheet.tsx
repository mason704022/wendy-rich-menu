import { useState } from "react";

export interface PurchaseTerms {
  title: string;
  intro: string[];
  sections: string[];
  agreeLabel?: string;
}

function renderTermsSection(text: string) {
  const parts = text.split(/(\[\[red\]\][\s\S]*?\[\[\/red\]\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[\[red\]\]([\s\S]*?)\[\[\/red\]\]$/);
    if (match) {
      return (
        <span key={index} className="terms-text-red">
          {match[1]}
        </span>
      );
    }
    return part;
  });
}

interface Props {
  terms: PurchaseTerms;
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
          <ul className="sheet-list sheet-list-terms">
            {terms.sections.map((s) => (
              <li key={s}>{renderTermsSection(s)}</li>
            ))}
          </ul>
        </div>

        <TermsFooter agreeLabel={terms.agreeLabel} onNext={onNext} />
      </div>
    </div>
  );
}

function TermsFooter({
  agreeLabel,
  onNext,
}: {
  agreeLabel?: string;
  onNext: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="sheet-footer sheet-footer-stack">
      <label className="sheet-agree">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>{agreeLabel ?? "我已閱讀並同意內容"}</span>
      </label>
      <button
        type="button"
        className="btn btn-purple sheet-next sheet-next-full"
        disabled={!agreed}
        onClick={onNext}
      >
        下一頁
      </button>
    </div>
  );
}
