import type { NextFunction, Request, Response } from "express";
import { getConfig } from "../config.js";

/** Admin identity: query/header first so POST bodies can carry a member's lineUserId. */
export function getLineUserIdFromRequest(req: Request): string | undefined {
  const fromQuery = req.query.lineUserId;
  if (typeof fromQuery === "string" && fromQuery) return fromQuery;

  const fromHeader = req.headers["x-line-user-id"];
  if (typeof fromHeader === "string" && fromHeader) return fromHeader;

  const fromBody = req.body?.lineUserId;
  if (typeof fromBody === "string" && fromBody) return fromBody;

  return undefined;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const lineUserId = getLineUserIdFromRequest(req);
  const { adminLineUserId } = getConfig();

  if (!adminLineUserId) {
    if (lineUserId === "dev-user") return next();
    return res.status(503).json({ error: "ADMIN_NOT_CONFIGURED" });
  }

  if (lineUserId !== adminLineUserId) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  next();
}
