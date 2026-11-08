interface Props {
  complete: boolean;
}

/** Shown after （必填）: green when filled, gray when still empty. */
export function RequiredFieldMark({ complete }: Props) {
  return (
    <>
      <span className="field-required">（必填）</span>
      <span
        className={`field-check ${complete ? "field-check--complete" : "field-check--incomplete"}`}
        aria-hidden
      >
        ✓
      </span>
    </>
  );
}
