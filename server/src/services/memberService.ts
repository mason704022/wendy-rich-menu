import { getDb } from "../db/index.js";
import {
  formatAgeRange,
  formatOccupation,
  formatResidence,
} from "./memberProfileLabels.js";

export interface Member {
  line_user_id: string;
  display_name: string;
  name: string;
  phone: string;
  total_sessions: number;
  remaining_sessions: number;
  created_at: string;
  age_range: string;
  occupation: string;
  occupation_other: string;
  residence_kind: string;
  residence_district: string;
  residence_other: string;
}

export interface MemberProfileInput {
  ageRange: string;
  occupation: string;
  occupationOther?: string;
  residenceKind: "hsinchu" | "other";
  residenceDistrict?: string;
  residenceOther?: string;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function findMemberByPhone(
  phone: string,
  excludeLineUserId?: string
): Member | undefined {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;

  const db = getDb();
  const rows = db.prepare("SELECT * FROM members").all() as unknown as Member[];
  return rows.find(
    (m) =>
      normalizePhone(m.phone) === normalized &&
      (!excludeLineUserId || m.line_user_id !== excludeLineUserId)
  );
}

export function listAllMembers(): Member[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM members ORDER BY created_at ASC")
    .all() as unknown as Member[];
}

export function getMember(lineUserId: string): Member | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM members WHERE line_user_id = ?")
    .get(lineUserId) as Member | undefined;
}

export function memberProfileSummary(member: Member) {
  return {
    ageRange: member.age_range,
    ageLabel: formatAgeRange(member.age_range),
    occupation: member.occupation,
    occupationLabel: formatOccupation(member.occupation, member.occupation_other),
    residenceLabel: formatResidence(
      member.residence_kind,
      member.residence_district,
      member.residence_other
    ),
  };
}

function validateProfileInput(profile: MemberProfileInput) {
  if (!profile.ageRange) throw new Error("AGE_RANGE_REQUIRED");
  if (!profile.occupation) throw new Error("OCCUPATION_REQUIRED");
  if (profile.occupation === "other" && !profile.occupationOther?.trim()) {
    throw new Error("OCCUPATION_OTHER_REQUIRED");
  }
  if (!profile.residenceKind) throw new Error("RESIDENCE_REQUIRED");
  if (profile.residenceKind === "hsinchu" && !profile.residenceDistrict) {
    throw new Error("RESIDENCE_DISTRICT_REQUIRED");
  }
  if (profile.residenceKind === "other" && !profile.residenceOther?.trim()) {
    throw new Error("RESIDENCE_OTHER_REQUIRED");
  }
}

export function registerMember(input: {
  lineUserId: string;
  displayName: string;
  name: string;
  phone: string;
  profile: MemberProfileInput;
}): { member: Member; isNew: boolean } {
  validateProfileInput(input.profile);

  const duplicate = findMemberByPhone(input.phone, input.lineUserId);
  if (duplicate) {
    throw new Error("PHONE_ALREADY_REGISTERED");
  }

  const db = getDb();
  const existing = getMember(input.lineUserId);
  const profileFields = [
    input.profile.ageRange,
    input.profile.occupation,
    input.profile.occupationOther?.trim() ?? "",
    input.profile.residenceKind,
    input.profile.residenceKind === "hsinchu" ? (input.profile.residenceDistrict ?? "") : "",
    input.profile.residenceKind === "other" ? (input.profile.residenceOther?.trim() ?? "") : "",
  ];

  if (existing) {
    db.prepare(
      `UPDATE members SET display_name = ?, name = ?, phone = ?,
       age_range = ?, occupation = ?, occupation_other = ?,
       residence_kind = ?, residence_district = ?, residence_other = ?
       WHERE line_user_id = ?`
    ).run(
      input.displayName,
      input.name,
      input.phone,
      ...profileFields,
      input.lineUserId
    );
    return { member: getMember(input.lineUserId)!, isNew: false };
  }

  db.prepare(
    `INSERT INTO members (
       line_user_id, display_name, name, phone,
       age_range, occupation, occupation_other,
       residence_kind, residence_district, residence_other
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.lineUserId,
    input.displayName,
    input.name,
    input.phone,
    ...profileFields
  );

  return { member: getMember(input.lineUserId)!, isNew: true };
}

export function updateMemberProfile(
  lineUserId: string,
  profile: MemberProfileInput
): Member {
  validateProfileInput(profile);
  const db = getDb();
  const member = getMember(lineUserId);
  if (!member) throw new Error("NOT_REGISTERED");

  db.prepare(
    `UPDATE members SET
       age_range = ?, occupation = ?, occupation_other = ?,
       residence_kind = ?, residence_district = ?, residence_other = ?
     WHERE line_user_id = ?`
  ).run(
    profile.ageRange,
    profile.occupation,
    profile.occupationOther?.trim() ?? "",
    profile.residenceKind,
    profile.residenceKind === "hsinchu" ? (profile.residenceDistrict ?? "") : "",
    profile.residenceKind === "other" ? (profile.residenceOther?.trim() ?? "") : "",
    lineUserId
  );

  return getMember(lineUserId)!;
}

export function addSessions(lineUserId: string, sessions: number) {
  const db = getDb();
  db.prepare(
    `UPDATE members
     SET total_sessions = total_sessions + ?,
         remaining_sessions = remaining_sessions + ?
     WHERE line_user_id = ?`
  ).run(sessions, sessions, lineUserId);
}

export function deductSession(lineUserId: string) {
  const db = getDb();
  const member = getMember(lineUserId);
  if (!member || member.remaining_sessions <= 0) {
    throw new Error("INSUFFICIENT_SESSIONS");
  }
  db.prepare(
    `UPDATE members SET remaining_sessions = remaining_sessions - 1 WHERE line_user_id = ?`
  ).run(lineUserId);
}

export function updateMemberName(lineUserId: string, name: string): Member {
  const db = getDb();
  const member = getMember(lineUserId);
  if (!member) throw new Error("NOT_REGISTERED");
  db.prepare(`UPDATE members SET name = ? WHERE line_user_id = ?`).run(name, lineUserId);
  return getMember(lineUserId)!;
}

export function refundSession(lineUserId: string) {
  const db = getDb();
  db.prepare(
    `UPDATE members SET remaining_sessions = remaining_sessions + 1 WHERE line_user_id = ?`
  ).run(lineUserId);
}

export interface MemberSearchResult {
  line_user_id: string;
  name: string;
  phone: string;
  display_name: string;
  total_sessions: number;
  has_confirmed_purchase: boolean;
}

export function searchMembers(query: string, onlyWithPurchase = false): MemberSearchResult[] {
  const db = getDb();
  const q = `%${query.trim()}%`;
  if (!query.trim()) return [];

  const rows = db
    .prepare(
      `SELECT m.line_user_id, m.name, m.phone, m.display_name, m.total_sessions,
              EXISTS(
                SELECT 1 FROM purchases p
                WHERE p.line_user_id = m.line_user_id AND p.status = 'confirmed'
              ) AS has_confirmed_purchase
       FROM members m
       WHERE m.name LIKE ? OR m.phone LIKE ? OR m.display_name LIKE ?
       ORDER BY m.name
       LIMIT 30`
    )
    .all(q, q, q) as unknown as MemberSearchResult[];

  if (onlyWithPurchase) {
    return rows.filter((r) => r.has_confirmed_purchase);
  }
  return rows;
}
