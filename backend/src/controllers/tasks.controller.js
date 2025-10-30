// backend/src/controllers/tasks.controller.js
import pool from "../models/db.js";
import { canUserCreateTaskForApp } from "../policy/taskPolicy.js";
// import { checkGroup } from "./users.controller.js";
import { sendMail, getEmailsForGroups } from "../middleware/mailer.js";

const NOTE_SEP = "\n--- NOTE ENTRY ---\n";
const MAX_TASK_NAME = 50;
const VALID_STATES = new Set(["Open", "ToDo", "Doing", "Done", "Closed"]);

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
    const acr = String(Task_app_Acronym || "").trim();
    const plan = Task_plan ? String(Task_plan).trim() : null;

    if (!name) return res.status(400).json({ ok: false, message: "Task name is required" });
    if (!acr) return res.status(400).json({ ok: false, message: "Application is required" });

    // Build initial notes:
    //   - Always include a "task created" entry
    //   - Optionally include user's initial note, both stamped with Open
    const createdNote = makeNoteEntry(username, "Task created", "Open");
    const userNoteRaw = String(Task_notes || "").trim();
    const initialNotes = userNoteRaw
      ? createdNote + makeNoteEntry(username, userNoteRaw, "Open")
      : createdNote;

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
    const nextR = current + 1;

    await conn.query("UPDATE application SET App_Rnumber = ? WHERE App_Acronym = ?", [nextR, acr]);

    const taskId = `${acr}_${nextR}`;

    await conn.query(
      `INSERT INTO task
       (Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
        Task_state, Task_creator, Task_owner, Task_createDate, Task_id)
       VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, CURRENT_DATE, ?)`,

      // use initialNotes (includes "Task created" + optional initial note)
      [name, Task_description || null, initialNotes, plan, acr, username, Task_owner || null, taskId]
    );
    await conn.commit();

    res.status(201).json({
      Task_name: name,
      Task_description: Task_description || null,
      Task_notes: initialNotes,
      Task_plan: plan,
      Task_app_Acronym: acr,
      Task_state: "Open",
      Task_creator: username,
      Task_owner: Task_owner || null,
      Task_createDate: new Date().toISOString().slice(0, 10),
      Task_id: taskId,
    });
  } catch (e) {
    try { await conn.rollback(); } catch { }
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, message: "Task name already exists" });
    }
    if (e?.code === "ER_DATA_TOO_LONG" && /Task_name/i.test(e?.message || "")) {
      return res.status(400).json({ ok: false, message: `Task Name must not be longer than ${MAX_TASK_NAME} characters.` });
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

    // detect which fields are actually present (not just undefined)
    const planSupplied = Object.prototype.hasOwnProperty.call(req.body, "Task_plan");
    const stateSupplied = Object.prototype.hasOwnProperty.call(req.body, "Task_state");

    if (!planSupplied && !stateSupplied && !note) {
      return res.status(400).json({ ok: false, message: "No update fields" });
    }

    await conn.beginTransaction();

    const [[t]] = await conn.query(
      "SELECT Task_name, Task_state, Task_plan, Task_app_Acronym, Task_notes FROM task WHERE Task_name = ? FOR UPDATE",
      [taskName]
    );
    if (!t) { await conn.rollback(); return res.status(404).json({ ok: false, message: "Task not found" }); }
    let didStateChange = false;

    const [[a]] = await conn.query(
      `SELECT App_Acronym, App_permit_Open, App_permit_toDoList, App_permit_Done
       FROM application WHERE App_Acronym = ? LIMIT 1`,
      [t.Task_app_Acronym]
    );
    if (!a) { await conn.rollback(); return res.status(404).json({ ok: false, message: "Application not found" }); }

    const permitOpen = csv(a.App_permit_Open);
    const permitToDo = csv(a.App_permit_toDoList);
    const permitDone = csv(a.App_permit_Done);

    const userInAny = async (groups) => {
      if (!groups.length) return false;
      const checks = await Promise.all(groups.map((g) => isUserInGroup(username, g)));
      return checks.some(Boolean);
    };

    // ---- Plan change (silent unless paired with a state action) ----
    if (planSupplied) {
      // Only allowed while Open or Done (existing rule)
      if (!(t.Task_state === "Open" || t.Task_state === "Done")) {
        await conn.rollback();
        return res.status(400).json({ ok: false, message: "Plan can only be changed while task is Open or Done" });
      }

      const allowed =
        t.Task_state === "Open"
          ? await userInAny(permitOpen)
          : await userInAny(permitDone);
      if (!allowed) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to change plan" }); }

      const prevPlan = t.Task_plan ?? null;
      const nextPlan = Task_plan ? String(Task_plan).trim() : null;

      // Perform the plan update
      await conn.query("UPDATE task SET Task_plan = ? WHERE Task_name = ?", [nextPlan, taskName]);

      // Only append a "plan changed/cleared" note if this request ALSO changes state
      if (stateSupplied && prevPlan !== nextPlan) {
        const planMsg = nextPlan ? `Plan changed to "${nextPlan}"` : "Plan cleared";
        await conn.query(
          "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
          [makeNoteEntry(username, planMsg), taskName]
        );
      }

      // Keep local copy in sync for subsequent logic in this transaction
      t.Task_plan = nextPlan;
    }

    // ---- State transitions ----
    // Open/Doing -> ToDo (Release)
    if (Task_state === "ToDo" && t.Task_state === "Open") {
      // require a plan before release
      // const hasPlan = t.Task_plan != null && String(t.Task_plan).trim() !== "";
      // if (!hasPlan) {
      //   await conn.rollback();
      //   return res.status(400).json({ ok: false, message: "A plan must be selected before releasing this task" });
      // }
      if (!(await userInAny(permitOpen))) {
        await conn.rollback();
        return res.status(403).json({ ok: false, message: "Not permitted to release this task" });
      }

      const [r] = await conn.query(
        "UPDATE task SET Task_state='ToDo' WHERE Task_name=? AND Task_state='Open'",
        [taskName]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.status(409).json({ ok: false, message: "Task is no longer Open; please refresh" });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
        [makeNoteEntry(username, `Task released: Open → ToDo`), taskName]
      );
    }

    // Doing -> ToDo (Drop)
    if (Task_state === "ToDo" && t.Task_state === "Doing") {
      if (!(await userInAny(permitToDo))) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to drop this task" }); }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='ToDo', Task_owner=NULL WHERE Task_name=? AND Task_state='Doing'",
        [taskName]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.status(409).json({ ok: false, message: "Task is no longer in Doing; please refresh" });
      }
      didStateChange = true;

      await conn.query("UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?", [makeNoteEntry(username, `Task dropped: Doing → ToDo`), taskName]);
    }

    // ToDo -> Doing (Take)
    if (Task_state === "Doing" && t.Task_state === "ToDo") {
      if (!(await userInAny(permitToDo))) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to take this task" }); }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='Doing', Task_owner=? WHERE Task_name=? AND Task_state='ToDo'",
        [username, taskName]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.status(409).json({ ok: false, message: "Task is no longer in ToDo; please refresh" });
      }
      didStateChange = true;

      await conn.query("UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?", [makeNoteEntry(username, `Task taken: ToDo → Doing`), taskName]);
    }

    // Doing -> Done (Review)
    if (Task_state === "Done" && t.Task_state === "Doing") {
      if (!(await userInAny(permitToDo))) {
        await conn.rollback();
        return res.status(403).json({ ok: false, message: "Not permitted to review this task" });
      }

      const [r] = await conn.query(
        "UPDATE task SET Task_state='Done' WHERE Task_name=? AND Task_state='Doing'",
        [taskName]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.status(409).json({ ok: false, message: "Task state has changed; please refresh" });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
        [makeNoteEntry(username, "Task reviewed: Doing → Done"), taskName]
      );

      // Capture email intent and minimal payload for after-commit send
      var notifyAfterCommit = {
        appAcronym: t.Task_app_Acronym,
        taskName,
        reviewer: username,
        permitDoneGroups: permitDone
      };
    }


    // Done -> Closed (Approve)
    if (Task_state === "Closed" && t.Task_state === "Done") {
      if (!(await userInAny(permitDone))) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to approve this task" }); }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='Closed' WHERE Task_name=? AND Task_state='Done'",
        [taskName]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.status(409).json({ ok: false, message: "Task is no longer in Done; please refresh" });
      }
      didStateChange = true;

      await conn.query("UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?", [makeNoteEntry(username, `Task approved: Done → Closed`), taskName]);
    }

    // Done -> Doing (Reject)
    if (Task_state === "Doing" && t.Task_state === "Done") {
      if (!(await userInAny(permitDone))) { await conn.rollback(); return res.status(403).json({ ok: false, message: "Not permitted to reject this task" }); }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='Doing' WHERE Task_name=? AND Task_state='Done'",
        [taskName]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.status(409).json({ ok: false, message: "Task is no longer in Done; please refresh" });
      }
      didStateChange = true;

      await conn.query("UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?", [makeNoteEntry(username, `Task rejected: Done → Doing`), taskName]);
    }

    // Optional free-form note (keep behaviour)
    if (note && String(note).trim()) {
      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
        [makeNoteEntry(username, String(note)), taskName]
      );
    }
    // If client requested a state change but none of the guarded transitions fired, report conflict
    if (stateSupplied && !didStateChange) {
      await conn.rollback();
      return res.status(409).json({ ok: false, message: "Task state changed by someone else; please refresh" });
    }
    await conn.commit();

    // Fire-and-forget minimal email AFTER commit
    if (notifyAfterCommit) {
      (async () => {
        try {
          const emails = await getEmailsForGroups(notifyAfterCommit.permitDoneGroups);
          if (emails.length === 0) {
            return;
          }

          const subject = `[${notifyAfterCommit.appAcronym}] Task ready for Review: ${notifyAfterCommit.taskName}`;
          const text =
            `Task "${notifyAfterCommit.taskName}" in Application "${notifyAfterCommit.appAcronym}" ` +
            `was promoted to Done by ${notifyAfterCommit.reviewer}. ` +
            `Please review the task.`;

          await sendMail(emails.join(","), subject, text);
        } catch (e) {
          console.error("Done-review email failed:", e?.message || e);
        }
      })();
    }

    const [rows] = await pool.query(
      `SELECT Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
              Task_state, Task_creator, Task_owner, Task_createDate, Task_id
       FROM task WHERE Task_name = ?`,
      [taskName]
    );
    res.json(rows[0]);
  } catch (e) {
    try { await conn.rollback(); } catch { }
    res.status(500).json({ ok: false, message: e.message || "Failed to update task" });
  } finally {
    conn.release();
  }
}


