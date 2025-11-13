// backend/src/controllers/tasks.controller.js
import pool from "../models/db.js";
import { canUserCreateTaskForApp } from "../policy/taskPolicy.js";
import { sendMail, getEmailsForGroups } from "../middleware/mailer.js";

const NOTE_SEP = "\n--- NOTE ENTRY ---\n";
const MAX_TASK_NAME = 50;
const MAX_DESC = 255;
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
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return groups.includes(gname);
}

function permitsForState(state, appRow) {
  // Map current state -> which permit list is allowed to act
  switch (state) {
    case "Open": return csv(appRow.App_permit_Open);
    case "ToDo": return csv(appRow.App_permit_toDoList);
    case "Doing": return csv(appRow.App_permit_Doing);
    case "Done": return csv(appRow.App_permit_Done);
    default: return []; // Closed/unknown → no write permission
  }
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

  const isJSON = (req) => Boolean(req.is?.("application/json")); // Express adds req.is()
  const ACR_REGEX = /^[A-Z0-9_]+$/;

  // P_1: Wrong content type (expects application/json)
  if (!isJSON(req)) {
    return res.status(415).json({ status: "P_1" }); // Unsupported Media Type
  }

  const conn = await pool.getConnection();
  try {
    // IAM_1: No/invalid credentials (ensureAuth should normally gate this)
    const username = String(req.user?.username || "").trim();
    if (!username) {
      return res.status(401).json({ status: "IAM_1" });
    }

    const {
      Task_name,
      Task_description,
      Task_app_Acronym,
      Task_plan,
      Task_owner,
      Task_notes, // optional initial note
    } = req.body || {};

    const name = String(Task_name || "").trim();
    const desc = String(Task_description || "").trim();
    const acrRaw = String(Task_app_Acronym || "").trim();
    const acr = acrRaw.toUpperCase(); // normalise for lookup
    const plan = Task_plan ? String(Task_plan).trim() : null;

    // P_2: Missing required fields
    if (!name || !acr) {
      return res.status(400).json({ status: "P_2" });
    }

    // P_3: Task_name invalid (exceeds 50 chars)
    if (name.length > MAX_TASK_NAME) {
      return res.status(400).json({ status: "P_3" });
    }

    // P_4: Task_description invalid (exceeds 255 chars)
    if (desc.length > MAX_DESC) {
      return res.status(400).json({ status: "P_4" });
    }

    await conn.beginTransaction();

    // TR_1: App not found
    const [apps] = await conn.query(
      "SELECT App_Rnumber FROM application WHERE App_Acronym = ? FOR UPDATE",
      [acr]
    );
    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ status: "TR_1" });
    }

    // IAM_2: Not authorised for this app
    const allowed = await canUserCreateTaskForApp(username, acr);
    if (!allowed) {
      return res.status(403).json({ status: "IAM_2" });
    }

    // TR_2: Task_plan not found (only when provided)
    if (plan) {
      const [plans] = await conn.query(
        "SELECT 1 FROM plan WHERE Plan_MVP_name = ? LIMIT 1",
        [plan]
      );
      if (plans.length === 0) {
        await conn.rollback();
        return res.status(404).json({ status: "TR_2" });
      }
    }

    // Build initial notes
    const createdNote = makeNoteEntry(username, "Task created", "Open");
    const userNoteRaw = String(Task_notes || "").trim();
    const initialNotes = userNoteRaw
      ? createdNote + makeNoteEntry(username, userNoteRaw, "Open")
      : createdNote;

    // Increment app R-number
    const current = Number(apps[0].App_Rnumber || 0);
    const nextR = current + 1;
    await conn.query(
      "UPDATE application SET App_Rnumber = ? WHERE App_Acronym = ?",
      [nextR, acr]
    );

    const taskId = `${acr}_${nextR}`;

    await conn.query(
      `INSERT INTO task
        (Task_name, Task_description, Task_notes, Task_plan, Task_app_Acronym,
         Task_state, Task_creator, Task_owner, Task_createDate, Task_id)
       VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, CURRENT_DATE, ?)`,
      [
        name,
        Task_description || null,
        initialNotes,
        plan,
        acr,
        username,
        Task_owner || null,
        taskId,
      ]
    );

    await conn.commit();

    // S_1: Success
    return res.status(201).json({ status: "S_1" });

  } catch (e) {
    try {
      await conn.rollback();
    } catch {}

    // P_4 could also be triggered by DB length constraint on Task_name:
    if (e?.code === "ER_DATA_TOO_LONG" && /Task_name/i.test(e?.message || "")) {
      return res.status(400).json({ status: "P_4" });
    }

    // Everything else → UE (unspecified error)
    console.error("createTask error:", e?.message || e);
    return res.status(500).json({ status: "UE" });
  } finally {
    conn.release();
  }
}

