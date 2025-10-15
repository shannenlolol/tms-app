// controllers/self.controller.js
//  * Implements GET /api/current and PUT /api/current.
//  * Validates email/password rules, verifies currentPassword before change, updates DB, and returns fresh profile.

import pool from "../models/db.js";
import bcrypt from "bcrypt";

const emailRe =
  /^(?!.*\.\.)[A-Za-z0-9_%+-](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/i;
const emailOk = (s) => typeof s === "string" && emailRe.test(s);

const pwdOk = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);
  
/** GET /api/users/current */
export async function getCurrentUser(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthenticated" });

  const [rows] = await pool.query(
    "SELECT id, username, email, usergroups, active FROM accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  if (rows.length === 0) return res.status(404).json({ message: "Not found" });

  const u = rows[0];
  const usergroup = String(u.usergroups || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res.json({ id: u.id, username: u.username, email: u.email, usergroup, active: !!u.active });
}

/** PUT /api/users/current  { email?, currentPassword?, newPassword? } */
export async function updateCurrentUser(req, res) {
  const userId = Number(req.user?.id);
  if (!userId) return res.status(401).json({ message: "Unauthenticated" });

  let { email = "", currentPassword = "", newPassword = "" } = req.body ?? {};
  email = String(email).trim();
  currentPassword = String(currentPassword || "");
  newPassword = String(newPassword || "");

  // Load current user (need existing values and hash)
  const [[me]] = await pool.query(
    "SELECT id, email, password FROM accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  if (!me) return res.status(404).json({ message: "Not found" });

  const updates = [];
  const params = [];

  // ---- EMAIL CHANGE (no password required) ----
  const emailChanged =
    !!email && email.toLowerCase() !== String(me.email || "").toLowerCase();

  if (emailChanged) {
    if (!emailOk(email)) {
      return res.status(400).json({ message: "Email must be valid." });
    }
    // OPTIONAL: enforce uniqueness gracefully (if DB unique index exists,
    // catch ER_DUP_ENTRY below instead of pre-checking)
    updates.push("email = ?");
    params.push(email.toLowerCase());
  }

  // ---- PASSWORD CHANGE (requires current + new, and strength) ----
  const passwordChanging = !!currentPassword || !!newPassword;

  if (passwordChanging) {
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Please provide current and new password." });
    }
    if (!pwdOk(newPassword)) {
      return res.status(400).json({
        message:
          "New password must be 8–10 chars and include letters, numbers, and a special character.",
      });
    }
    const ok = await bcrypt.compare(currentPassword, me.password || "");
    if (!ok) return res.status(401).json({ message: "Current password is incorrect." });

    const hash = await bcrypt.hash(newPassword, 12);
    updates.push("password = ?");
    params.push(hash);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No changes to save." });
  }

  try {
    params.push(userId);
    await pool.query(
      `UPDATE accounts SET ${updates.join(", ")} WHERE id = ? LIMIT 1`,
      params
    );
  } catch (err) {
    // Friendly duplicate-email message if unique index triggers
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already in use." });
    }
    throw err;
  }

  // Return fresh profile
  const [[u2]] = await pool.query(
    "SELECT id, username, email, usergroups, active FROM accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const usergroup = String(u2.usergroups || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res.json({
    id: u2.id,
    username: u2.username,
    email: u2.email ?? "",
    usergroup,
    active: !!u2.active,
  });
}