//  src/middleware/jwt.js
//  * JWT utilities: sign access/refresh tokens, auth guard (ensureAuth),
//    and helpers to set/clear the HttpOnly refresh cookie.
//
//  * Access token carries { username }; refresh cookie is scoped to /api/auth/refresh
//    with Secure+HttpOnly+SameSite=None.

import jwt from "jsonwebtoken";
import pool from "../models/db.js"; // <-- add DB to check account.active

/** Signers */
export function makeAccessToken(user) {
  // keep payload tiny; put only what you need on every request
  const now = new Date();
  console.log(
    `1access token made: ${now.toISOString()} (unix ${Math.floor(
      now.getTime() / 1000
    )})`
  );

  return jwt.sign({ username: user.username }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });
}

export function makeRefreshToken(user) {
  const now = new Date();
  console.log(
    `2refresh token made: ${now.toISOString()} (unix ${Math.floor(
      now.getTime() / 1000
    )})`
  );

  return jwt.sign({ username: user.username }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || "7d",
  });
}

/** Middlewares */
export async function ensureAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res
      .status(401)
      .json({ message: "Missing Authorization Bearer token" });
  }

  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const username = String(payload?.username || "").trim().toLowerCase();
    if (!username) {
      return res.status(401).json({ message: "Invalid access token" });
    }

    // Enforce "disabled users cannot act" on every protected route
    // This handles the "disabled + refresh" case as well as any subsequent actions.
    const [[row]] = await pool.query(
      "SELECT active FROM accounts WHERE username = ? LIMIT 1",
      [username]
    );
    if (!row) {
      return res.status(401).json({ message: "Unknown user" });
    }
    const isActive = !!row.active; 
    if (!isActive) {
      return res
        .status(403)
        .json({ ok: false, code: "ACCOUNT_DISABLED", message: "Not permitted. Your privileges/account status has changed; please refresh." });
    }

    req.user = { username };
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

/** Helpers for refresh cookie (HttpOnly) */
export function setRefreshCookie(res, refreshToken) {
  const now = new Date();
  console.log(
    `3refresh cookie made: ${now.toISOString()} (unix ${Math.floor(
      now.getTime() / 1000
    )})`
  );

  res.cookie("rt", refreshToken, {
    httpOnly: true,
    secure: true, // you’re on HTTPS localhost; keep true in prod
    sameSite: "none",
    path: "/api/auth/refresh",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days (matches default)
  });
}