/**
 * GET /api/tasks/state/:state?app=APP_ACR&plan=PLAN_NAME
 * Method name: GetTaskbyState
 * Description: Retrieve tasks in a particular state (optionally filtered by app/plan).
 */
export async function getTasksByState(req, res) {
  try {
    const raw = String(req.params.state || "").trim();
    // Normalise common spellings, e.g. "To-Do" → "ToDo"
    const normalised =
      raw.toLowerCase() === "to-do" || raw.toLowerCase() === "todo"
        ? "ToDo"
        : raw;

    if (!VALID_STATES.has(normalised)) {
      return res.status(400).json({
        ok: false,
        message: `Invalid state "${raw}". Allowed: ${[...VALID_STATES].join(", ")}.`,
      });
    }

    const { app, plan } = req.query || {};
    const where = ["Task_state = ?"];
    const args = [normalised];

    if (app) {
      where.push("Task_app_Acronym = ?");
      args.push(String(app));
    }
    if (plan) {
      where.push("Task_plan = ?");
      args.push(String(plan));
    }

    const sql = `
      SELECT Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
             Task_state, Task_creator, Task_owner, Task_createDate, Task_id
      FROM task
      WHERE ${where.join(" AND ")}
      ORDER BY Task_createDate DESC, Task_name ASC
    `;
    const [rows] = await pool.query(sql, args);
    return res.json(rows);
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, message: e?.message || "Failed to get tasks by state" });
  }
}


