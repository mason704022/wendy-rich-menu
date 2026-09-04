import { getDb } from "../db/index.js";

export interface Member {
  line_user_id: string;
  display_name: string;
  name: string;
  phone: string;
  total_sessions: number;
  remaining_sessions: number;
  created_at: string;
}

export function getMember(lineUserId: string): Member | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM members WHERE line_user_id = ?")
    .get(lineUserId) as Member | undefined;
}

export function registerMember(input: {
  lineUserId: string;
  displayName: string;
  name: string;
  phone: string;
}): Member {
  const db = getDb();
  const existing = getMember(input.lineUserId);
  if (existing) {
    db.prepare(
      `UPDATE members SET display_name = ?, name = ?, phone = ? WHERE line_user_id = ?`
    ).run(input.displayName, input.name, input.phone, input.lineUserId);
    return getMember(input.lineUserId)!;
  }

  db.prepare(
    `INSERT INTO members (line_user_id, display_name, name, phone)
     VALUES (?, ?, ?, ?)`
  ).run(input.lineUserId, input.displayName, input.name, input.phone);

  return getMember(input.lineUserId)!;
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
