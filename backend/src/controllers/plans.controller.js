// backend/src/controllers/plans.controller.js
import pool from "../models/db.js";

const toISO = (d) => {
  if (!d) return null;
  const x = new Date(d);
  if (Number.isNaN(+x)) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const within = (d, lo, hi) => d >= lo && d <= hi;

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
 * Create a plan (optionally bound to an application).
 * If Plan_app_Acronym is provided, enforce:
 *   - App_startDate/app_endDate must exist on the application
 *   - planStart ∈ [appStart, appEnd]
 *   - planEnd   ∈ [planStart, appEnd]  (if provided)
 */
export async function createPlan(req, res) {
  try {
    const {
      Plan_MVP_name,
      Plan_startDate,
      Plan_endDate,
      Plan_app_Acronym,
    } = req.body || {};

    const name = String(Plan_MVP_name || "").trim();
    const appAcr = String(Plan_app_Acronym || "").trim();

    // All fields mandatory
    if (!name) return res.status(400).json({ ok: false, message: "Plan name is required" });
    if (!appAcr) return res.status(400).json({ ok: false, message: "Application is required" });
    if (!Plan_startDate) return res.status(400).json({ ok: false, message: "Plan start date is required" });
    if (!Plan_endDate) return res.status(400).json({ ok: false, message: "Plan end date is required" });

    const planStartISO = toISO(Plan_startDate);
    const planEndISO = toISO(Plan_endDate);
    if (!planStartISO) return res.status(400).json({ ok: false, message: "Invalid plan start date" });
    if (!planEndISO) return res.status(400).json({ ok: false, message: "Invalid plan end date" });
    if (planEndISO < planStartISO) {
      return res.status(400).json({ ok: false, message: `Plan start date and end date must be between application's start and end date `, });
    }

    // Look up application and validate window
    const [[app]] = await pool.query(
      "SELECT App_startDate, App_endDate FROM application WHERE App_Acronym = ? LIMIT 1",
      [appAcr]
    );
    if (!app) return res.status(404).json({ ok: false, message: "Application not found" });

    const appStart = toISO(app.App_startDate);
    const appEnd = toISO(app.App_endDate);
    if (!appStart || !appEnd) {
      return res.status(400).json({ ok: false, message: "Application must have both start and end dates set" });
    }
    if (appEnd < appStart) {
      return res.status(400).json({ ok: false, message: "Application end date is before start date" });
    }

    // Enforce plan inside application window (inclusive)
    if (!within(planStartISO, appStart, appEnd)) {
      return res.status(400).json({
        ok: false,
        message: `Plan start date and end date must be between application's start and end date `,
      });
    }
    if (planEndISO > appEnd) {
      return res.status(400).json({
        ok: false,
        message: `Plan start date and end date must be between application's start and end date `,
      });
    }

    await pool.query(
      `INSERT INTO plan (Plan_MVP_name, Plan_startDate, Plan_endDate, Plan_app_Acronym)
       VALUES (?, ?, ?, ?)`,
      [name, planStartISO, planEndISO, appAcr]
    );

    res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Plan already exists" });
    }
    res.status(500).json({ ok: false, message: e.message || "Failed to create plan" });
  }
}

/**
 * Bind an existing plan to an application, enforcing the same date constraints.
 */
export async function attachPlanToApp(req, res) {
  try {
    const { planName } = req.params;
    const { appAcronym } = req.body || {};
    if (!planName || !appAcronym) {
      return res.status(400).json({ ok: false, message: "Plan and App are required" });
    }

    const [[app]] = await pool.query(
      "SELECT App_startDate, App_endDate FROM application WHERE App_Acronym = ? LIMIT 1",
      [appAcronym]
    );
    if (!app) return res.status(404).json({ ok: false, message: "Application not found" });

    const [[plan]] = await pool.query(
      "SELECT Plan_startDate, Plan_endDate FROM plan WHERE Plan_MVP_name = ? LIMIT 1",
      [planName]
    );
    if (!plan) return res.status(404).json({ ok: false, message: "Plan not found" });

    const appStart = toISO(app.App_startDate);
    const appEnd = toISO(app.App_endDate);
    if (!appStart || !appEnd) {
      return res.status(400).json({ ok: false, message: "Application must have both start and end dates set" });
    }
    if (appEnd < appStart) {
      return res.status(400).json({ ok: false, message: "Application end date is before start date" });
    }

    const pStart = toISO(plan.Plan_startDate);
    const pEnd = toISO(plan.Plan_endDate);

    // Validate plan dates against app window, when plan dates are present
    if (pStart && !within(pStart, appStart, appEnd)) {
      return res.status(400).json({
        ok: false,
        message: `Plan start date and end date must be between application's start and end date `,
      });
    }
    if (pEnd) {
      if (pStart && pEnd < pStart) {
        return res.status(400).json({
          ok: false, message: `Plan start date and end date must be between application's start and end date `,
        });
      }
      if (pEnd > appEnd) {
        return res.status(400).json({
          ok: false, message: `Plan start date and end date must be between application's start and end date `,
        });
      }
    }

    await pool.query(
      "UPDATE plan SET Plan_app_Acronym = ? WHERE Plan_MVP_name = ?",
      [appAcronym, planName]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Failed to attach plan" });
  }
}
