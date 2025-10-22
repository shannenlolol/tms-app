/* controllers/groups.controller.js
 * Reads/creates group names in user_groups.
 */

import pool from "../models/db.js";

const NAME_MAX = 50;
const NAME_RE = /^[A-Za-z0-9 !@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]+$/;

function validateGroupName(name) {
  const s = String(name || "").trim().toLowerCase();
  if (!s) return { ok: false, code: "GROUP_NAME_REQUIRED", message: "Field cannot be empty." };
  if (s.length > NAME_MAX) return { ok: false, code: "GROUP_NAME_TOO_LONG", message: `User group must not be longer than ${NAME_MAX} characters.` };
  if (!NAME_RE.test(s)) return { ok: false, code: "GROUP_NAME_INVALID", message: "User group is invalid" };
  return { ok: true, value: s };
} 

export async function listGroups(_req, res, next) {
  try {
    const [rows] = await pool.query("SELECT name FROM user_groups ORDER BY name ASC");
    res.json(rows.map(r => r.name));
  } catch (e) {
    next(e);
  }
}

export async function createGroup(req, res, next) {
  try {
    const check = validateGroupName(req.body?.name);
    if (!check.ok) {
      return res.status(400).json({ ok: false, code: check.code, message: check.message });
    }
    const name = check.value;

    try {
      await pool.query("INSERT INTO user_groups (name) VALUES (?)", [name]);
    } catch (e) {
      // MySQL duplicate key
      if (e && (e.code === "ER_DUP_ENTRY" || (e.errno === 1062))) {
        return res.status(409).json({
          ok: false,
          code: "GROUP_EXISTS",
          message: "User group already exists.",
        });
      }
      throw e;
    }

    return res.status(201).json({ ok: true, name });
  } catch (e) {
    next(e);
  }
}
