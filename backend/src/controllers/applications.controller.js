/*
 * CRUD for `application` table.
 * Table columns:
 *  App_Acronym (PK), App_Description, App_Rnumber, App_startDate, App_endDate,
 *  App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
 *
 * Your UI currently uses only: Acronym, Description, Rnumber, Start/End dates.
 */
import pool from "../models/db.js";

const asStr = (v) => (v == null ? "" : String(v));
function isValidDateStr(s) {
  if (!s) return true;
  const d = new Date(s);
  return !Number.isNaN(+d);
}

export async function listApplications(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT App_Acronym, App_Description, App_Rnumber, App_startDate, App_endDate,
              App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
         FROM application
        ORDER BY App_Rnumber ASC`
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

    // Uniqueness on acronym
    const [exist] = await pool.query(
      `SELECT 1 FROM application WHERE App_Acronym = ? LIMIT 1`,
      [App_Acronym]
    );
    if (exist.length) {
      return res.status(409).json({ ok: false, message: "App_Acronym already exists" });
    }

    // INSERT without App_Rnumber — DB assigns AUTO_INCREMENT
    await pool.query(
      `INSERT INTO application
        (App_Acronym, App_Description, App_startDate, App_endDate,
         App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
      [
        App_Acronym,
        App_Description,
        App_startDate || null,
        App_endDate || null,
      ]
    );

    // Fetch the created row to return generated App_Rnumber
    const [rows] = await pool.query(
      `SELECT App_Acronym, App_Description, App_Rnumber, App_startDate, App_endDate,
              App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
         FROM application
        WHERE App_Acronym = ?
        LIMIT 1`,
      [App_Acronym]
    );
    res.status(201).json(rows[0]);
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
    // Only update mutable fields; Rnumber stays immutable (DB id-like)
    const App_Description = asStr(body.App_Description);
    const App_startDate = asStr(body.App_startDate);
    const App_endDate = asStr(body.App_endDate);

    if (!isValidDateStr(App_startDate) || !isValidDateStr(App_endDate)) {
      return res.status(400).json({ ok: false, message: "Invalid date format" });
    }
    if (App_startDate && App_endDate && new Date(App_endDate) < new Date(App_startDate)) {
      return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    const [result] = await pool.query(
      `UPDATE application
          SET App_Description = ?,
              App_startDate = ?,
              App_endDate = ?
        WHERE App_Acronym = ?`,
      [App_Description, App_startDate || null, App_endDate || null, paramAcr]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: "Application not found" });
    }

    // Return fresh row (Rnumber unchanged)
    const [rows] = await pool.query(
      `SELECT App_Acronym, App_Description, App_Rnumber, App_startDate, App_endDate,
              App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
         FROM application
        WHERE App_Acronym = ?
        LIMIT 1`,
      [paramAcr]
    );
    res.json(rows[0]);
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
