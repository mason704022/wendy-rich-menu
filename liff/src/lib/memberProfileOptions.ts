export const AGE_RANGE_OPTIONS = [
  { value: "20-30", label: "20–30" },
  { value: "30-40", label: "30–40" },
  { value: "40-50", label: "40–50" },
  { value: "50+", label: "50以上" },
] as const;

export const OCCUPATION_OPTIONS = [
  { value: "student", label: "學生" },
  { value: "freelance", label: "自由工作者" },
  { value: "service", label: "服務業" },
  { value: "education", label: "教職" },
  { value: "medical", label: "醫療" },
  { value: "other", label: "其他" },
] as const;

export const HSINCHU_DISTRICT_OPTIONS = [
  { value: "north", label: "北區" },
  { value: "east", label: "東區" },
  { value: "xiangshan", label: "香山區" },
] as const;

export type AgeRange = (typeof AGE_RANGE_OPTIONS)[number]["value"];
export type Occupation = (typeof OCCUPATION_OPTIONS)[number]["value"];
export type HsinchuDistrict = (typeof HSINCHU_DISTRICT_OPTIONS)[number]["value"];

export interface MemberProfileFields {
  ageRange: AgeRange | "";
  occupation: Occupation | "";
  occupationOther: string;
  residenceKind: "hsinchu" | "other" | "";
  residenceDistrict: HsinchuDistrict | "";
  residenceOther: string;
}

export function validateMemberProfile(fields: MemberProfileFields): string | null {
  if (!fields.ageRange) return "請選擇年齡";
  if (!fields.occupation) return "請選擇職業";
  if (fields.occupation === "other" && !fields.occupationOther.trim()) {
    return "請填寫其他職業";
  }
  if (!fields.residenceKind) return "請選擇居住地";
  if (fields.residenceKind === "hsinchu" && !fields.residenceDistrict) {
    return "請選擇新竹市區域";
  }
  if (fields.residenceKind === "other" && !fields.residenceOther.trim()) {
    return "請填寫其他居住地";
  }
  return null;
}
