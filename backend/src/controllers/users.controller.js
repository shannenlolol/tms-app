/* controllers/users.controller.js
 * CRUD for accounts: list, create, update, toggle active; normalises usergroups CSV ⇄ array and validates inputs.
 * Enforces basic uniqueness, password policy, and group validity against user_groups.
 */

import pool from "../models/db.js";
import bcrypt from "bcrypt";
import { enforceHardcodedAdmin, hardcodedAdmin } from "../policy/hardcodedAdmin.js";

const ROUNDS = 12; // 10–12 is common

const NAME_MAX = 50;
const NAME_RE = /^[A-Za-z0-9 !@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]+$/;
const nameValid = (s) => {
  return (
    typeof s === "string" &&
    s.length > 0 &&
    s.length <= NAME_MAX &&
    NAME_RE.test(s)
  );
};


// Convert DB "usergroups" (CSV/string) <-> UI array
const toArray = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const toCSV = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(",");

// Email regex (same spirit as UI)
const emailRe =
  /^(?!.*\.\.)[A-Za-z0-9_%+-](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/i;
const emailOk = (s) => typeof s === "string" && emailRe.test(s);

// Password rule kept the same as your UI (8–10, letters+digits+special)
const pwdOk = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

// Fetch active group names once per call (keeps logic simple & strict)
async function getActiveGroupNames() {
  const [rows] = await pool.query(
    "SELECT name FROM user_groups ORDER BY name"
  );
  return rows.map((r) => r.name);
}

// Normalise and validate usergroup array against DB groups
async function normaliseGroups(input) {
  const allowed = new Set(await getActiveGroupNames());
  // Deduplicate, trim, keep only allowed, and disallow commas in names (enforced at DB too)
  const out = [];
  for (const raw of Array.isArray(input) ? input : []) {
    const g = String(raw || "").trim().toLowerCase();
    if (!g || g.includes(",")) {
      throw new Error("Invalid group name.");
    }
    if (!allowed.has(g)) {
      throw new Error(`Invalid group: ${g}`);
    }
    if (!out.includes(g)) out.push(g);
  }
  return out;
}
// Actor must be both admin and active at the moment of save
async function isAdminCurrently(conn, username) {
  const uname = String(username || "").trim().toLowerCase();
  if (!uname) return false;

  const [[row]] = await conn.query(
    "SELECT usergroups, active FROM accounts WHERE username = ? LIMIT 1",
    [uname]
  );
  if (!row) return false;

  const isActive = !!row.active; // 1/0 → boolean
  const isAdmin = String(row.usergroups || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes("admin");

  return isActive && isAdmin;
}


// Ensure username/email uniqueness (case-insensitive email)
// !! excludeUsername for update (since can't edit username, just ensure email is unique)
async function assertUniqueUsernameEmail({ username, email, excludeUsername = null }) {
  const emailLc = String(email || "").toLowerCase();
  const params = [username, emailLc];

  let sql =
    "SELECT username, email FROM accounts " +
    "WHERE (username = ? OR LOWER(email) = ?)";

  sql += " LIMIT 1";

  const [rows] = await pool.query(sql, params);

  if (!rows.length || excludeUsername) {
    return { ok: true };
  }

  const row = rows[0];
  if (row.username === username) {
    return {
      ok: false,
      field: "username",
      code: "USERNAME_TAKEN",
      message: `Username or email is already in use`,
    };
  }
  if (String(row.email || "").toLowerCase() === emailLc) {
    return {
      ok: false,
      field: "email",
      code: "EMAIL_TAKEN",
      message: `Username or email is already in use`,
    };
  }
  return {
    ok: false,
    field: "unknown",
    code: "UNIQUE_CONSTRAINT",
    message: "Username or email is already in use.",
  };
}


/** GET /api/users */
export async function list(_req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT username, email, active, usergroups FROM accounts"
    );
    const data = rows.map((r) => ({
      username: r.username,
      email: r.email ?? "",
      usergroup: toArray(r.usergroups), // array for the UI
      active: !!r.active,
    }));
    res.json(data);
  } catch (e) {
    next(e);
  }
}

