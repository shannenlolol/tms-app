// Matches accounts table: id, username, password, email, active, usergroups
import pool from "../models/db.js";
import bcrypt from "bcrypt";

const ROUNDS = 12; // 10–12 is common

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
    const g = String(raw || "").trim();
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

// Ensure username/email uniqueness
async function assertUniqueUsernameEmail({ username, email, excludeId = null }) {
  const params = [];
  let sql = "SELECT id, username, email FROM accounts WHERE (username = ? OR email = ?)";
  params.push(username, email);
  if (excludeId != null) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }
  sql += " LIMIT 1";

  const [rows] = await pool.query(sql, params);
  if (rows.length) {
    const taken = rows[0].username === username ? "username" : "email";
    const value = rows[0][taken];
    const msg = taken === "username"
      ? `Username '${value}' is already in use.`
      : `Email '${value}' is already in use.`;
    const err = new Error(msg);
    err.status = 409;
    throw err;
  }
}

/** GET /api/users */
export async function list(_req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, email, active, usergroups FROM accounts ORDER BY id ASC"
    );
    const data = rows.map((r) => ({
      id: r.id,
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

    const usernameDb = String(username || "").trim();
    const emailDb = String(email || "").trim();

    if (!usernameDb || !emailDb || !password) {
      return res.status(400).send("username/email/password are required");
    }
    if (!emailOk(emailDb)) {
      return res.status(400).send("Email must be valid.");
    }
    if (!pwdOk(password)) {
      return res
        .status(400)
        .send(
          "Password must be 8–10 chars, include letters, numbers, and a special character."
        );
    }

    await assertUniqueUsernameEmail({ username: usernameDb, email: emailDb });

    const cleanGroups = await normaliseGroups(usergroup);
    const password_hash = await bcrypt.hash(password, ROUNDS);

    const [r] = await pool.query(
      `INSERT INTO accounts (username, password, email, active, usergroups)
       VALUES (?, ?, ?, ?, ?)`,
      [usernameDb, password_hash, emailDb, active ? 1 : 0, toCSV(cleanGroups)]
    );

    const [[row]] = await pool.query(
      "SELECT id, username, email, active, usergroups FROM accounts WHERE id=?",
      [r.insertId]
    );

    res.status(201).json({
      id: row.id,
      username: row.username,
      email: row.email ?? "",
      usergroup: toArray(row.usergroups),
      active: !!row.active,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).send(e.message);
    next(e);
  }
}

/** PUT /api/users/:id  (full update; password optional) */
export async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).send("Invalid id");

    const {
      username,
      email,
      password, // optional; only update if provided
      usergroup = [],
      active = true,
    } = req.body ?? {};

    const usernameDb = String(username || "").trim();
    const emailDb = String(email || "").trim();

    if (!usernameDb || !emailDb) {
      return res.status(400).send("username and email are required");
    }
    if (!emailOk(emailDb)) {
      return res.status(400).send("Email must be valid.");
    }

    await assertUniqueUsernameEmail({
      username: usernameDb,
      email: emailDb,
      excludeId: id,
    });

    const cleanGroups = await normaliseGroups(usergroup);

    const params = [usernameDb, emailDb];
    let sql = `UPDATE accounts SET username=?, email=?`;

    if (password && password.length > 0) {
      if (!pwdOk(password)) {
        return res
          .status(400)
          .send(
            "Password must be 8–10 chars, include letters, numbers, and a special character."
          );
      }
      const password_hash = await bcrypt.hash(password, ROUNDS);
      sql += `, password=?`;
      params.push(password_hash);
    }

    sql += `, usergroups=?, active=? WHERE id=?`;
    params.push(toCSV(cleanGroups), active ? 1 : 0, id);

    await pool.query(sql, params);

    const [[row]] = await pool.query(
      "SELECT id, username, email, active, usergroups FROM accounts WHERE id=?",
      [id]
    );

    res.json({
      id: row.id,
      username: row.username,
      email: row.email ?? "",
      usergroup: toArray(row.usergroups),
      active: !!row.active,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).send(e.message);
    next(e);
  }
}

/** PATCH /api/users/:id/active */
export async function patchActive(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).send("Invalid id");
    const { active } = req.body ?? {};

    await pool.query("UPDATE accounts SET active=? WHERE id=?", [
      active ? 1 : 0,
      id,
    ]);

    const [[row]] = await pool.query(
      "SELECT id, username, email, active, usergroups FROM accounts WHERE id=?",
      [id]
    );
    if (!row) return res.status(404).send("User not found");

    res.json({
      id: row.id,
      username: row.username,
      email: row.email ?? "",
      usergroup: toArray(row.usergroups),
      active: !!row.active,
    });
  } catch (e) {
    next(e);
  }
}

// ---- Frontend compatibility aliases ----
export const getUsers = list;
export const createUser = create;
export const updateUser = update;
export const toggleActive = patchActive;

export default { list, create, update, patchActive };