export async function appendTaskNote(req, res) {
  const conn = await pool.getConnection();
  try {
    const username = String(req.user?.username || "").trim();
    if (!username)
      return res.status(401).json({ ok: false, message: "Unauthorised" });
    const taskID = String(req.params.taskID || "").trim();
    const entryRaw = String(req.body?.entry || "").trim();
    const expectedState = String(req.body?.taskState || "").trim();
    if (!taskID || !entryRaw)
      return res.status(400).json({ ok: false, message: "Bad request" });

    await conn.beginTransaction();

    // Lock the task row while we check & write
    const [[t]] = await conn.query(
      "SELECT Task_state, Task_app_Acronym FROM task WHERE Task_id = ? FOR UPDATE",
      [taskID]
    );
    if (!t) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Task not found" });
    }

    // If the client provided an expectation, enforce it
    if (expectedState && t.Task_state !== expectedState) {
      await conn.rollback();
      return res.status(409).json({
        ok: false,
        message: `Task state changed by someone else; it is now "${t.Task_state}". Please refresh.`,
      });
    }

    // Load app permits once
    const [[a]] = await conn.query(
      `SELECT App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
       FROM application WHERE App_Acronym = ? LIMIT 1`,
      [t.Task_app_Acronym]
    );
    if (!a) {
      await conn.rollback();
      return res
        .status(404)
        .json({ ok: false, message: "Application not found" });
    }

    // Determine which permit set applies for the CURRENT task state
    const groups = permitsForState(t.Task_state, a);
    if (!groups.length) {
      await conn.rollback();
      return res
        .status(403)
        .json({ ok: false, message: "Notes are not allowed in this state" });
    }

    // Check membership
    const allowed = (
      await Promise.all(groups.map((g) => isUserInGroup(username, g)))
    ).some(Boolean);
    if (!allowed) {
      await conn.rollback();
      return res
        .status(403)
        .json({
          ok: false,
          message: "Not permitted to add a note in this state",
        });
    }

    // Append stamped note against the *current* state
    const entryBlock = makeNoteEntry(username, entryRaw, t.Task_state);
    await conn.query(
      "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
      [entryBlock, taskID]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    res
      .status(500)
      .json({ ok: false, message: e?.message || "Failed to append note" });
  } finally {
    conn.release();
  }
}

