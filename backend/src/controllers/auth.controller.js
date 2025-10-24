/* controllers/auth.controller.js
 * Login verifies bcrypt hash, issues access token + sets refresh cookie; refresh mints a new access from the cookie.
 * Also supports logout (clears cookie) and check (echoes authenticated user).
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../models/db.js";
import { makeAccessToken, makeRefreshToken, setRefreshCookie } from "../middleware/jwt.js";
import { checkGroup } from "./users.controller.js";

// tiny helper: DB CSV/string -> array
const toArray = (v) => String(v ?? "").split(",").map(s => s.trim()).filter(Boolean);

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
    if (user.active !== 1){
      return res.status(401).json({ ok: false, message: "Inactive account" });
    }
    const accessToken = makeAccessToken({ username: user.username });
    const refreshToken = makeRefreshToken({ username: user.username });

    setRefreshCookie(res, refreshToken);

    return res.json({
      ok: true,
      accessToken,
      user: { username: user.username  },
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
    console.log(`verify refresh token in cookie to make access token: ${now.toISOString()} (unix ${Math.floor(now.getTime() / 1000)})`);
    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const accessToken = makeAccessToken({ username: payload.username });
    return res.json({ ok: true, accessToken });
  } catch {
    return res.status(401).json({ ok: false, message: "Invalid or expired refresh token" });
  }
};

/** POST /api/logout */
export async function logout(_req, res) {
  // MUST match the cookie attributes you used when setting it!
  res.clearCookie("rt", {
    httpOnly: true,
    secure: true,         // because you're on https://localhost
    sameSite: "none",     // cross-site (5173 <-> 3000)
    path: "/api/auth/refresh", // EXACT same path used when setting the cookie
  });
  const now = new Date();
  console.log(`5refresh cookie cleared at authcontroller: ${now.toISOString()} (unix ${Math.floor(now.getTime() / 1000)})`);

  return res.sendStatus(204); // no content
}


/** GET /api/check  (optional) */
export const check = (req, res) => {
  // With JWT, check should be behind ensureAuth; simply echoes back
  return res.json({ ok: true, user: req.user });
};
