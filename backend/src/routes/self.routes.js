import { Router } from "express";
import pool from "../models/db.js";
import bcrypt from "bcrypt";

const r = Router();

// GET current user
r.get("/current", async (req, res) => {
  const userId = req.user.id;
  const [rows] = await pool.query(
    "SELECT id, username, email, usergroups, active FROM accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  if (rows.length === 0) return res.status(404).json({ message: "Not found" });

  const u = rows[0];
  // normalise usergroups to array on the wire
  const usergroup = String(u.usergroups || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  res.json({
    id: u.id,
    username: u.username,
    email: u.email,
    usergroup,
    active: !!u.active,
  });
});

// PUT current user (email and/or password)
r.put("/current", async (req, res) => {
  const userId = req.user.id;
  const { email, currentPassword, newPassword } = req.body ?? {};

  // load current user
  const [rows] = await pool.query(
    "SELECT id, email, password_hash, usergroups, username, active FROM accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  if (rows.length === 0) return res.status(404).json({ message: "Not found" });
  const user = rows[0];

  // fields to update
  const updates = [];
  const params = [];

  if (typeof email === "string" && email.trim() && email.trim() !== user.email) {
    updates.push("email = ?");
    params.push(email.trim());
  }

  if ((currentPassword || newPassword) !== undefined) {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both currentPassword and newPassword are required to change password" });
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

  res.json({
    id: u2.id,
    username: u2.username,
    email: u2.email,
    usergroup,
    active: !!u2.active,
  });
});

export default r;
