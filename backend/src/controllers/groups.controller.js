import pool from "../models/db.js";

export const listGroups = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT name FROM user_groups ORDER BY name"
    );
    res.json(rows.map(r => r.name)); // ["Admin","Dev Team",...]
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message || "Failed to load groups" });
  }
};
