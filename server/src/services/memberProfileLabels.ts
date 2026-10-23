const AGE_LABELS: Record<string, string> = {
  "20-30": "20–30",
  "30-40": "30–40",
  "40-50": "40–50",
  "50+": "50以上",
};

const OCCUPATION_LABELS: Record<string, string> = {
  student: "學生",
  freelance: "自由工作者",
  service: "服務業",
  education: "教職",
  medical: "醫療",
  manufacturing: "製造業",
  other: "其他",
};

const DISTRICT_LABELS: Record<string, string> = {
  north: "北區",
  east: "東區",
  xiangshan: "香山區",
};

export function formatAgeRange(ageRange: string): string {
  return AGE_LABELS[ageRange] ?? ageRange;
}

export function formatOccupation(occupation: string, occupationOther: string): string {
  if (!occupation) return "";
  if (occupation === "other") {
    return occupationOther.trim() || "其他";
  }
  return OCCUPATION_LABELS[occupation] ?? occupation;
}

export function formatResidence(
  residenceKind: string,
  residenceDistrict: string,
  residenceOther: string
): string {
  if (residenceKind === "hsinchu" && residenceDistrict) {
    const district = DISTRICT_LABELS[residenceDistrict] ?? residenceDistrict;
    return `新竹市${district}`;
  }
  if (residenceKind === "other") {
    return residenceOther.trim();
  }
  return "";
}
