// src/middleware/jwt.js
import jwt from "jsonwebtoken";
import pool from "../models/db.js";

/** Small helpers */
const getUA = (req) => req.headers["user-agent"] || "";
const getIP = (req) => req.ip; // respects app.set('trust proxy', 1)

/** ---- Cookie names & options ---- */
const ACCESS_COOKIE = "at"; // access token cookie name
const REFRESH_COOKIE = "rt"; // already used in your code

// 15 minutes default (match your ACCESS_TOKEN_TTL if set)
const ACCESS_MAX_AGE_MS =
  (process.env.ACCESS_TOKEN_TTL_MINUTES
    ? Number(process.env.ACCESS_TOKEN_TTL_MINUTES)
    : null) * 60_000 || 15 * 60_000;

/**
 * Cross-site SPA? Use SameSite=None + Secure.
 * Same-site (API & SPA on same origin)? You may use Lax and keep Secure in prod.
 */
const sameSiteForAPIs = process.env.SAMESITE_COOKIES || "none"; // "none" | "lax" | "strict"
const secureCookies = process.env.NODE_ENV !== "development";   // true in prod

/** Signers (unchanged) */
export function makeAccessToken(user, { ua, ip }) {
  const now = new Date();
  console.log(`1access token made: ${now.toISOString()} (unix ${Math.floor(now.getTime()/1000)})`);
  return jwt.sign(
    { username: user.username, ua, ip, type: "access" },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" }
  );
}

export function makeRefreshToken(user) {
  const now = new Date();
  console.log(`2refresh token made: ${now.toISOString()} (unix ${Math.floor(now.getTime()/1000)})`);
  return jwt.sign(
    { username: user.username, type: "refresh" },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_TTL || "7d" }
  );
}

/** ---- Set/Clear cookies ---- */
export function setAccessCookie(res, accessToken) {
  const now = new Date();
  console.log(`access cookie set: ${now.toISOString()} (unix ${Math.floor(now.getTime()/1000)})`);
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: sameSiteForAPIs,     // "none" if cross-site
    path: "/api",                  // scope to your API only
    maxAge: ACCESS_MAX_AGE_MS
  });
}

export function clearAccessCookie(res) {
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: sameSiteForAPIs,
    path: "/api"
  });
}

/** Existing refresh cookie function (kept) */
export function setRefreshCookie(res, refreshToken) {
  const now = new Date();
  console.log(`3refresh cookie made: ${now.toISOString()} (unix ${Math.floor(now.getTime()/1000)})`);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: sameSiteForAPIs,
    path: "/api/auth/refresh",
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}
export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: sameSiteForAPIs,
    path: "/api/auth/refresh"
  });
}

/** ---- Auth guard now reads from cookie instead of Authorization header ---- */
export async function ensureAuth(req, res, next) {
  // Prefer cookie. (Optionally fall back to header to ease migration.)
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  const headerAuth = req.headers.authorization || "";
  const headerToken = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7) : null;
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ status: "IAM_1" });
  }

  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const username = String(payload?.username || "").trim().toLowerCase();
    if (!username) return res.status(401).json({ status:  "IAM_1" });

    // --- OPTIONAL: UA/IP binding check ---
    const STRICT = process.env.STRICT_UA_IP === "1";
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
    return res.status(401).json({ status: "IAM_1" });
  }
}