export async function updateTask(req, res) {
  const conn = await pool.getConnection();
  try {
    const username = String(req.user?.username || "").trim();
    if (!username)
      return res.status(401).json({ ok: false, message: "Unauthorised" });

    const taskID = String(req.params.taskID || "").trim();
    if (!taskID)
      return res
        .status(400)
        .json({ ok: false, message: "Task ID is required" });

    const { Task_plan, Task_state, note } = req.body || {};

    // detect which fields are actually present (not just undefined)
    const planSupplied = Object.prototype.hasOwnProperty.call(
      req.body,
      "Task_plan"
    );
    const stateSupplied = Object.prototype.hasOwnProperty.call(
      req.body,
      "Task_state"
    );

    if (!planSupplied && !stateSupplied && !note) {
      return res.status(400).json({ ok: false, message: "No update fields" });
    }

    await conn.beginTransaction();

    const [[t]] = await conn.query(
      "SELECT Task_id, Task_state, Task_plan, Task_app_Acronym, Task_notes FROM task WHERE Task_id = ? FOR UPDATE",
      [taskID]
    );
    if (!t) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Task not found" });
    }
    let didStateChange = false;

    const [[a]] = await conn.query(
      `SELECT App_Acronym, App_permit_Open, App_permit_toDoList, App_permit_Doing, App_permit_Done
       FROM application WHERE App_Acronym = ? LIMIT 1`,
      [t.Task_app_Acronym]
    );
    if (!a) {
      await conn.rollback();
      return res
        .status(404)
        .json({ ok: false, message: "Application not found" });
    }

    const permitOpen = csv(a.App_permit_Open);
    const permitToDo = csv(a.App_permit_toDoList);
    const permitDoing = csv(a.App_permit_Doing);
    const permitDone = csv(a.App_permit_Done);

    const userInAny = async (groups) => {
      if (!groups.length) return false;
      const checks = await Promise.all(
        groups.map((g) => isUserInGroup(username, g))
      );
      return checks.some(Boolean);
    };

    // ---- Plan change (silent unless paired with a state action) ----
    if (planSupplied) {
      // Only allowed while Open or Done (existing rule)
      if (!(t.Task_state === "Open" || t.Task_state === "Done")) {
        await conn.rollback();
        return res
          .status(400)
          .json({
            ok: false,
            message: "Plan can only be changed while task is Open or Done",
          });
      }

      const allowed =
        t.Task_state === "Open"
          ? await userInAny(permitOpen)
          : await userInAny(permitDone);
      if (!allowed) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, message: "Not permitted to change plan" });
      }

      const prevPlan = t.Task_plan ?? null;
      const nextPlan = Task_plan ? String(Task_plan).trim() : null;

      // Perform the plan update
      await conn.query("UPDATE task SET Task_plan = ? WHERE Task_id = ?", [
        nextPlan,
        taskID,
      ]);

      // Only append a "plan changed/cleared" note if this request ALSO changes state
      // if (stateSupplied && prevPlan !== nextPlan) {
      if (prevPlan !== nextPlan) {
        const planMsg = nextPlan
          ? `Plan changed to "${nextPlan}"`
          : "Plan cleared";
        await conn.query(
          "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
          [makeNoteEntry(username, planMsg), taskID]
        );
      }

      // Keep local copy in sync for subsequent logic in this transaction
      t.Task_plan = nextPlan;
    }

    // ---- State transitions ----
    // Open -> ToDo (Release)
    if (Task_state === "ToDo" && t.Task_state === "Open") {
      // require a plan before release
      // const hasPlan = t.Task_plan != null && String(t.Task_plan).trim() !== "";
      // if (!hasPlan) {
      //   await conn.rollback();
      //   return res.status(400).json({ ok: false, message: "A plan must be selected before releasing this task" });
      // }
      if (!(await userInAny(permitOpen))) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, message: "Not permitted to release this task" });
      }

      const [r] = await conn.query(
        "UPDATE task SET Task_state='ToDo' WHERE Task_id=? AND Task_state='Open'",
        [taskID]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res
          .status(409)
          .json({
            ok: false,
            message: "Task is no longer Open; please refresh",
          });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
        [makeNoteEntry(username, `Task released: Open → ToDo`), taskID]
      );
    }

    // Doing -> ToDo (Drop)
    if (Task_state === "ToDo" && t.Task_state === "Doing") {
      if (!(await userInAny(permitToDo))) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, message: "Not permitted to drop this task" });
      }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='ToDo', Task_owner=NULL WHERE Task_id=? AND Task_state='Doing'",
        [taskID]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res
          .status(409)
          .json({
            ok: false,
            message: "Task is no longer in Doing; please refresh",
          });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
        [makeNoteEntry(username, `Task dropped: Doing → ToDo`), taskID]
      );
    }

    // ToDo -> Doing (Take)
    if (Task_state === "Doing" && t.Task_state === "ToDo") {
      if (!(await userInAny(permitToDo))) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, message: "Not permitted to take this task" });
      }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='Doing', Task_owner=? WHERE Task_id=? AND Task_state='ToDo'",
        [username, taskID]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res
          .status(409)
          .json({
            ok: false,
            message: "Task is no longer in ToDo; please refresh",
          });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
        [makeNoteEntry(username, `Task taken: ToDo → Doing`), taskID]
      );
    }

    // Doing -> Done (Review)
    if (Task_state === "Done" && t.Task_state === "Doing") {
      if (!(await userInAny(permitDoing))) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, message: "Not permitted to review this task" });
      }

      const [r] = await conn.query(
        "UPDATE task SET Task_state='Done' WHERE Task_id=? AND Task_state='Doing'",
        [taskID]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res
          .status(409)
          .json({
            ok: false,
            message: "Task state has changed; please refresh",
          });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
        [makeNoteEntry(username, "Task reviewed: Doing → Done"), taskID]
      );

      // Capture email intent and minimal payload for after-commit send
      var notifyAfterCommit = {
        appAcronym: t.Task_app_Acronym,
        taskID,
        reviewer: username,
        permitDoneGroups: permitDone,
      };
    }

    // Done -> Closed (Approve)
    if (Task_state === "Closed" && t.Task_state === "Done") {
      if (!(await userInAny(permitDone))) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, message: "Not permitted to approve this task" });
      }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='Closed' WHERE Task_id=? AND Task_state='Done'",
        [taskID]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res
          .status(409)
          .json({
            ok: false,
            message: "Task is no longer in Done; please refresh",
          });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
        [makeNoteEntry(username, `Task approved: Done → Closed`), taskID]
      );
    }

    // Done -> Doing (Reject)
    if (Task_state === "Doing" && t.Task_state === "Done") {
      if (!(await userInAny(permitDone))) {
        await conn.rollback();
        return res
          .status(403)
          .json({ ok: false, message: "Not permitted to reject this task" });
      }
      const [r] = await conn.query(
        "UPDATE task SET Task_state='Doing' WHERE Task_id=? AND Task_state='Done'",
        [taskID]
      );
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res
          .status(409)
          .json({
            ok: false,
            message: "Task is no longer in Done; please refresh",
          });
      }
      didStateChange = true;

      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
        [makeNoteEntry(username, `Task rejected: Done → Doing`), taskID]
      );
    }

    // Optional free-form note (keep behaviour)
    if (note && String(note).trim()) {
      await conn.query(
        "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
        [makeNoteEntry(username, String(note)), taskID]
      );
    }
    // If client requested a state change but none of the guarded transitions fired, report conflict
    if (stateSupplied && !didStateChange) {
      await conn.rollback();
      return res
        .status(409)
        .json({
          ok: false,
          message: "Task state changed by someone else; please refresh",
        });
    }
    await conn.commit();

    // Fire-and-forget minimal email AFTER commit
    if (notifyAfterCommit) {
      (async () => {
        try {
          const emails = await getEmailsForGroups(
            notifyAfterCommit.permitDoneGroups
          );
          if (emails.length === 0) {
            return;
          }

          const subject = `[${notifyAfterCommit.appAcronym}] Task ready for Review: ${notifyAfterCommit.taskID}`;
          const text =
            `Task "${notifyAfterCommit.taskID}" in Application "${notifyAfterCommit.appAcronym}" ` +
            `was promoted to Done by ${notifyAfterCommit.reviewer}. ` +
            `Please review the task.`;

          await sendMail(emails.join(","), subject, text);
        } catch (e) {
          console.error("Done-review email failed:", e?.message || e);
        }
      })();
    }

    const [rows] = await pool.query(
      `SELECT Task_id, Task_description, Task_notes, Task_plan, Task_app_Acronym,
              Task_state, Task_creator, Task_owner, Task_createDate, Task_id
       FROM task WHERE Task_id = ?`,
      [taskID]
    );
    res.json(rows[0]);
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    res
      .status(500)
      .json({ ok: false, message: e.message || "Failed to update task" });
  } finally {
    conn.release();
  }
}

