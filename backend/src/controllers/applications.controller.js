/*
 * CRUD for `application` table.
 * Table columns:
 *  App_Acronym (PK), App_Description, App_Rnumber, App_startDate, App_endDate,
 *  App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
 *
 * Your UI currently uses only: Acronym, Description, Rnumber, Start/End dates.
 */
import pool from "../models/db.js";

// Normalise helper
const asStr = (v) => (v == null ? "" : String(v));
const clampInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
function isValidDateStr(s) {
  if (!s) return true; // allow empty
  const d = new Date(s);
  return !Number.isNaN(+d);
}

export async function listApplications(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT App_Acronym, App_Description, App_Rnumber, App_startDate, App_endDate,
              App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
         FROM application
        ORDER BY App_Acronym ASC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function createApplication(req, res, next) {
  try {
    const body = req.body || {};
    const App_Acronym = asStr(body.App_Acronym).trim();
    const App_Description = asStr(body.App_Description);
    const App_Rnumber = clampInt(body.App_Rnumber);
    const App_startDate = asStr(body.App_startDate);
    const App_endDate = asStr(body.App_endDate);

    if (!App_Acronym) {
      return res.status(400).json({ ok: false, message: "App_Acronym is required" });
    }
    if (!isValidDateStr(App_startDate) || !isValidDateStr(App_endDate)) {
      return res.status(400).json({ ok: false, message: "Invalid date format" });
    }
    if (App_startDate && App_endDate && new Date(App_endDate) < new Date(App_startDate)) {
      return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    // Optional: accept permits if provided; otherwise keep NULL/default
    const App_permit_Open = body.App_permit_Open ?? null;
    const App_permit_toDoList = body.App_permit_toDoList ?? null;
    const App_permit_Doing = body.App_permit_Doing ?? null;
    const App_permit_Done = body.App_permit_Done ?? null;

    // Enforce uniqueness
    const [exist] = await pool.query(
      `SELECT 1 FROM application WHERE App_Acronym = ? LIMIT 1`,
      [App_Acronym]
    );
    if (exist.length) {
      return res.status(409).json({ ok: false, message: "App_Acronym already exists" });
    }

    await pool.query(
      `INSERT INTO application
        (App_Acronym, App_Description, App_Rnumber, App_startDate, App_endDate,
         App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        App_Acronym,
        App_Description,
        App_Rnumber,
        App_startDate || null,
        App_endDate || null,
        App_permit_Open,
        App_permit_toDoList,
        App_permit_Doing,
        App_permit_Done,
      ]
    );

    const created = {
      App_Acronym,
      App_Description,
      App_Rnumber,
      App_startDate: App_startDate || null,
      App_endDate: App_endDate || null,
      App_permit_Open,
      App_permit_toDoList,
      App_permit_Doing,
      App_permit_Done,
    };
    res.status(201).json(created);
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
    // Only allow updates to non-PK fields
    const App_Description = asStr(body.App_Description);
    const App_Rnumber = clampInt(body.App_Rnumber);
    const App_startDate = asStr(body.App_startDate);
    const App_endDate = asStr(body.App_endDate);

    if (!isValidDateStr(App_startDate) || !isValidDateStr(App_endDate)) {
      return res.status(400).json({ ok: false, message: "Invalid date format" });
    }
    if (App_startDate && App_endDate && new Date(App_endDate) < new Date(App_startDate)) {
      return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    // Optional: pass-through permits if backend stores them (UI not using them)
    const App_permit_Open = body.App_permit_Open ?? null;
    const App_permit_toDoList = body.App_permit_toDoList ?? null;
    const App_permit_Doing = body.App_permit_Doing ?? null;
    const App_permit_Done = body.App_permit_Done ?? null;

    const [result] = await pool.query(
      `UPDATE application
          SET App_Description = ?,
              App_Rnumber = ?,
              App_startDate = ?,
              App_endDate = ?,
              App_permit_Open = ?,
              App_permit_toDoList = ?,
              App_permit_Doing = ?,
              App_permit_Done = ?
        WHERE App_Acronym = ?`,
      [
        App_Description,
        App_Rnumber,
        App_startDate || null,
        App_endDate || null,
        App_permit_Open,
        App_permit_toDoList,
        App_permit_Doing,
        App_permit_Done,
        paramAcr,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Application not found" });
    }

    const updated = {
      App_Acronym: paramAcr,
      App_Description,
      App_Rnumber,
      App_startDate: App_startDate || null,
      App_endDate: App_endDate || null,
      App_permit_Open,
      App_permit_toDoList,
      App_permit_Doing,
      App_permit_Done,
    };
    res.json(updated);
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
