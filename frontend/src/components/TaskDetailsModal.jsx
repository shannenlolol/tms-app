// src/components/TaskDetailsModal.jsx
import React, { useMemo, useState, useEffect } from "react";

// Keep in sync with backend NOTE_SEP
const NOTE_SEP = "\n--- NOTE ENTRY ---\n";

const fmt = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(+x)) return String(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${x.getDate()} ${months[x.getMonth()]} ${x.getFullYear()}`;
};

function parseNotes(text) {
  if (!text) return [];
  return text
    .split(NOTE_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((block, idx) => {
      const nl = block.indexOf("\n");
      const header = nl >= 0 ? block.slice(0, nl) : block;
      const body = nl >= 0 ? block.slice(nl + 1) : "";
      return { id: idx, header, body };
    })
    .reverse(); // newest first
}

const badgeFor = (state) => {
  const m = {
    Open: "bg-sky-100 text-sky-800",
    ToDo: "bg-amber-100 text-amber-800",
    Doing: "bg-indigo-100 text-indigo-800",
    Done: "bg-emerald-100 text-emerald-800",
    Closed: "bg-gray-200 text-gray-700",
  };
  return m[state] || "bg-gray-100 text-gray-700";
};

const Row = ({ label, value }) => (
  <div className="flex gap-2 text-sm">
    <div className="w-24 text-gray-500">{label}</div>
    <div className="flex-1">{value || <span className="text-gray-400">—</span>}</div>
  </div>
);

const planLabel = (planName, options) => {
  if (!planName) return "";
  const meta = (options || []).find((p) => p.Plan_MVP_name === planName);
  if (!meta) return planName;
  const range =
    meta.Plan_startDate || meta.Plan_endDate
      ? ` (${fmt(meta.Plan_startDate)} - ${fmt(meta.Plan_endDate)})`
      : "";
  return `${planName}${range}`;
};

export default function TaskDetailsModal({
  open,
  task,
  onClose,
  onAppendNote,
  planOptions = [],
  canOpenActions = false,
  canToDoActions = false,
  canDoingActions = false,
  canDoneActions = false,
  onChangePlan,
  onRelease,
  onTake,
  onDrop,
  onReview,
  onApprove,
  onReject,
}) {
  const [entry, setEntry] = useState("");
  const [busyAction, setBusyAction] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  const notes = useMemo(() => parseNotes(task?.Task_notes), [task?.Task_notes]);
  if (!open || !task) return null;

  // Only allow writing notes when user has permission in current state
  const canWriteEntry =
    (task.Task_state === "Open" && canOpenActions) ||
    (task.Task_state === "ToDo" && canToDoActions) ||
    (task.Task_state === "Doing" && canDoingActions) ||
    (task.Task_state === "Done" && canDoneActions);

  // Separate Add Note action
  const handleAddNoteClick = async () => {
    if (busyAction || !entry.trim()) return;
    try {
      setBusyAction("note");
      await onAppendNote?.(entry.trim());
      setEntry("");
    } catch (e) {
      setMsg(extractErr(e));
    } finally {
      setBusyAction(null);
    }
  };

  const hasPlan = (t) => !!(t?.Task_plan && String(t.Task_plan).trim() !== "");

  // tiny helper to pull a readable error message
  function extractErr(err) {
    const status = err?.response?.status;
    const d = err?.response?.data;
    if (status === 409) return "Task state changed by someone else; please refresh.";
    return d?.message || d?.error || err?.message || "Something went wrong.";
  }

  async function runAction(label, fn, { requirePlan = false } = {}) {
    if (busyAction) return;
    // if (requirePlan && !hasPlan(task)) {
    //   setMsg("Please select a plan first.");
    //   return;
    // }
    try {
      setBusyAction(label);
      await fn?.();
      onClose?.();
    } catch (e) {
      setMsg(extractErr(e));
    } finally {
      setBusyAction(null);
    }
  }

  // handlers (use runAction everywhere so errors surface and modal stays open)
  const handleApproveClick = () => runAction("approve", onApprove, { requirePlan: true });
  const handleRejectClick = () => runAction("reject", onReject, { requirePlan: true });
  const handleReleaseClick = () => runAction("release", onRelease, { requirePlan: true });
  const handleTakeClick = () => runAction("take", onTake, { requirePlan: false });
  const handleReviewClick = () => runAction("review", onReview);
  const handleDropClick = () => runAction("drop", onDrop);

  const disableAll = !!busyAction;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={disableAll ? undefined : onClose} />
      <div className="relative z-10 w-[min(1100px,95vw)] rounded-2xl bg-white shadow-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xl font-semibold">
            {task.Task_id}: {task.Task_name}
          </div>
          <button
            onClick={onClose}
            disabled={disableAll}
            className={`btn-gray text-white rounded-md ${disableAll ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            X
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* LEFT: details & actions */}
          <div className="space-y-3">
            <span
              className={`inline-block w-fit rounded-md px-2 py-0.5 text-xs font-semibold ${badgeFor(
                task.Task_state
              )}`}
            >
              {task.Task_state.toUpperCase()}
            </span>

            <div className="mt-2">
              <div className="mb-1 text-sm text-gray-500">Task Description:</div>
              <div className="min-h-[72px] whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                {task.Task_description}
              </div>
            </div>

            <div className="mt-6 space-y-1">
              <Row label="Owner:" value={task.Task_owner} />
              <Row label="Creator:" value={task.Task_creator} />
              <Row label="Created On:" value={fmt(task.Task_createDate)} />
            </div>

            {/* Show plan for states other than open/done */}
            {!(task.Task_state === "Open" && canOpenActions) && !(task.Task_state === "Done" && canDoneActions) && (
              <div className="mt-6">
                <Row label="Plan:" value={planLabel(task.Task_plan, planOptions)} />
              </div>
            )}

            {/* ACTIONS (Open) */}
            {task.Task_state === "Open" && canOpenActions && (
              <div className="mt-8 space-y-2">
                <div className="text-sm text-gray-600">Plan:</div>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-indigo-400"
                  value={task.Task_plan || ""}
                  onChange={(e) => {
                    setMsg("");
                    onChangePlan?.(e.target.value || null);
                  }}
                  disabled={disableAll}
                >
                  <option value="">— No plan —</option>
                  {(planOptions || [])
                    .filter((p) => p.Plan_app_Acronym === task.Task_app_Acronym)
                    .map((p) => {
                      const range =
                        p.Plan_startDate || p.Plan_endDate ? ` (${fmt(p.Plan_startDate)} - ${fmt(p.Plan_endDate)})` : "";
                      return (
                        <option key={p.Plan_MVP_name} value={p.Plan_MVP_name}>
                          {p.Plan_MVP_name}
                          {range}
                        </option>
                      );
                    })}
                </select>
                {/* error banner */}
                {msg && (
                  <div
                    className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                    aria-live="polite"
                  >
                    {msg}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleReleaseClick}
                  disabled={disableAll}
                  className={`mt-8 rounded-md px-3 py-1.5 text-white ${disableAll ? "bg-sky-300 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-700"
                    }`}
                >
                  {busyAction === "release" ? "Releasing…" : "Release Task"}
                </button>
              </div>
            )}

            {/* ACTIONS (ToDo) */}
            {task.Task_state === "ToDo" && canToDoActions && (
              <div className="mt-6">
                {/* error banner */}
                {msg && (
                  <div
                    className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                    aria-live="polite"
                  >
                    {msg}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleTakeClick}
                  disabled={disableAll}
                  className={`rounded-md mt-6 px-3 py-1.5 text-white ${disableAll ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                >
                  {busyAction === "take" ? "Taking…" : "Take Task"}
                </button>
              </div>
            )}

            {/* ACTIONS (Doing) */}
            {task.Task_state === "Doing" && canDoingActions && (

              <div className="mt-6">
                {/* error banner */}
                {msg && (
                  <div
                    className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                    aria-live="polite"
                  >
                    {msg}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleReviewClick}
                  disabled={disableAll}
                  className={`btn-green mt-6 mr-4 rounded-md px-3 py-1.5 text-white ${disableAll ? "bg-emerald-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                >
                  {busyAction === "review" ? "Requesting…" : "Request Task Review"}
                </button>
                <button
                  type="button"
                  onClick={handleDropClick}
                  disabled={disableAll}
                  className={`btn-red rounded-md px-3 py-1.5 text-white ${disableAll ? "bg-amber-300 cursor-not-allowed" : "bg-amber-600 hover:bg-amber-700"
                    }`}
                >
                  {busyAction === "drop" ? "Dropping…" : "Drop Task"}
                </button>
              </div>
            )}

            {/* ACTIONS (Done) */}
            {task.Task_state === "Done" && canDoneActions && (
              <div className="mt-6">
                <div className="text-sm text-gray-600">Plan:</div>

                <select
                  className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-indigo-400"
                  value={task.Task_plan || ""}
                  onChange={(e) => onChangePlan?.(e.target.value || null)}
                  disabled={disableAll}
                >
                  <option value="">— No plan —</option>
                  {(planOptions || [])
                    .filter((p) => p.Plan_app_Acronym === task.Task_app_Acronym)
                    .map((p) => {
                      const range =
                        p.Plan_startDate || p.Plan_endDate ? ` (${fmt(p.Plan_startDate)} - ${fmt(p.Plan_endDate)})` : "";
                      return (
                        <option key={p.Plan_MVP_name} value={p.Plan_MVP_name}>
                          {p.Plan_MVP_name}
                          {range}
                        </option>
                      );
                    })}
                </select>

                {/* error banner */}
                {msg && (
                  <div
                    className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                    aria-live="polite"
                  >
                    {msg}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleApproveClick}
                  disabled={disableAll}
                  className={`btn-green mt-6 mr-4 rounded-md px-3 py-1.5 text-white ${disableAll ? "bg-slate-300 cursor-not-allowed" : "bg-slate-700 hover:bg-slate-800"
                    }`}
                >
                  {busyAction === "approve" ? "Approving…" : "Approve Task"}
                </button>
                <button
                  type="button"
                  onClick={handleRejectClick}
                  disabled={disableAll}
                  className={`btn-red rounded-md px-3 py-1.5 text-white ${disableAll ? "bg-rose-300 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700"
                    }`}
                >
                  {busyAction === "reject" ? "Rejecting…" : "Reject Task"}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Notes + (conditional) Entry */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-sm">Notes</div>
              <div className="min-h-[160px] max-h-[40vh] overflow-auto rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                {notes.length === 0 ? (
                  <div className="italic text-gray-500">No entries.</div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((n) => (
                      <div key={n.id}>
                        <div className="font-semibold">{n.header}</div>
                        {n.body && <div className="whitespace-pre-wrap text-gray-700">{n.body}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Entry + Add Note button (only when permitted) */}
            {canWriteEntry && (
              <div>
                <div className="mb-1 text-sm">Entry</div>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                  rows={4}
                  placeholder="Insert Entry Here…"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  disabled={disableAll}
                />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleAddNoteClick}
                    disabled={disableAll || !entry.trim()}
                    className={`rounded-md px-3 py-1.5 text-white ${disableAll || !entry.trim() ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                  >
                    {busyAction === "note" ? "Adding…" : "Add Note"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