/** POST /api/users  (create) */
export async function create(req, res, next) {
  try {
    const {
      username,
      email,
      password,
      usergroup = [],
      active = true,
    } = req.body ?? {};

    const usernameDb = String(username || "").trim().toLowerCase();
    const emailDb = String(email || "").trim();
    if (!usernameDb || !emailDb || !password) {
      return res.status(400).json({ ok: false, message: "Field(s) cannot be empty." });
    }
    if (!nameValid(usernameDb)) {
      return res.status(400).json({ ok: false, message: `Username must not be longer than –${NAME_MAX} characters.`});
    }
    if (!emailOk(emailDb)) {
      return res.status(400).json({ ok: false, message: "Email must be valid." });
    }
    if (!pwdOk(password)) {
      return res.status(400).json({
        ok: false,
        message: "Password must be 8–10 characters long and include at least one letter, one number, and one special character.",
      });
    }

    const uniq = await assertUniqueUsernameEmail({ username: usernameDb, email: emailDb });
    if (!uniq.ok) {
      return res.status(409).json({
        ok: false,
        code: uniq.code,
        field: uniq.field,
        message: uniq.message,
      });
    }

    const cleanGroups = await normaliseGroups(usergroup);
    const password_hash = await bcrypt.hash(password, ROUNDS);

    await pool.query(
      `INSERT INTO accounts (username, password, email, active, usergroups)
       VALUES (?, ?, ?, ?, ?)`,
      [usernameDb, password_hash, emailDb, active ? 1 : 0, toCSV(cleanGroups)]
    );

    const [[row]] = await pool.query(
      "SELECT username, email, active, usergroups FROM accounts WHERE username=? LIMIT 1",
      [usernameDb]
    );

    res.status(201).json({
      username: row.username,
      email: row.email ?? "",
      usergroup: toArray(row.usergroups),
      active: !!row.active,
    });
  } catch (e) {
    if (e.status) {
      // Keep all errors JSON so the client can show the real message
      return res.status(e.status).json({
        ok: false,
        code: e.code || "ERROR",
        message: e.message || "Request failed",
      });
    }
    next(e);
  }
}


/** PUT /api/users/:username  (full update; password optional) */
export async function update(req, res, next) {
  const conn = await pool.getConnection();
  try {
    // target username comes from URL, not the logged-in user
    const targetUsername = req.params.username;
    const check = enforceHardcodedAdmin({ targetUsername, body: req.body || {} });
    if (!check.ok) {
      return res.status(check.status || 409).json({
        ok: false,
        code: check.code || "POLICY_VIOLATION",
        message: check.message,
      });
    }

    const actor = String(req.user?.username || "").trim().toLowerCase();
    if (!actor) {
      return res.status(401).json({ ok: false, message: "Unauthorised" });
    }

    await conn.beginTransaction();

    // PRIVILEGE DRIFT CHECK (admin AND active must still hold)
    const stillCanAdmin = await isAdminCurrently(conn, actor);
    if (!stillCanAdmin) {
      await conn.rollback();
      return res.status(403).json({
        ok: false,
        code: "PRIVILEGE_DRIFT",
        message: "Not permitted. Your privileges/account status has changed; please refresh.",
      });
    }

    // Inputs
    const {
      username,
      email,
      password, // optional; only update if provided
      usergroup = [],
      active = true,
    } = req.body ?? {};

    const usernameDb = String(username || "").trim().toLowerCase();
    const emailDb = String(email || "").trim().toLowerCase(); // normalise email

    if (!emailOk(emailDb)) {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Email must be valid." });
    }

    // Uniqueness (kept same)
    const uniq = await assertUniqueUsernameEmail({
      username: usernameDb,
      email: emailDb,
      excludeUsername: true,
    });
    if (!uniq.ok) {
      await conn.rollback();
      return res.status(409).json({
        ok: false,
        code: uniq.code,
        field: uniq.field,
        message: uniq.message,
      });
    }

    const cleanGroups = await normaliseGroups(usergroup);

    // Build dynamic UPDATE (only include password if provided)
    const fields = ["username = ?", "email = ?", "usergroups = ?", "active = ?"];
    const params = [usernameDb, emailDb, toCSV(cleanGroups), active ? 1 : 0];

    if (password && password.length > 0) {
      if (!pwdOk(password)) {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          message:
            "Password must be 8–10 characters long and include at least one letter, one number, and one special character.",
        });
      }
      const password_hash = await bcrypt.hash(password, ROUNDS);
      fields.push("password = ?");
      params.push(password_hash);
    }

    // IMPORTANT: scope to the targeted row
    params.push(targetUsername);
    const sql = `UPDATE accounts SET ${fields.join(", ")} WHERE username = ? LIMIT 1`;
    await conn.query(sql, params);

    // Return the updated row
    const [[row]] = await conn.query(
      "SELECT username, email, active, usergroups FROM accounts WHERE username = ? LIMIT 1",
      [targetUsername]
    );
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "User not found after update." });
    }

    await conn.commit();
    return res.json({
      username: row.username,
      email: row.email ?? "",
      usergroup: toArray(row.usergroups),
      active: !!row.active,
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    if (e.status) {
      return res.status(e.status).json({
        ok: false,
        code: e.code || "ERROR",
        message: e.message || "Request failed",
      });
    }
    next(e);
  } finally {
    conn.release();
  }
}


/* POST /api/users/check-group */
export async function checkGroup(req, res, next) {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const group    = String(req.body?.usergroup || "").trim().toLowerCase();
    if (!username || !group) return res.status(400).json(false);

    const [[row]] = await pool.query(
      "SELECT usergroups FROM accounts WHERE username = ? LIMIT 1",
      [username]
    );
    if (!row) return res.status(404).json(false);

    const member = toArray(row.usergroups).map(g => g.toLowerCase()).includes(group);
    return res.json(member); // strictly boolean
  } catch {
    return res.status(500).json(false);
  }
}

// ---- Frontend compatibility aliases ----
export const getUsers = list;
export const createUser = create;
export const updateUser = update;

export default { list, create, update };
