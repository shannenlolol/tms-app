// src/components/TaskDetailsModal.jsx
import React, { useMemo, useState } from "react";

// Keep in sync with backend NOTE_SEP
const NOTE_SEP = "\n--- NOTE ENTRY ---\n";

// 27 Oct 2025
const fmtDMY = (v) => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v).replace(/T.*$/, ""));
  if (Number.isNaN(+d)) return String(v);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// 27 Oct 2025 for plan dates
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

export default function TaskDetailsModal({
  open,
  task,
  onClose,
  onAppendNote,          // async (text) => void
  planOptions = [],      // [{ Plan_MVP_name, Plan_app_Acronym, Plan_startDate, Plan_endDate }, ...]
  canOpenActions = false,
  canToDoActions = false,
  onChangePlan,          // (newPlan|null) => void
  onRelease,             // () => void
  onTake,                // () => void
}) {
  const [entry, setEntry] = useState("");
  const [busyAction, setBusyAction] = useState(null); // 'release' | 'take' | null

  const notes = useMemo(() => parseNotes(task?.Task_notes), [task?.Task_notes]);
  if (!open || !task) return null;

  // User can write an entry only when they have action permission in the current state
  const canWriteEntry =
    (task.Task_state === "Open" && canOpenActions) ||
    (task.Task_state === "ToDo" && canToDoActions);

  // Append entry (if any) then release; close modal afterwards
  const handleReleaseClick = async () => {
    if (busyAction) return;
    try {
      setBusyAction("release");
      const text = entry.trim();
      if (text) {
        try { await onAppendNote?.(text); } catch { }
        setEntry("");
      }
      await onRelease?.();
      onClose?.(); // close after success
    } finally {
      setBusyAction(null);
    }
  };

  // Take (no entry append), then close modal
  const handleTakeClick = async () => {
    if (busyAction) return;
    try {
      setBusyAction("take");
      await onTake?.();
      onClose?.(); // close after success
    } finally {
      setBusyAction(null);
    }
  };

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
                {task.Task_description || (
                  <span className="italic text-gray-400">Insert Description here</span>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-1">
              <Row label="Owner:" value={task.Task_owner} />
              <Row label="Creator:" value={task.Task_creator} />
              <Row label="Created On:" value={fmtDMY(task.Task_createDate)} />
            </div>

            {/* ACTIONS (Open) */}
            {task.Task_state === "Open" && canOpenActions && (
              <div className="mt-8 space-y-2">
                <div className="text-sm text-gray-600">Plan:</div>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-indigo-400"
                  value={task.Task_plan || ""}
                  onChange={(e) => onChangePlan?.(e.target.value || null)}
                  disabled={disableAll}
                >
                  <option value="">— No plan —</option>
                  {planOptions.map((p) => {
                    const range =
                      p.Plan_startDate || p.Plan_endDate
                        ? ` • ${fmt(p.Plan_startDate)} - ${fmt(p.Plan_endDate)}`
                        : "";
                    return (
                      <option key={p.Plan_MVP_name} value={p.Plan_MVP_name}>
                        {p.Plan_MVP_name}
                        {range}
                      </option>
                    );
                  })}
                </select>

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
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleTakeClick}
                  disabled={disableAll}
                  className={`rounded-md px-3 py-1.5 text-white ${disableAll ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                >
                  {busyAction === "take" ? "Taking…" : "Take Task"}
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

            {/* Entry is only visible/enabled when user has permission */}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
