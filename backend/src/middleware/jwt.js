// src/middleware/jwt.js
import jwt from "jsonwebtoken";
import pool from "../models/db.js";

/** Small helpers */
const getUA = (req) => req.headers["user-agent"] || "";
const getIP = (req) => req.ip; // respects app.set('trust proxy', 1)

/** Signers */
export function makeAccessToken(user, { ua, ip }) {
  const now = new Date();
  console.log(`1access token made: ${now.toISOString()} (unix ${Math.floor(now.getTime()/1000)})`);

  // Embed ua/ip ONLY in the access token
  return jwt.sign(
    { username: user.username, ua, ip, type: "access" },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" }
  );
}

export function makeRefreshToken(user) {
  const now = new Date();
  console.log(`2refresh token made: ${now.toISOString()} (unix ${Math.floor(now.getTime()/1000)})`);

  // Keep refresh token minimal; do NOT include ua/ip
  return jwt.sign(
    { username: user.username, type: "refresh" },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_TTL || "7d" }
  );
}

/** Auth guard for access-token–protected routes */
export async function ensureAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing Authorization Bearer token" });

  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const username = String(payload?.username || "").trim().toLowerCase();
    if (!username) return res.status(401).json({ message: "Invalid access token" });

    // --- OPTIONAL: UA/IP binding check ---
    const STRICT = process.env.STRICT_UA_IP === "1"; // set to "1" to hard-fail
    const curUA = getUA(req);
    const curIP = getIP(req);

    if (payload.ua && payload.ua !== curUA) {
      if (STRICT) return res.status(401).json({ message: "User-Agent mismatch" });
      console.warn("[ensureAuth] UA mismatch");
    }
    if (payload.ip && payload.ip !== curIP) {
      if (STRICT) return res.status(401).json({ message: "IP mismatch" });
      console.warn("[ensureAuth] IP mismatch");
    }
    // -------------------------------------

    // Enforce user still active
    const [[row]] = await pool.query(
      "SELECT active FROM accounts WHERE username = ? LIMIT 1",
      [username]
    );
    if (!row) return res.status(401).json({ message: "Unknown user" });
    if (!row.active) {
      return res.status(403).json({
        ok: false,
        code: "ACCOUNT_DISABLED",
        message: "Not permitted. Your privileges/account status has changed; please refresh."
      });
    }

    req.user = { username };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

/** HttpOnly refresh cookie */
export function setRefreshCookie(res, refreshToken) {
  const now = new Date();
  console.log(`3refresh cookie made: ${now.toISOString()} (unix ${Math.floor(now.getTime()/1000)})`);

  res.cookie("rt", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/api/auth/refresh",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}