export async function getTasksByState(req, res) {
  try {
    // ---- U_1: malformed URL/URI (no :state provided) ----
    const rawParam = (req.params && typeof req.params.state === "string")
      ? req.params.state.trim()
      : "";
    if (!rawParam) {
      return res.status(400).json({ status: "U_1" });
    }

    // ---- IAM_1: invalid credentials (defensive; ensureAuth should gate) ----
    const username = String(req.user?.username || "").trim();
    if (!username) {
      return res.status(401).json({ status: "IAM_1" });
    }

    // ---- Normalise and validate the state ----
    // Accept "to-do" / "todo" as "ToDo"
    const normalised =
      rawParam.toLowerCase() === "to-do" || rawParam.toLowerCase() === "todo"
        ? "ToDo"
        : rawParam;

    // VALID_STATES should be: new Set(["Open","ToDo","Doing","Done","Closed"])
    if (!VALID_STATES.has(normalised)) {
      // ---- P_1: Task_state invalid ----
      return res.status(400).json({ status: "P_1" });
    }

    // Optional filters ?app=JOHN&plan=Sprint%201
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

    // ---- S_1: Success (return the data directly, like your table) ----
    return res.status(200).json(rows);
  } catch (e) {
    // ---- UE: Unspecified error ----
    console.error("getTasksByState error:", e?.message || e);
    return res.status(500).json({ status: "UE" });
  }
}