/**
 * PromoteTask2Done
 * POST /api/tasks/:taskName/promote-to-done
 * Preconditions:
 *   - Task must currently be "Doing"
 *   - Caller must be in any of the app's ToDo-permit groups (same as your existing rule)
 * Effects:
 *   - Sets Task_state = 'Done'
 *   - Appends note "Task reviewed: Doing → Done"
 *   - Sends minimal email to App_permit_Done groups saying task is ready for review
 */
export async function promoteTaskToDone(req, res) {
  const conn = await pool.getConnection();
  try {
    const username = String(req.user?.username || "").trim();
    if (!username) return res.status(401).json({ ok: false, message: "Unauthorised" });

    const taskName = String(req.params.taskName || "").trim();
    if (!taskName) return res.status(400).json({ ok: false, message: "Task name is required" });

    await conn.beginTransaction();

    // Load task & app permits
    const [[t]] = await conn.query(
      "SELECT Task_name, Task_state, Task_plan, Task_app_Acronym, Task_notes FROM task WHERE Task_name = ? FOR UPDATE",
      [taskName]
    );
    if (!t) { await conn.rollback(); return res.status(404).json({ ok: false, message: "Task not found" }); }

    const [[a]] = await conn.query(
      `SELECT App_Acronym, App_permit_Open, App_permit_toDoList, App_permit_Done
       FROM application WHERE App_Acronym = ? LIMIT 1`,
      [t.Task_app_Acronym]
    );
    if (!a) { await conn.rollback(); return res.status(404).json({ ok: false, message: "Application not found" }); }

    // Must currently be Doing
    if (t.Task_state !== "Doing") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Task is not in Doing state" });
    }

    // Permission: same as your existing Doing→Done rule (use ToDo permit)
    const permitToDo = csv(a.App_permit_toDoList);
    if (!(permitToDo.length && (await Promise.all(permitToDo.map(g => isUserInGroup(username, g)))).some(Boolean))) {
      await conn.rollback();
      return res.status(403).json({ ok: false, message: "Not permitted to review this task" });
    }

    // State change
    await conn.query("UPDATE task SET Task_state='Done' WHERE Task_name=?", [taskName]);
    await conn.query(
      "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_name = ?",
      [makeNoteEntry(username, "Task reviewed: Doing → Done", "Done"), taskName]
    );

    // Prepare email (notify Done-permit groups)
    const permitDone = csv(a.App_permit_Done);
    const notifyAfterCommit = {
      appAcronym: t.Task_app_Acronym,
      taskName,
      reviewer: username,
      permitDoneGroups: permitDone,
    };

    await conn.commit();

    // Fire-and-forget email after commit
    (async () => {
      try {
        const emails = await getEmailsForGroups(notifyAfterCommit.permitDoneGroups);
        if (!emails.length) return;
        const subject = `[${notifyAfterCommit.appAcronym}] Task ready for Review: ${notifyAfterCommit.taskName}`;
        const text =
          `Task "${notifyAfterCommit.taskName}" in Application "${notifyAfterCommit.appAcronym}" ` +
          `was promoted to Done by ${notifyAfterCommit.reviewer}. ` +
          `Please review the task.`;
        await sendMail(emails.join(","), subject, text);
      } catch (e) {
        console.error("Done-review email failed:", e?.message || e);
      }
    })();

    // Return updated task
    const [rows] = await pool.query(
      `SELECT Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
              Task_state, Task_creator, Task_owner, Task_createDate, Task_id
       FROM task WHERE Task_name = ?`,
      [taskName]
    );
    res.json(rows[0]);
  } catch (e) {
    try { await conn.rollback(); } catch { }
    res.status(500).json({ ok: false, message: e?.message || "Failed to promote task to Done" });
  } finally {
    conn.release();
  }
}