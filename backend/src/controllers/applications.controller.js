/*
 * CRUD for `application` table.
 * Table columns:
 *  App_Acronym (PK), App_Description, App_Rnumber, App_startDate, App_endDate,
 *  App_permit_Create, App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
 *
 * Frontend expects: Permit_Create, Permit_Open, Permit_ToDo, Permit_Doing, Permit_Done
 * and App_taskCount (computed), plus start/end dates as ISO strings.
 */
import pool from "../models/db.js";

const asStr = (v) => (v == null ? "" : String(v));

/** Convert various inputs (Date, ISO, 'YYYY-MM-DD') to 'YYYY-MM-DD' or null if empty/invalid */
function toSQLDate(value) {
  const s = asStr(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;        // already date-only
  const d = new Date(s);
  if (!Number.isNaN(+d)) return d.toISOString().slice(0, 10);
  return null; // invalid
}

const normCSV = (v) => {
  if (Array.isArray(v)) {
    return v.map((s) => asStr(s).trim()).filter(Boolean).join(",");
  }
  return asStr(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(","); // store as comma-separated in DB
};
const isNonEmptyCSV = (v) => normCSV(v).length > 0;

// Adjust this if your task table/column names differ
const TASK_COUNT_SQL = `
  (SELECT COUNT(*) FROM task t WHERE t.Task_app_Acronym = a.App_Acronym)
`;

/** Map DB row -> API shape expected by the frontend */
function mapRow(r) {
  return {
    App_Acronym: r.App_Acronym,
    App_Description: r.App_Description,
    App_Rnumber: r.App_Rnumber,                 // still available (unused in UI)
    App_startDate: r.App_startDate,             // keep as raw date/ISO; UI formats
    App_endDate: r.App_endDate,
    // Permits (strings in DB → arrays handled by frontend normalizer; returning strings is OK)
    Permit_Create: asStr(r.App_permit_Create),
    Permit_Open:   asStr(r.App_permit_Open),
    Permit_ToDo:   asStr(r.App_permit_toDoList),
    Permit_Doing:  asStr(r.App_permit_Doing),
    Permit_Done:   asStr(r.App_permit_Done),
    // Computed count
    App_taskCount: Number(r.App_taskCount ?? 0),
  };
}

export async function listApplications(req, res, next) {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        a.App_Acronym,
        a.App_Description,
        a.App_Rnumber,
        a.App_startDate,
        a.App_endDate,
        a.App_permit_Create,
        a.App_permit_Open,
        a.App_permit_toDoList,
        a.App_permit_Doing,
        a.App_permit_Done,
        ${TASK_COUNT_SQL} AS App_taskCount
      FROM application a
      ORDER BY a.App_Rnumber ASC, a.App_Acronym ASC
      `
    );
    res.json(rows.map(mapRow));
  } catch (e) {
    next(e);
  }
}

export async function createApplication(req, res, next) {
  try {
    const body = req.body || {};
    const App_Acronym     = asStr(body.App_Acronym).trim();
    const App_Description = asStr(body.App_Description);
    const App_startDate   = toSQLDate(body.App_startDate); // REQUIRED, normalised
    const App_endDate     = toSQLDate(body.App_endDate);   // REQUIRED, normalised

    // Normalised CSV permits (all REQUIRED)
    const App_permit_Create   = normCSV(body.Permit_Create);
    const App_permit_Open     = normCSV(body.Permit_Open);
    const App_permit_toDoList = normCSV(body.Permit_ToDo);
    const App_permit_Doing    = normCSV(body.Permit_Doing);
    const App_permit_Done     = normCSV(body.Permit_Done);

    // ---- Required checks ----
    if (!App_Acronym) {
      return res.status(400).json({ ok: false, message: "App_Acronym is required" });
    }
    if (!App_startDate) {
      return res.status(400).json({ ok: false, message: "App_startDate is required" });
    }
    if (!App_endDate) {
      return res.status(400).json({ ok: false, message: "App_endDate is required" });
    }

    // Date order check (safe: both are YYYY-MM-DD now)
    if (new Date(App_endDate) < new Date(App_startDate)) {
      return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    // Uniqueness on acronym
    const [exist] = await pool.query(
      `SELECT 1 FROM application WHERE App_Acronym = ? LIMIT 1`,
      [App_Acronym]
    );
    if (exist.length) {
      return res.status(409).json({ ok: false, message: "App_Acronym already exists" });
    }

    // INSERT
    await pool.query(
      `INSERT INTO application
        (App_Acronym, App_Description, App_startDate, App_endDate,
         App_permit_Create, App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        App_Acronym,
        App_Description || null,
        App_startDate,       // required & validated (YYYY-MM-DD)
        App_endDate,         // required & validated (YYYY-MM-DD)
        App_permit_Create,   // required & non-empty
        App_permit_Open,     // required & non-empty
        App_permit_toDoList, // required & non-empty
        App_permit_Doing,    // required & non-empty
        App_permit_Done,     // required & non-empty
      ]
    );

    // Return created row
    const [rows] = await pool.query(
      `
      SELECT
        a.App_Acronym, a.App_Description, a.App_Rnumber, a.App_startDate, a.App_endDate,
        a.App_permit_Create, a.App_permit_Open, a.App_permit_toDoList, a.App_permit_Doing, a.App_permit_Done,
        ${TASK_COUNT_SQL} AS App_taskCount
      FROM application a
      WHERE a.App_Acronym = ?
      LIMIT 1
      `,
      [App_Acronym]
    );
    res.status(201).json(mapRow(rows[0]));
  } catch (e) {
    next(e);
  }
}

