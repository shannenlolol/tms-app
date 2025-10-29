// src/pages/Kanban.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getApplications } from "../api/applications";
import { getTasks, createTask, appendTaskNote, updateTask } from "../api/tasks";
import { checkGroup } from "../api/users";
import CreateTaskModal from "../components/CreateTaskModal";
import TaskDetailsModal from "../components/TaskDetailsModal";
import { getPlans, createPlan } from "../api/plans";
import CreatePlanModal from "../components/CreatePlanModal";

const COLUMNS = ["Open", "To-Do", "Doing", "Done", "Closed"];
const STATE_MAP = {
  Open: "Open",
  "To-Do": "ToDo", 
  Doing: "Doing",
  Done: "Done",
  Closed: "Closed",
};

const csvToList = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
    
const lc = (s) => String(s ?? "").toLowerCase();

function userGroupSet(user) {
  const raw = user?.groups ?? user?.usergroups ?? user?.usergroup ?? [];
  const arr = Array.isArray(raw) ? raw : csvToList(raw);
  return new Set(arr.map(lc));
}
function getCreatePermitGroups(app) {
  const v = app?.Permit_Create ?? "";
  return Array.isArray(v) ? v : csvToList(v);
}

const fmt = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(+x)) return String(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${x.getDate()} ${months[x.getMonth()]} ${x.getFullYear()}`;
};

export default function Kanban() {
  const { ready, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // ======== state (INSIDE component) ========
  const [apps, setApps] = useState([]);
  const [plans, setPlans] = useState([]); // plans for the selected app in the create-task modal
  const [tasks, setTasks] = useState([]); // all tasks for the board

  const [modalOpen, setModalOpen] = useState(false);
  const [err, setErr] = useState("");
  const [values, setValues] = useState({
    Task_app_Acronym: "",
    Task_name: "",
    Task_description: "",
    Task_plan: "",
    Task_notes: "",
  });
  const [canCreate, setCanCreate] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [activePlans, setActivePlans] = useState([]);
  const [canOpenActions, setCanOpenActions] = useState(false);
  const [canToDoActions, setCanToDoActions] = useState(false);
  const [canDoingActions, setCanDoingActions] = useState(false);
  const [canDoneActions, setCanDoneActions] = useState(false);

  // PM-only "Add Plan" modal
  const [pmModalOpen, setPmModalOpen] = useState(false);
  const [pmErr, setPmErr] = useState("");
  const [isPM, setIsPM] = useState(false);

  // ======== effects ========

  // Check if current user is a project manager
  useEffect(() => {
    (async () => {
      try {
        const ok = await checkGroup(user?.username, "project manager");
        setIsPM(!!ok);
      } catch {
        setIsPM(false);
      }
    })();
  }, [user?.username]);

  // Load apps once
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    (async () => {
      try {
        const list = await getApplications();
        setApps(Array.isArray(list) ? list : []);
      } catch {
        setApps([]);
      }
    })();
  }, [ready, isAuthenticated]);
  // Load ALL plans once (so TaskCards can show ranges)
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    (async () => {
      try {
        const list = await getPlans(); // no filter -> all plans
        setPlans(Array.isArray(list) ? list : []);
      } catch {
        setPlans([]);
      }
    })();
  }, [ready, isAuthenticated]);
  // Load all tasks for the board
  const fetchTasks = async () => {
    try {
      const list = await getTasks(); // no filters -> all tasks
      setTasks(Array.isArray(list) ? list : []);
    } catch {
      setTasks([]);
    }
  };
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    fetchTasks();
  }, [ready, isAuthenticated]);

  // Selected app for the create-task modal
  const selectedApp = useMemo(() => {
    if (!values.Task_app_Acronym) return null;
    return (apps || []).find(
      (a) => String(a.App_Acronym) === String(values.Task_app_Acronym)
    );
  }, [apps, values.Task_app_Acronym]);


  // Permission for Create Task (based on selected app)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedApp || !user?.username) {
        if (!cancelled) setCanCreate(false);
        return;
      }

      const permitted = getCreatePermitGroups(selectedApp);
      if (permitted.length === 0) {
        if (!cancelled) setCanCreate(false);
        return;
      }

      // quick client-side intersect if user carries groups in token
      const userSet = userGroupSet(user);
      if (userSet.size > 0) {
        const ok = permitted.some((g) => userSet.has(lc(g)));
        if (!cancelled && ok) {
          setCanCreate(true);
          return;
        }
      }

      // server-authoritative checks
      try {
        const checks = await Promise.all(
          permitted.map((g) => checkGroup(user.username, g))
        );
        const allowed = checks.some(Boolean);
        if (!cancelled) setCanCreate(allowed);
      } catch {
        if (!cancelled) setCanCreate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedApp, user?.username]);

  // ======== details modal helpers ========
  // Build a quick lookup: plan name -> plan object
  const planByName = useMemo(
    () => new Map((plans || []).map(p => [p.Plan_MVP_name, p])),
    [plans]
  );
  const openDetails = async (t) => {
    setActiveTask(t);

    // Load plans for that task's app (for plan dropdown when in Open)
    try {
      const list = await getPlans();
      const all = Array.isArray(list) ? list : [];
      setActivePlans(all.filter(p => p.Plan_app_Acronym === t.Task_app_Acronym));
    } catch {
      setActivePlans([]);
    }

    // Find the application to read permits
    const app = (apps || []).find((a) => a.App_Acronym === t.Task_app_Acronym);
    const permitOpenCSV = app?.Permit_Open ?? "";
    const permitToDoCSV = app?.Permit_ToDo ?? "";
    const permitDoingCSV = app?.Permit_Doing ?? "";
    const permitDoneCSV = app?.Permit_Done ?? "";

    const openGroups = String(permitOpenCSV)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const todoGroups = String(permitToDoCSV)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const doingGroups = String(permitDoingCSV).split(",").map(s => s.trim()).filter(Boolean);
    const doneGroups = String(permitDoneCSV).split(",").map(s => s.trim()).filter(Boolean);
    const username = String(user?.username || "").trim();
    let openAllowed = false,
      todoAllowed = false;
    let doingAllowed = false, doneAllowed = false;
    if (username) {
      if (openGroups.length) {
        const checks = await Promise.all(
          openGroups.map((g) => checkGroup(username, g))
        );
        openAllowed = checks.some(Boolean);
      }
      if (todoGroups.length) {
        const checks2 = await Promise.all(
          todoGroups.map((g) => checkGroup(username, g))
        );
        todoAllowed = checks2.some(Boolean);
      }
      if (doingGroups.length) { const c = await Promise.all(doingGroups.map(g => checkGroup(username, g))); doingAllowed = c.some(Boolean); }
      if (doneGroups.length) { const c = await Promise.all(doneGroups.map(g => checkGroup(username, g))); doneAllowed = c.some(Boolean); }
    }

    setCanOpenActions(openAllowed);
    setCanToDoActions(todoAllowed);
    setCanDoingActions(doingAllowed);
    setCanDoneActions(doneAllowed);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setActiveTask(null);
    setActivePlans([]);
  };

  const refreshAndSync = async (keepName) => {
    const list = await getTasks();
    setTasks(Array.isArray(list) ? list : []);
    if (keepName) {
      const updated = list.find((x) => x.Task_name === keepName);
      if (updated) setActiveTask(updated);
    }
  };

  // details actions
  const handleChangePlan = async (newPlan) => {
    if (!activeTask) return;
    await updateTask(activeTask.Task_name, { Task_plan: newPlan });
    await refreshAndSync(activeTask.Task_name);
  };

  const handleRelease = async () => {
    if (!activeTask) return;
    await updateTask(activeTask.Task_name, { Task_state: "ToDo" });
    await refreshAndSync(activeTask.Task_name);
  };

  const handleTake = async () => {
    if (!activeTask) return;
    await updateTask(activeTask.Task_name, { Task_state: "Doing" });
    await refreshAndSync(activeTask.Task_name);
  };
  const handleDrop = async () => { if (!activeTask) return; await updateTask(activeTask.Task_name, { Task_state: "ToDo" }); await refreshAndSync(activeTask.Task_name); };
  const handleReview = async () => { if (!activeTask) return; await updateTask(activeTask.Task_name, { Task_state: "Done" }); await refreshAndSync(activeTask.Task_name); };
  const handleApprove = async () => {
    if (!activeTask) return;
    await updateTask(activeTask.Task_name, { Task_state: "Closed" }); // Done -> Closed
    await refreshAndSync(activeTask.Task_name);
  };

  const handleReject = async () => {
    if (!activeTask) return;
    await updateTask(activeTask.Task_name, { Task_state: "Doing" });  // Done -> Doing
    await refreshAndSync(activeTask.Task_name);
  };
  // ======== UI helpers ========

  function TaskCard({ t }) {
    const creator = t.Task_owner || t.Task_creator || "—";
    const planName = t.Task_plan || "";
    const meta = planName ? planByName.get(planName) : null;

    const range =
      meta && (meta.Plan_startDate || meta.Plan_endDate)
        ? `${fmt(meta.Plan_startDate)} - ${fmt(meta.Plan_endDate)}`
        : "";

    return (
          <button
      type="button"
      onClick={() => openDetails(t)}
      className="btn-white w-full text-left rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md hover:border-indigo-300 transition"
    >
      {/* Title */}
      <div className="text-base text-gray-900">
        <span className="font-semibold">{t.Task_id} : {t.Task_name}</span>
      </div>

      {/* Plan chip */}
      {planName ? (
        <div className="mt-3 mb-3 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
          {planName}
        </div>
      ) : null}

      {/* Date range */}
      {range ? (
        <div className="mt-1 text-xs text-gray-600">
          {range}
        </div>
      ) : null}

      {/* Footer meta */}
      <div className="mt-3 text-xs text-gray-500">
        Created by: {creator}
      </div>
    </button>
    );
  }


  if (!ready) return null;
  if (!isAuthenticated) return <div className="p-6">Please sign in.</div>;

  const openCreateTaskModal = () => {
    setErr("");
    setModalOpen(true);
  };
  const closeCreateTaskModal = () => {
    setModalOpen(false);
    setErr("");
    setValues((v) => ({
      ...v,
      Task_name: "",
      Task_description: "",
      Task_plan: "",
      Task_notes: "",
    }));
  };

  const submitNewPlan = async (vals) => {
    try {
      await createPlan(vals); // { Plan_MVP_name, Plan_startDate, Plan_endDate }
      setPmModalOpen(false);
      setPmErr("");
      const list = await getPlans();
      const all = Array.isArray(list) ? list : [];
      setPlans(all);                    // <-- refresh global plans (used by CreateTaskModal)
      // if the details modal is open, refresh the filtered list for that task too
      if (activeTask) {
        setActivePlans(all.filter(p => p.Plan_app_Acronym === activeTask.Task_app_Acronym));
      }
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string"
          ? e.response.data
          : e?.response?.data?.message) ||
        e?.message ||
        "Create plan failed";
      setPmErr(m);
    }
  };

  const submitTask = async () => {
    if (!values.Task_app_Acronym) {
      setErr("Please select an application.");
      return;
    }
    if (!String(values.Task_name || "").trim()) {
      setErr("Task name is required.");
      return;
    }
    if (!canCreate) {
      setErr("You’re not permitted to create tasks for this application.");
      return;
    }
    try {
      await createTask({
        Task_app_Acronym: values.Task_app_Acronym,
        Task_name: values.Task_name.trim(),
        Task_description: values.Task_description || "",
        Task_plan: values.Task_plan || undefined,
        Task_notes: values.Task_notes || null,
      });
      closeCreateTaskModal();
      await fetchTasks(); // refresh so the new task appears in Open
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string"
          ? e.response.data
          : e?.response?.data?.message) ||
        e?.message ||
        "Create task failed";
      setErr(m);
    }
  };

  // Build column buckets
  const tasksByState = useMemo(() => {
    const buckets = { Open: [], ToDo: [], Doing: [], Done: [], Closed: [] };
    for (const t of tasks) {
      const s = t.Task_state;
      if (s in buckets) buckets[s].push(t);
    }
    Object.values(buckets).forEach((list) =>
      list.sort((a, b) =>
        (b.Task_createDate || "").localeCompare(a.Task_createDate || "")
      )
    );
    return buckets;
  }, [tasks]);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between px-2">
        <p className="text-xl font-bold">Kanban</p>
        {isPM && (
          <button
            onClick={() => {
              setPmErr("");
              setPmModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
            title="Create Plan"
          >
            <span className="text-xl leading-none">＋</span>
            <span>Add Plan</span>
          </button>
        )}
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const apiState = STATE_MAP[col];
          const list = tasksByState[apiState] || [];
          return (
            <div
              key={col}
              className="rounded-xl border border-gray-200 bg-white"
            >
              <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3 font-medium">
                <span>{col}</span>
                {/* Add Task only in Open */}
                <button
                  type="button"
                  onClick={openCreateTaskModal}
                  aria-disabled={col !== "Open"}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition ${col === "Open"
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "invisible pointer-events-none select-none"
                    }`}
                >
                  <span className="text-base leading-none">＋</span>
                  <span>Add Task</span>
                </button>
              </div>

              <div className="min-h-[120px] space-y-3 p-3">
                {list.length === 0 ? (
                  <div className="italic text-gray-400">No Tasks</div>
                ) : (
                  list.map((t) => <TaskCard key={t.Task_id} t={t} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <CreateTaskModal
        open={modalOpen}
        onClose={closeCreateTaskModal}
        onSubmit={submitTask}
        values={values}
        setValues={setValues}
        error={err}
        apps={apps}
        plans={plans}
        canCreate={canCreate}
      />

      <TaskDetailsModal
        open={detailsOpen}
        task={activeTask}
        onClose={closeDetails}
        onAppendNote={async (text) => {
          if (!activeTask) return;
          await appendTaskNote(activeTask.Task_name, text);
          await refreshAndSync(activeTask.Task_name);
        }}
        planOptions={activePlans}
        canOpenActions={canOpenActions}
        canToDoActions={canToDoActions}
        onChangePlan={handleChangePlan}
        onRelease={handleRelease}
        onTake={handleTake}
        canDoingActions={canDoingActions}
        canDoneActions={canDoneActions}
        onDrop={handleDrop}
        onReview={handleReview}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <CreatePlanModal
        open={pmModalOpen}
        onClose={() => { setPmModalOpen(false); setPmErr(""); }}
        onSubmit={submitNewPlan}
        error={pmErr}
        apps={apps}
      />
    </div>
  );
}
