// backend/src/controllers/self.controller.js
import pool from "../models/db.js";
import bcrypt from "bcrypt";

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
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthenticated" });

  const { email, currentPassword, newPassword } = req.body ?? {};

  // fetch current user (to verify password if needed)
  const [rows] = await pool.query(
    "SELECT id, email, password_hash FROM accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  if (rows.length === 0) return res.status(404).json({ message: "Not found" });

  const user = rows[0];
  const updates = [];
  const params = [];

  // email change (if different)
  if (typeof email === "string" && email.trim() && email.trim() !== user.email) {
    updates.push("email = ?");
    params.push(email.trim());
  }

  // password change (if requested)
  if (currentPassword || newPassword) {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both currentPassword and newPassword are required" });
    }
    const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    const hash = await bcrypt.hash(String(newPassword), 12);
    updates.push("password_hash = ?");
    params.push(hash);
  }

  if (updates.length) {
    params.push(userId);
    await pool.query(`UPDATE accounts SET ${updates.join(", ")} WHERE id = ?`, params);
  }

  // return fresh profile
  const [rows2] = await pool.query(
    "SELECT id, username, email, usergroups, active FROM accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const u2 = rows2[0];
  const usergroup = String(u2.usergroups || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res.json({ id: u2.id, username: u2.username, email: u2.email, usergroup, active: !!u2.active });
}
