// backend/src/controllers/tasks.controller.js
import pool from "../models/db.js";
import { canUserCreateTaskForApp } from "../policy/taskPolicy.js";
// import { checkGroup } from "./users.controller.js";

const NOTE_SEP = "\n--- NOTE ENTRY ---\n";

function fmtTs(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const statusLabel = (s) => {
  const map = { Open: "Open", ToDo: "ToDo", Doing: "Doing", Done: "Done", Closed: "Closed" };
  return map[s] ?? String(s || "").toUpperCase();
};

function makeNoteEntry(username, text, taskStateForStamp) {
  const body = String(text ?? "").trim();
  if (!body) return "";
  const stamp = statusLabel(taskStateForStamp);
  return `${NOTE_SEP}[${fmtTs()}] ${stamp} - ${username}\n${body}\n`;
}

const csv = (v) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

async function isUserInGroup(username, groupName) {
  const uname = String(username || "").trim().toLowerCase();
  const gname = String(groupName || "").trim().toLowerCase();
  if (!uname || !gname) return false;

  const [[row]] = await pool.query(
    "SELECT usergroups FROM accounts WHERE username = ? LIMIT 1",
    [uname]
  );
  if (!row) return false;

  const groups = String(row.usergroups || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  return groups.includes(gname);
}

export async function listTasks(req, res) {
  try {
    const { app, state, plan } = req.query || {};
    const where = [];
    const args = [];
    if (app) {
      where.push("Task_app_Acronym = ?");
      args.push(app);
    }
    if (state) {
      where.push("Task_state = ?");
      args.push(state);
    }
    if (plan) {
      where.push("Task_plan = ?");
      args.push(plan);
    }

    const sql = `
      SELECT Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
             Task_state, Task_creator, Task_owner, Task_createDate, Task_id
      FROM task
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY Task_createDate DESC, Task_name ASC
    `;
    const [rows] = await pool.query(sql, args);
    res.json(rows);
  } catch {
    res.status(500).json({ ok: false, message: "Failed to list tasks" });
  }
}

export async function createTask(req, res) {
  const conn = await pool.getConnection();
  try {
    const username = String(req.user?.username || "").trim();
    if (!username) return res.status(401).json({ ok: false, message: "Unauthorised" });

    const {
      Task_name,
      Task_description,
      Task_app_Acronym,
      Task_plan,
      Task_owner,
      Task_notes, // initial free-form entry
    } = req.body || {};

    const name = String(Task_name || "").trim();
    const acr  = String(Task_app_Acronym || "").trim();
    const plan = Task_plan ? String(Task_plan).trim() : null;

    if (!name) return res.status(400).json({ ok: false, message: "Task name is required" });
    if (!acr)  return res.status(400).json({ ok: false, message: "Application is required" });

    // initial note stamped with OPEN
    const raw = String(Task_notes || "").trim();
    const firstNote = raw ? makeNoteEntry(username, raw, "Open") : null;

    const allowed = await canUserCreateTaskForApp(username, acr);
    if (!allowed) return res.status(403).json({ ok: false, message: "Not permitted to create tasks for this application" });

    await conn.beginTransaction();

    const [apps] = await conn.query(
      "SELECT App_Rnumber FROM application WHERE App_Acronym = ? FOR UPDATE",
      [acr]
    );
    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Application not found" });
    }

    // (optional) relax plan validation; allow any plan name
    if (plan) {
      await conn.query("SELECT 1 FROM plan WHERE Plan_MVP_name = ? LIMIT 1", [plan]);
    }

    const current = Number(apps[0].App_Rnumber || 0);
    const nextR   = current + 1;

    await conn.query("UPDATE application SET App_Rnumber = ? WHERE App_Acronym = ?", [nextR, acr]);

    const taskId = `${acr}_${nextR}`;

    await conn.query(
      `INSERT INTO task
       (Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
        Task_state, Task_creator, Task_owner, Task_createDate, Task_id)
       VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, CURRENT_DATE, ?)`,
      [name, Task_description || null, firstNote, plan, acr, username, Task_owner || null, taskId]
    );

    await conn.commit();

    res.status(201).json({
      Task_name: name,
      Task_description: Task_description || null,
      Task_notes: firstNote,
      Task_plan: plan,
      Task_app_Acronym: acr,
      Task_state: "Open",
      Task_creator: username,
      Task_owner: Task_owner || null,
      Task_createDate: new Date().toISOString().slice(0, 10),
      Task_id: taskId,
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Task name or Task_id already exists" });
    }
    return res.status(500).json({ ok: false, message: e.message });
  } finally {
    conn.release();
  }
}

export async function appendTaskNote(req, res) {
  try {
    const username = String(req.user?.username || "").trim();
    if (!username) return res.status(401).json({ ok: false, message: "Unauthorised" });

    const taskName = String(req.params.taskName || "").trim();
    const entryRaw = String(req.body?.entry || "").trim();
    if (!taskName || !entryRaw) return res.status(400).json({ ok: false, message: "Bad request" });

    // fetch current state to stamp the status
    const [[t]] = await pool.query(
      "SELECT Task_state FROM task WHERE Task_name = ? LIMIT 1",
      [taskName]
    );
    if (!t) return res.status(404).json({ ok: false, message: "Task not found" });

    const entryBlock = makeNoteEntry(username, entryRaw, t.Task_state);
    const [r] = await pool.query(
      "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
      [entryBlock, taskName]
    );
    if (!r.affectedRows) return res.status(404).json({ ok: false, message: "Task not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Failed to append note" });
  }
}

export async function updateTask(req, res) {
  const conn = await pool.getConnection();
  try {
    const username = String(req.user?.username || "").trim();
    if (!username) return res.status(401).json({ ok: false, message: "Unauthorised" });

    const taskName = String(req.params.taskName || "").trim();
    if (!taskName) return res.status(400).json({ ok: false, message: "Task name is required" });

    const { Task_plan, Task_state, note } = req.body || {};
    if (typeof Task_plan === "undefined" && typeof Task_state === "undefined" && !note) {
      return res.status(400).json({ ok: false, message: "No update fields" });
    }

    await conn.beginTransaction();

    const [[t]] = await conn.query(
      "SELECT Task_name, Task_state, Task_plan, Task_app_Acronym, Task_notes FROM task WHERE Task_name = ? LIMIT 1",
      [taskName]
    );
    if (!t) { await conn.rollback(); return res.status(404).json({ ok: false, message: "Task not found" }); }

    const [[a]] = await conn.query(
      `SELECT App_Acronym, App_permit_Open, App_permit_toDoList
       FROM application WHERE App_Acronym = ? LIMIT 1`,
      [t.Task_app_Acronym]
    );
    if (!a) { await conn.rollback(); return res.status(404).json({ ok: false, message: "Application not found" }); }

    const permitOpen = csv(a.App_permit_Open);
    const permitToDo = csv(a.App_permit_toDoList);

    const isUserInGroup = async (username, groupName) => {
      // Your accounts table stores CSV of groups; emulate checkGroup logic here:
      const [[row]] = await conn.query(
        "SELECT usergroups FROM accounts WHERE username = ? LIMIT 1",
        [username]
      );
      if (!row) return false;
      const list = String(row.usergroups || "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      return list.includes(String(groupName || "").toLowerCase());
    };

    const userInAny = async (groups) => {
      if (!groups.length) return false;
      const checks = await Promise.all(groups.map((g) => isUserInGroup(username, g)));
      return checks.some(Boolean);
    };

    // Track effective state for optional free-form note at end
    let effectiveState = t.Task_state;

    // Change plan (only in Open; status stamp uses current state)
    if (typeof Task_plan !== "undefined") {
      if (t.Task_state !== "Open") { await conn.rollback(); return res.status(400).json({ ok: false, message: "Plan can only be changed while task is Open" }); }
      if (!(await userInAny(permitOpen))) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to change plan" }); }

      await conn.query("UPDATE task SET Task_plan = ? WHERE Task_name = ?", [Task_plan || null, taskName]);
      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
        [makeNoteEntry(username, Task_plan ? `Plan changed to "${Task_plan}"` : "Plan cleared", t.Task_state), taskName]
      );
    }

    // Release: Open -> ToDo (stamp TODO)
    if (Task_state === "ToDo") {
      if (t.Task_state !== "Open") { await conn.rollback(); return res.status(400).json({ ok: false, message: "Only Open tasks can be released" }); }
      if (!(await userInAny(permitOpen))) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to release this task" }); }

      await conn.query("UPDATE task SET Task_state = 'ToDo' WHERE Task_name = ?", [taskName]);
      effectiveState = "ToDo";
      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
        [makeNoteEntry(username, `Task moved from "Open" to "ToDo"`, effectiveState), taskName]
      );
    }

    // Take: ToDo -> Doing (stamp DOING)
    if (Task_state === "Doing") {
      if (t.Task_state !== "ToDo") { await conn.rollback(); return res.status(400).json({ ok: false, message: "Only ToDo tasks can be taken" }); }
      if (!(await userInAny(permitToDo))) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to take this task" }); }

      await conn.query("UPDATE task SET Task_state='Doing', Task_owner=? WHERE Task_name=?", [username, taskName]);
      effectiveState = "Doing";
      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
        [makeNoteEntry(username, `Task taken by ${username}; state ToDo → Doing`, effectiveState), taskName]
      );
    }

    // Optional free-form note (uses effective state after any changes above)
    if (note && String(note).trim()) {
      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
        [makeNoteEntry(username, String(note), effectiveState), taskName]
      );
    }

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
              Task_state, Task_creator, Task_owner, Task_createDate, Task_id
       FROM task WHERE Task_name = ?`,
      [taskName]
    );
    res.json(rows[0]);
  } catch (e) {
    try { await conn.rollback(); } catch {}
    res.status(500).json({ ok: false, message: e.message || "Failed to update task" });
  } finally {
    conn.release();
  }
}