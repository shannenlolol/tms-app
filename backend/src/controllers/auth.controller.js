// backend/src/controllers/auth.controller.js
import pool from "../models/db.js";
import bcrypt from "bcrypt";

// Optional: log DB info early for debugging (remove in production)
console.log("DB:", process.env.DB_HOST, process.env.DB_NAME);

/**
 * POST /auth  (or /api/auth/login)
 * Body: { username, password }
 */
export const login = async (req, res, next) => {
  try {
    const username = (req.body?.username ?? req.query?.username ?? "").trim();
    const password = req.body?.password ?? req.query?.password;

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Please enter Username and Password!" });
    }

    // 1) Look up user by username; only allow active accounts to log in.
    //    (Keeping a single generic error message avoids username enumeration.)
    const [rows] = await pool.query(
      `SELECT id, username, password AS password_hash, active, usergroups
       FROM accounts
       WHERE username = ? AND active = 1
       LIMIT 1`,
      [username]
    );

    if (rows.length === 0) {
      // Either user doesn't exist or is inactive — same message.
      return res
        .status(401)
        .json({ ok: false, message: "Incorrect Username and/or Password!" });
    }

    const user = rows[0];

    // 2) Compare plaintext password to the stored bcrypt hash.
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ ok: false, message: "Incorrect Username and/or Password!" });
    }

    // 3) Establish session.
    req.session.loggedin = true;
    req.session.userId = user.id;
    req.session.username = user.username;

    return res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error("Auth login error:", err);
    next(err);
  }
};


export const check = (req, res) => {
  if (req.session?.loggedin) {
    return res.json({
      ok: true,
      username: req.session.username,
      message: `Welcome back, ${req.session.username}!`,
    });
  }
  return res
    .status(401)
    .json({ ok: false, message: "Please login to view this page!" });
};

/**
 * POST /logout
 */
export const logout = (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
};
