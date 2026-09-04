import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(__dirname, "../data/wendy.db");

export function getDbPath() {
  return process.env.DATABASE_PATH ?? defaultDbPath;
}

export function initDatabase(dbPath = getDbPath()) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      line_user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      total_sessions INTEGER NOT NULL DEFAULT 0,
      remaining_sessions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      sessions_count INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT,
      FOREIGN KEY (line_user_id) REFERENCES members(line_user_id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      line_user_id TEXT NOT NULL,
      slot_date TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('confirmed', 'waitlist', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (line_user_id) REFERENCES members(line_user_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_active
      ON bookings(line_user_id, slot_date, start_time)
      WHERE status != 'cancelled';

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

    CREATE TABLE IF NOT EXISTS coupon_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('fixed', 'percent')),
      discount_value INTEGER NOT NULL,
      plan_ids TEXT NOT NULL DEFAULT '[]',
      expires_at TEXT,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupon_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      line_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available', 'reserved', 'used', 'expired')),
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      used_at TEXT,
      purchase_id INTEGER,
      FOREIGN KEY (template_id) REFERENCES coupon_templates(id),
      FOREIGN KEY (line_user_id) REFERENCES members(line_user_id),
      FOREIGN KEY (purchase_id) REFERENCES purchases(id)
    );

    CREATE INDEX IF NOT EXISTS idx_coupon_assignments_user
      ON coupon_assignments(line_user_id, status);
  `);

  migrateSchema(db);

  return db;
}

function migrateSchema(db: DatabaseSync) {
  const purchaseCols = db.prepare("PRAGMA table_info(purchases)").all() as Array<{ name: string }>;
  const names = new Set(purchaseCols.map((c) => c.name));
  if (!names.has("payer_name")) {
    db.exec(`ALTER TABLE purchases ADD COLUMN payer_name TEXT NOT NULL DEFAULT ''`);
  }
  if (!names.has("transfer_last5")) {
    db.exec(`ALTER TABLE purchases ADD COLUMN transfer_last5 TEXT NOT NULL DEFAULT ''`);
  }

  const bookingCols = db.prepare("PRAGMA table_info(bookings)").all() as Array<{ name: string }>;
  const bookingNames = new Set(bookingCols.map((c) => c.name));
  if (!bookingNames.has("coffee_item_id")) {
    db.exec(`ALTER TABLE bookings ADD COLUMN coffee_item_id TEXT NOT NULL DEFAULT ''`);
  }

  if (!names.has("original_amount")) {
    db.exec(`ALTER TABLE purchases ADD COLUMN original_amount INTEGER`);
    db.exec(`UPDATE purchases SET original_amount = amount WHERE original_amount IS NULL`);
  }
  if (!names.has("discount_amount")) {
    db.exec(`ALTER TABLE purchases ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0`);
  }
  if (!names.has("coupon_assignment_id")) {
    db.exec(`ALTER TABLE purchases ADD COLUMN coupon_assignment_id INTEGER`);
  }
}

export type DatabaseInstance = DatabaseSync;

let dbInstance: DatabaseInstance | null = null;

export function getDb(): DatabaseInstance {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}
