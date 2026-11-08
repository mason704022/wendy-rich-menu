/**
 * Railway / Node run in UTC; SQLite datetime('now') is UTC.
 * Business ops use Asia/Taipei — store local wall time (+8) in TEXT columns.
 */
export const SQLITE_TAIPEI_NOW = "datetime('now', '+8 hours')";
