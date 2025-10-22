// controllers/self.controller.js
//  * Implements GET /api/current and PUT /api/current.
//  * Validates email/password rules, verifies currentPassword before change, updates DB, and returns fresh profile.

import pool from "../models/db.js";
import bcrypt from "bcrypt";

const emailRe =
  /^(?!.*\.\.)[A-Za-z0-9_%+-](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/i;
const emailValid = (s) => typeof s === "string" && emailRe.test(s);

const pwdValid = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);


// Ensure email uniqueness (case-insensitive email)
async function assertUniqueEmail({ email}) {
  const emailLc = String(email || "").toLowerCase();
  const params = [emailLc];

  let sql =
    "SELECT email FROM accounts " +
    "WHERE (LOWER(email) = ?)";

  sql += " LIMIT 1";

  const [rows] = await pool.query(sql, params);

  if (!rows.length) {
    return { ok: true };
  }

  const row = rows[0];
  if (String(row.email || "").toLowerCase() === emailLc) {
    console.log(emailLc, row.email, "sadasdad");
    return {
      ok: false,
      field: "email",
      code: "EMAIL_TAKEN",
      message: `Email '${emailLc}' is already in use.`,
    };
  }
  return {
    ok: false,
    field: "unknown",
    code: "UNIQUE_CONSTRAINT",
    message: "Email is already in use.",
  };
}


/** GET /api/users/current */
export async function getCurrentUser(req, res) {
  const username = req.user?.username;
  if (!username) return res.status(401).json({ message: "Unauthenticated" });

  const [rows] = await pool.query(
    "SELECT username, email, usergroups, active FROM accounts WHERE username = ? LIMIT 1",
    [username]
  );
  if (rows.length === 0) return res.status(404).json({ message: "Not found" });

  const u = rows[0];
  const usergroup = String(u.usergroups || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res.json({ username: u.username, email: u.email, usergroup, active: !!u.active });
}

/** PUT /api/users/current  { email?, currentPassword?, newPassword?, confirmPassword } */
export async function updateCurrentUser(req, res) {
  const username = req.user?.username;
  if (!username) return res.status(401).json({ message: "Unauthenticated" });

  let { email = "", currentPassword = "", newPassword = "", confirmPassword = "" } = req.body ?? {};
  email = String(email).trim();
  currentPassword = String(currentPassword || "");
  newPassword = String(newPassword || "");
  confirmPassword = String(confirmPassword || "");

  // Load current user (need existing values and hash)
  const [[me]] = await pool.query(
    "SELECT username, email, password FROM accounts WHERE username = ? LIMIT 1",
    [username]
  );
  if (!me) return res.status(404).json({ message: "Not found" });

  const updates = [];
  const params = [];

  // ---- EMAIL CHANGE (no password required) ----
  const emailChanged =
    !!email && email.toLowerCase() !== String(me.email || "").toLowerCase();

  if (emailChanged) {
    if (!emailValid(email)) {
      return res.status(400).json({ message: "Email must be valid." });
    }
    const uniq = await assertUniqueEmail({ email: email });
    if (!uniq.ok) {
      return res.status(409).json({
        ok: false,
        code: uniq.code,
        field: uniq.field,
        message: uniq.message,
      });
    }
    updates.push("email = ?");
    params.push(email.toLowerCase());
  }

  // ---- PASSWORD CHANGE (requires current + new, and strength) ----
    const changingPassword =
      (currentPassword || "").length > 0 ||
      (newPassword || "").length > 0 ||
      (confirmPassword || "").length > 0;

  if (changingPassword) {
    if (!currentPassword) {
      return res
        .status(400)
        .json({ message: "Please enter your current password." });
    }
    if (!newPassword) {
      return res
        .status(400)
        .json({ message: "Please enter your new password." });
    }
    if (!pwdValid(newPassword)) {
      return res.status(400).json({
        message:
          "New Password must be 8–10 characters long and include at least one letter, one number, and one special character.",
      });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({
        message:
          "The passwords do not match.",
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
    params.push(username);
    await pool.query(
      `UPDATE accounts SET ${updates.join(", ")} WHERE username = ? LIMIT 1`,
      params
    );
  } catch (err) {
    throw err;
  }

  // Return fresh profile
  const [[u2]] = await pool.query(
    "SELECT username, email, usergroups, active FROM accounts WHERE username = ? LIMIT 1",
    [username]
  );
  const usergroup = String(u2.usergroups || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res.json({
    username: u2.username,
    email: u2.email ?? "",
    usergroup,
    active: !!u2.active,
  });
}