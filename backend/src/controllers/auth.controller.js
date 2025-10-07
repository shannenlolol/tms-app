import bcrypt from "bcrypt";
import pool from "../models/db.js";

// tiny helper: DB CSV/string -> array
const toArray = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const login = async (req, res, next) => {
  try {
    const username = (req.body?.username ?? req.query?.username ?? "").trim();
    const password = req.body?.password ?? req.query?.password;

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Please enter Username and Password!" });
    }

    // 1) Fetch active user
    const [rows] = await pool.query(
      `SELECT id, username, password AS password_hash, active, usergroups
         FROM accounts
        WHERE username = ? AND active = 1
        LIMIT 1`,
      [username]
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ ok: false, message: "Incorrect Username and/or Password!" });
    }

    const user = rows[0];

    // 2) Verify password against bcrypt hash
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ ok: false, message: "Incorrect Username and/or Password!" });
    }

    // 3) Derive groups/role
    const groups = toArray(user.usergroups);
    const isAdmin = groups.includes("AD");

    // 4) Establish session (regenerate = fix session fixation)
    req.session.regenerate?.((err) => {
      if (err) {
        console.error("session regenerate error:", err);
        // fall back to using existing session
      }

      req.session.loggedin = true;
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.groups = groups;
      req.session.isAdmin = isAdmin;
      return res.json({
        ok: true,
        userId: user.id,
        username: user.username,
        isAdmin: isAdmin,
      });
    });
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
      isAdmin: req.session?.isAdmin,
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
