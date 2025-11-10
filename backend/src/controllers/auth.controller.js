/* controllers/auth.controller.js
 * Login verifies bcrypt hash, issues access token cookie + sets refresh cookie;
 * /refresh mints a new access token cookie from the refresh cookie.
 * Also supports logout (clears both cookies) and check (echoes authenticated user).
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../models/db.js";
import {
  makeAccessToken,
  makeRefreshToken,
  setRefreshCookie,
  setAccessCookie,
  clearAccessCookie,
  clearRefreshCookie,
} from "../middleware/jwt.js";

/** POST /api/auth  { username, password } */
export const login = async (req, res, next) => {
  try {
    const username = (req.body?.username ?? "").trim();
    const password = req.body?.password ?? "";

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: "Invalid Username and/or Password" });
    }

    // Accept both schemas: password or password_hash
    const [rows] = await pool.query(
      `SELECT username, password AS password_hash, active, usergroups
         FROM accounts
        WHERE username = ?
        LIMIT 1`,
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ ok: false, message: "Invalid Username and/or Password" });
    }
    

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ ok: false, message: "Invalid Username and/or Password" });
    }
    if (user.active !== 1) {
      return res.status(401).json({ ok: false, message: "Inactive account" });
    }
    const ua = req.headers["user-agent"] || "";
    const ip = req.ip;

    // Mint tokens
    const accessToken = makeAccessToken(user, { ua, ip });
    const refreshToken = makeRefreshToken({ username: user.username });

    // Set cookies (HttpOnly). Access cookie replaces Authorization header usage.
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);

    // Return minimal body (no tokens in JSON)
    return res.json({
      ok: true,
      user: { username: user.username },
    });
  } catch (err) {
    console.error("Auth login error:", err);
    next(err);
  }
};

/** GET /api/auth/refresh  (uses HttpOnly refresh cookie) */
export const refresh = (req, res) => {
  const token = req.cookies?.rt;
  if (!token) {
    return res.status(401).json({ ok: false, message: "Missing refresh token" });
  }
  try {
    const now = new Date();
    console.log(
      `verify refresh token in cookie to make access token: ${now.toISOString()} (unix ${Math.floor(
        now.getTime() / 1000
      )})`
    );
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const ua = req.headers["user-agent"] || "";
    const ip = req.ip;
    const newAT = makeAccessToken({ username: payload.username }, { ua, ip });
    // Set/overwrite the access cookie; do not return token in body
    setAccessCookie(res, newAT);
    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ ok: false, message: "Invalid or expired refresh token" });
  }
};

/** POST /api/logout */
export async function logout(_req, res) {
  // Clear both cookies; attributes must match those used when setting them.
  clearAccessCookie(res);
  clearRefreshCookie(res);

  const now = new Date();
  console.log(
    `5cookies cleared at authcontroller: ${now.toISOString()} (unix ${Math.floor(
      now.getTime() / 1000
    )})`
  );

  return res.sendStatus(204); // no content
}

/** GET /api/check  (protected by ensureAuth; simply echoes back) */
export const check = (req, res) => {
  return res.json({ ok: true, user: req.user });
};