export async function updateApplication(req, res, next) {
  try {
    const paramAcr = asStr(req.params.acronym).trim();
    if (!paramAcr) {
      return res.status(400).json({ ok: false, message: "Acronym param is required" });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    // Build dynamic UPDATE only for provided fields (avoid clobbering NULLs unintentionally)
    const sets = [];
    const params = [];

    // Description
    if (has("App_Description")) {
      const App_Description = asStr(body.App_Description);
      sets.push("App_Description = ?");
      params.push(App_Description || null);
    }

    // Dates (normalise if provided)
    let startDateSQL = null;
    let endDateSQL = null;
    if (has("App_startDate")) {
      startDateSQL = toSQLDate(body.App_startDate);
      if (body.App_startDate && !startDateSQL) {
        return res.status(400).json({ ok: false, message: "Invalid start date format" });
      }
      sets.push("App_startDate = ?");
      params.push(startDateSQL || null);
    }
    if (has("App_endDate")) {
      endDateSQL = toSQLDate(body.App_endDate);
      if (body.App_endDate && !endDateSQL) {
        return res.status(400).json({ ok: false, message: "Invalid end date format" });
      }
      sets.push("App_endDate = ?");
      params.push(endDateSQL || null);
    }

    // If both dates are being updated in the same call, enforce order
    if (has("App_startDate") && has("App_endDate") && startDateSQL && endDateSQL) {
      if (new Date(endDateSQL) < new Date(startDateSQL)) {
        return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
      }
    }

    // Permits (optional update)
    const touchingPermits = ["Permit_Create", "Permit_Open", "Permit_ToDo", "Permit_Doing", "Permit_Done"]
      .some(has);

    if (touchingPermits) {
      const App_permit_Create   = normCSV(body.Permit_Create);
      const App_permit_Open     = normCSV(body.Permit_Open);
      const App_permit_toDoList = normCSV(body.Permit_ToDo);
      const App_permit_Doing    = normCSV(body.Permit_Doing);
      const App_permit_Done     = normCSV(body.Permit_Done);

      sets.push(
        "App_permit_Create = ?",
        "App_permit_Open = ?",
        "App_permit_toDoList = ?",
        "App_permit_Doing = ?",
        "App_permit_Done = ?"
      );
      params.push(
        App_permit_Create || null,
        App_permit_Open || null,
        App_permit_toDoList || null,
        App_permit_Doing || null,
        App_permit_Done || null
      );
    }

    if (!sets.length) {
      // Nothing to update
      return res.json({ ok: true, message: "No fields to update" });
    }

    params.push(paramAcr);

    const [result] = await pool.query(
      `UPDATE application SET ${sets.join(", ")} WHERE App_Acronym = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Application not found" });
    }

    // Return fresh row
    const [rows] = await pool.query(
      `
      SELECT
        a.App_Acronym,
        a.App_Description,
        a.App_Rnumber,
        a.App_startDate,
        a.App_endDate,
        a.App_permit_Create,
        a.App_permit_Open,
        a.App_permit_toDoList,
        a.App_permit_Doing,
        a.App_permit_Done,
        ${TASK_COUNT_SQL} AS App_taskCount
      FROM application a
      WHERE a.App_Acronym = ?
      LIMIT 1
      `,
      [paramAcr]
    );
    res.json(mapRow(rows[0]));
  } catch (e) {
    next(e);
  }
}
