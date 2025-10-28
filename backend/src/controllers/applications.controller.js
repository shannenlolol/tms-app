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

function isValidDateStr(s) {
  if (!s) return true;
  const d = new Date(s);
  return !Number.isNaN(+d);
}

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
    const App_startDate   = asStr(body.App_startDate); // REQUIRED
    const App_endDate     = asStr(body.App_endDate);   // REQUIRED

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

    // Date format & order checks
    if (!isValidDateStr(App_startDate) || !isValidDateStr(App_endDate)) {
      return res.status(400).json({ ok: false, message: "Invalid date format" });
    }
    if (new Date(App_endDate) < new Date(App_startDate)) {
      return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    // Permit CSVs must not be empty
    if (!isNonEmptyCSV(body.Permit_Create)) {
      return res.status(400).json({ ok: false, message: "Permit_Create must contain at least one group" });
    }
    if (!isNonEmptyCSV(body.Permit_Open)) {
      return res.status(400).json({ ok: false, message: "Permit_Open must contain at least one group" });
    }
    if (!isNonEmptyCSV(body.Permit_ToDo)) {
      return res.status(400).json({ ok: false, message: "Permit_ToDo must contain at least one group" });
    }
    if (!isNonEmptyCSV(body.Permit_Doing)) {
      return res.status(400).json({ ok: false, message: "Permit_Doing must contain at least one group" });
    }
    if (!isNonEmptyCSV(body.Permit_Done)) {
      return res.status(400).json({ ok: false, message: "Permit_Done must contain at least one group" });
    }
    // -------------------------

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
        App_startDate,       // required & validated
        App_endDate,         // required & validated
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
    const App_Description = asStr(body.App_Description);
    const App_startDate   = asStr(body.App_startDate);
    const App_endDate     = asStr(body.App_endDate);

    // Allow updating permits as well (optional for current UI, but future-proof)
    const wantPermits = [
      "Permit_Create",
      "Permit_Open",
      "Permit_ToDo",
      "Permit_Doing",
      "Permit_Done",
    ].some((k) => Object.prototype.hasOwnProperty.call(body, k));

    const App_permit_Create   = normCSV(body.Permit_Create);
    const App_permit_Open     = normCSV(body.Permit_Open);
    const App_permit_toDoList = normCSV(body.Permit_ToDo);
    const App_permit_Doing    = normCSV(body.Permit_Doing);
    const App_permit_Done     = normCSV(body.Permit_Done);

    if (!isValidDateStr(App_startDate) || !isValidDateStr(App_endDate)) {
      return res.status(400).json({ ok: false, message: "Invalid date format" });
    }
    if (App_startDate && App_endDate && new Date(App_endDate) < new Date(App_startDate)) {
      return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    // Build dynamic UPDATE to avoid clobbering NULLs unless sent
    const sets = [
      "App_Description = ?",
      "App_startDate = ?",
      "App_endDate = ?",
    ];
    const params = [App_Description || null, App_startDate || null, App_endDate || null];

    if (wantPermits) {
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

export async function deleteApplication(req, res, next) {
  try {
    const paramAcr = asStr(req.params.acronym).trim();
    if (!paramAcr) {
      return res.status(400).json({ ok: false, message: "Acronym param is required" });
    }
    const [result] = await pool.query(
      `DELETE FROM application WHERE App_Acronym = ?`,
      [paramAcr]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Application not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
