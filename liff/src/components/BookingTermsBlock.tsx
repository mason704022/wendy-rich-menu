import type { PurchaseTerms } from "./TermsSheet";

interface Props {
  terms: PurchaseTerms;
}

export function BookingTermsBlock({ terms }: Props) {
  return (
    <section className="info-card terms-inline">
      <h2>{terms.title}</h2>
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
  );
}