export async function promoteTaskToDone(req, res) {
  const conn = await pool.getConnection();
  try {
    // IAM_1: invalid credentials (defensive; ensureAuth should gate)
    const username = String(req.user?.username || "").trim();
    if (!username) return res.status(401).json({ status: "IAM_1" });

    // U_1: malformed URL/URI (no :taskID path param)
    const taskID = String(req.params.taskID || "").trim();
    if (!taskID) return res.status(400).json({ status: "U_1" });

    await conn.beginTransaction();

    // Load task
    const [[t]] = await conn.query(
      "SELECT Task_name, Task_state, Task_plan, Task_app_Acronym, Task_notes FROM task WHERE Task_id = ? FOR UPDATE",
      [taskID]
    );
    if (!t) {
      await conn.rollback();
      return res.status(404).json({ status: "TR_1" }); // Task not found
    }

    // Load app permits
    const [[a]] = await conn.query(
      `SELECT App_Acronym, App_permit_Open, App_permit_toDoList, App_permit_Done
       FROM application WHERE App_Acronym = ? LIMIT 1`,
      [t.Task_app_Acronym]
    );
    if (!a) {
      await conn.rollback();
      return res.status(404).json({ status: "TR_1" }); // treat as task not found/app missing
    }

    // TR_2: Task not in "Doing" state
    if (t.Task_state !== "Doing") {
      await conn.rollback();
      return res.status(400).json({ status: "TR_2" });
    }

    // IAM_2: Not authorised (user not in required ToDo permit groups)
    const permitToDo = csv(a.App_permit_toDoList);
    const inAny =
      permitToDo.length &&
      (await Promise.all(permitToDo.map((g) => isUserInGroup(username, g)))).some(Boolean);

    if (!inAny) {
      await conn.rollback();
      return res.status(403).json({ status: "IAM_2" });
    }

    // State change + audit note
    await conn.query("UPDATE task SET Task_state='Done' WHERE Task_id=?", [taskID]);
    await conn.query(
      "UPDATE task SET Task_notes = CONCAT(COALESCE(Task_notes,''), ?) WHERE Task_id = ?",
      [makeNoteEntry(username, "Task reviewed: Doing → Done", "Done"), taskID]
    );

    // Prepare email (notify Done-permit groups) after commit
    const permitDone = csv(a.App_permit_Done);
    const notifyAfterCommit = {
      appAcronym: t.Task_app_Acronym,
      taskID: taskID,
      reviewer: username,
      permitDoneGroups: permitDone,
    };

    await conn.commit();

    (async () => {
      try {
        const emails = await getEmailsForGroups(notifyAfterCommit.permitDoneGroups);
        if (!emails.length) return;
        const subject = `[${notifyAfterCommit.appAcronym}] Task ready for Review: ${notifyAfterCommit.taskID}`;
        const text =
          `Task "${notifyAfterCommit.taskID}" in Application "${notifyAfterCommit.appAcronym}" ` +
          `was promoted to Done by ${notifyAfterCommit.reviewer}. Please review the task.`;
        await sendMail(emails.join(","), subject, text);
      } catch (e) {
        console.error("Done-review email failed:", e?.message || e);
      }
    })();

    // S_1: Success
    return res.status(201).json({ status: "S_1" });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("promoteTaskToDone error:", e?.message || e);
    return res.status(500).json({ status: "UE" });
  } finally {
    conn.release();
  }
}
