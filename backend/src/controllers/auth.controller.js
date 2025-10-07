// backend/src/controllers/auth.controller.js
import pool from "../models/db.js"; // default export from your db module (promise API)

/**
 * POST /auth  (or /api/auth/login if you prefer)
 * Accepts JSON or x-www-form-urlencoded: { username, password }
 * NOTE: This matches your current DB (plaintext). Switch to bcrypt when ready.
 */
// src/app.js (top, after dotenv)
console.log("DB:", process.env.DB_HOST, process.env.DB_NAME);

export const login = async (req, res, next) => {
  try {
    const username = req.body?.username ?? req.query?.username;
    const password = req.body?.password ?? req.query?.password;

    if (!username || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Please enter Username and Password!" });
    }

    // Plaintext check (as in your DB). Replace with bcrypt later.
    const [rows] = await pool.query(
      "SELECT id, username FROM accounts WHERE username = ? AND password = ? LIMIT 1",
      [username, password]
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ ok: false, message: "Incorrect Username and/or Password!" });
    }

    // Set session
    req.session.loggedin = true;
    req.session.username = rows[0].username;

    return res.json({ ok: true, username: rows[0].username });
  } catch (err) {
    console.error("Auth login error:", err);
    next(err);
  }
};

/**
 * GET /adminhome (example protected endpoint)
 */
export const adminhome = (req, res) => {
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
 * POST /logout (GET also fine if you want)
 */
export const logout = (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
};
