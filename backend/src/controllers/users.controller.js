// Matches accounts table: id, username, password, email, active, usergroups
import pool from "../models/db.js";

// Convert DB "usergroups" (CSV/string) <-> UI array
const toArray = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const toCSV = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join(",") : String(arr ?? ""));

// Password rule kept the same as your UI (8–10, letters+digits+special)
const pwdOk = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

/** GET /api/users */
export async function list(_req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, password, email, active, usergroups FROM accounts ORDER BY id DESC"
    );
    const data = rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email ?? "",
      usergroup: toArray(r.usergroups), // array for the UI
      active: !!r.active,
      // Never send raw password to UI — keep masked client-side
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

    // Minimal fields for this schema:
    const usernameDb = ( username || "").trim();

    if (!usernameDb || !email || !password) {
      return res.status(400).send("username/email/password are required");
    }
    if (!pwdOk(password)) {
      return res
        .status(400)
        .send("Password must be 8–10 chars, include letters, numbers, and a special character.");
    }

    const [r] = await pool.query(
      `INSERT INTO accounts (username, password, email, active, usergroups)
       VALUES (?, ?, ?, ?, ?)`,
      [usernameDb, password, email, active ? 1 : 0, toCSV(usergroup)]
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
      password,           // optional; only update if provided
      usergroup = [],
      active = true,
    } = req.body ?? {};

    const usernameDb = (username || "").trim();
    if (!usernameDb || !email) {
      return res.status(400).send("username and email are required");
    }

    const params = [usernameDb, email];
    let sql = `UPDATE accounts SET username=?, email=?`;

    if (password && password.length > 0) {
      if (!pwdOk(password)) {
        return res
          .status(400)
          .send("Password must be 8–10 chars, include letters, numbers, and a special character.");
      }
      sql += `, password=?`;
      params.push(password);
    }

    sql += `, usergroups=?, active=? WHERE id=?`;
    params.push(toCSV(usergroup), active ? 1 : 0, id);

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
    next(e);
  }
}

/** PATCH /api/users/:id/active */
export async function patchActive(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { active } = req.body ?? {};
    await pool.query("UPDATE accounts SET active=? WHERE id=?", [active ? 1 : 0, id]);

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
    next(e);
  }
}

export default { list, create, update, patchActive };
