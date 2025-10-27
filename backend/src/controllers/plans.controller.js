// backend/src/controllers/plans.controller.js
import pool from "../models/db.js";

export async function listPlans(req, res) {
  try {
    const { app } = req.query || {};
    const where = [];
    const args = [];
    if (app) { where.push("Plan_app_Acronym = ?"); args.push(app); }

    const [rows] = await pool.query(
      `SELECT Plan_MVP_name, Plan_startDate, Plan_endDate, Plan_app_Acronym
       FROM plan
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY Plan_MVP_name ASC`,
      args
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, message: "Failed to list plans" });
  }
}

/**
 * Create a plan with no app binding yet.
 * Body: { Plan_MVP_name, Plan_startDate, Plan_endDate }
 * - Plan_app_Acronym will be NULL and can be set later (e.g., when releasing a task).
 */
export async function createPlan(req, res) {
  try {
    const { Plan_MVP_name, Plan_startDate, Plan_endDate, Plan_app_Acronym } = req.body || {};
    const name = String(Plan_MVP_name || "").trim();
    if (!name) return res.status(400).json({ ok:false, message:"Plan name required" });

    await pool.query(
      `INSERT INTO plan (Plan_MVP_name, Plan_startDate, Plan_endDate, Plan_app_Acronym)
       VALUES (?, ?, ?, ?)`,
      [name, Plan_startDate || null, Plan_endDate || null, Plan_app_Acronym || null]
    );

    res.status(201).json({ ok:true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok:false, message:"Plan already exists" });
    }
    res.status(500).json({ ok:false, message:e.message || "Failed to create plan" });
  }
}

/** Optional: later you can add an endpoint to bind a plan to an app */
export async function attachPlanToApp(req, res) {
  try {
    const { planName } = req.params;
    const { appAcronym } = req.body || {};
    if (!planName || !appAcronym) {
      return res.status(400).json({ ok: false, message: "Plan and App are required" });
    }
    const [apps] = await pool.query(
      "SELECT 1 FROM application WHERE App_Acronym = ? LIMIT 1",
      [appAcronym]
    );
    if (!apps.length) return res.status(404).json({ ok: false, message: "Application not found" });

    await pool.query(
      "UPDATE plan SET Plan_app_Acronym = ? WHERE Plan_MVP_name = ?",
      [appAcronym, planName]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Failed to attach plan" });
  }
}
