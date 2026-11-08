import {
  AGE_RANGE_OPTIONS,
  HSINCHU_DISTRICT_OPTIONS,
  OCCUPATION_OPTIONS,
  isAgeRangeComplete,
  isOccupationComplete,
  isResidenceComplete,
  type MemberProfileFields,
} from "../lib/memberProfileOptions";
import { RequiredFieldMark } from "./RequiredFieldMark";

interface Props {
  value: MemberProfileFields;
  onChange: (next: MemberProfileFields) => void;
  idPrefix?: string;
  required?: boolean;
}

function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  required,
  complete,
}: {
  legend: string;
  name: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | "";
  onChange: (v: T) => void;
  required?: boolean;
  complete?: boolean;
}) {
  return (
    <fieldset className="radio-fieldset">
      <legend className="radio-legend">
        {legend}
        {required ? <RequiredFieldMark complete={Boolean(complete)} /> : null}
      </legend>
      <div className="radio-group">
        {options.map((opt) => (
          <label key={opt.value} className="radio-option">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MemberProfileFieldsForm({
  value,
  onChange,
  idPrefix = "mp",
  required = false,
}: Props) {
  const set = (patch: Partial<MemberProfileFields>) => onChange({ ...value, ...patch });

  return (
    <>
      <RadioGroup
        legend="年齡"
        name={`${idPrefix}-age`}
        options={AGE_RANGE_OPTIONS}
        value={value.ageRange}
        onChange={(ageRange) => set({ ageRange })}
        required={required}
        complete={isAgeRangeComplete(value)}
      />

      <RadioGroup
        legend="職業"
        name={`${idPrefix}-occupation`}
        options={OCCUPATION_OPTIONS}
        value={value.occupation}
        onChange={(occupation) =>
          set({
            occupation,
            occupationOther: occupation === "other" ? value.occupationOther : "",
          })
        }
        required={required}
        complete={isOccupationComplete(value)}
      />
      {value.occupation === "other" && (
        <div className="form-group">
          <label htmlFor={`${idPrefix}-occupation-other`}>
            其他職業 {required ? <RequiredFieldMark complete={Boolean(value.occupationOther.trim())} /> : null}
          </label>
          <input
            id={`${idPrefix}-occupation-other`}
            value={value.occupationOther}
            onChange={(e) => set({ occupationOther: e.target.value })}
            placeholder="請自行填入"
            required={required}
          />
        </div>
      )}

      <fieldset className="radio-fieldset">
        <legend className="radio-legend">
          居住地
          {required ? <RequiredFieldMark complete={isResidenceComplete(value)} /> : null}
        </legend>
        <div className="radio-group radio-group-stack">
          <label className="radio-option">
            <input
              type="radio"
              name={`${idPrefix}-residence`}
              checked={value.residenceKind === "hsinchu"}
              onChange={() =>
                set({ residenceKind: "hsinchu", residenceOther: "" })
              }
            />
            <span>新竹市</span>
          </label>
          {value.residenceKind === "hsinchu" && (
            <div className="radio-subgroup">
              {HSINCHU_DISTRICT_OPTIONS.map((opt) => (
                <label key={opt.value} className="radio-option">
                  <input
                    type="radio"
                    name={`${idPrefix}-district`}
                    checked={value.residenceDistrict === opt.value}
                    onChange={() => set({ residenceDistrict: opt.value })}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          )}
          <label className="radio-option">
            <input
              type="radio"
              name={`${idPrefix}-residence`}
              checked={value.residenceKind === "other"}
              onChange={() =>
                set({
                  residenceKind: "other",
                  residenceDistrict: "",
                })
              }
            />
            <span>其他</span>
          </label>
        </div>
      </fieldset>
      {value.residenceKind === "other" && (
        <div className="form-group">
          <label htmlFor={`${idPrefix}-residence-other`}>
            其他居住地{" "}
            {required ? <RequiredFieldMark complete={Boolean(value.residenceOther.trim())} /> : null}
          </label>
          <input
            id={`${idPrefix}-residence-other`}
            value={value.residenceOther}
            onChange={(e) => set({ residenceOther: e.target.value })}
            placeholder="請自行填入"
            required={required}
          />
        </div>
      )}
    </>
  );
}

export const emptyMemberProfileFields = (): MemberProfileFields => ({
  ageRange: "",
  occupation: "",
  occupationOther: "",
  residenceKind: "",
  residenceDistrict: "",
  residenceOther: "",
});
