// routes/groups.routes.js
//  * Simple group catalogue: list all group names, create a new group.
//  * GET /api/groups, POST /api/groups (handles duplicate names gracefully).

import { Router } from "express";
import pool from "../models/db.js"; // mysql2/promise pool

const r = Router();

// Return full-name groups like ["Admin","Dev Team",...]
r.get("/", async (req, res) => {
  const [rows] = await pool.query("SELECT name FROM user_groups ORDER BY name ASC");
  res.json(rows.map((x) => x.name));
});

// Create a new group
r.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ message: "Name is required" });

  try {
    await pool.query("INSERT INTO user_groups (name) VALUES (?)", [name]);
  } catch (e) {
    // handle duplicate nicely
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Group already exists" });
    }
    throw e;
  }
  res.status(201).json({ name });
});

export default r;
