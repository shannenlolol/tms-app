// src/components/CreateTaskModal.jsx
import React, { useEffect, useMemo } from "react";

export default function CreateTaskModal({
  open,
  onClose,
  onSubmit,
  values,          // { Task_app_Acronym, Task_name, Task_description, Task_plan, Task_notes }
  setValues,
  error,
  apps = [],
  plans = [],      // pass ALL plans here if you want truly free selection
  canCreate,
  existingNotes = [],
}) {
  if (!open) return null;
  const change = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  // (optional) clear selected plan when app changes; keep if you want to avoid cross-app mismatches
  useEffect(() => {
    setValues((prev) => ({ ...prev, Task_plan: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.Task_app_Acronym]);

  const appOptions = apps.map((a) => a.App_Acronym);

  // Only show plans whose Plan_app_Acronym matches the selected application
  const planOptions = useMemo(
    () => (values.Task_app_Acronym
      ? (plans || []).filter(p => p.Plan_app_Acronym === values.Task_app_Acronym)
      : []),
    [plans, values.Task_app_Acronym]
  );
  
  const fmt = (d) => {
    if (!d) return "—";
    const x = new Date(d);
    if (Number.isNaN(+x)) return String(d);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${x.getDate()} ${months[x.getMonth()]} ${x.getFullYear()}`; // e.g., 27 Oct 2025
  };

  const disabled =
    !values.Task_app_Acronym ||
    !String(values.Task_name || "").trim() ||
    !canCreate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[min(920px,95vw)] rounded-2xl bg-white shadow-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-4">Create Task</h2>
          <button
            onClick={onClose}
            className="btn-gray text-white px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
          >
            X
          </button>
        </div>
        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: core fields */}
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm mb-1">Application</div>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={values.Task_app_Acronym}
                onChange={(e) => change("Task_app_Acronym", e.target.value)}
              >
                <option value="">Select an application…</option>
                {appOptions.map((acr) => (
                  <option key={acr} value={acr}>
                    {acr}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-sm mb-1">Task Name</div>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={values.Task_name}
                onChange={(e) => change("Task_name", e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Task Description</div>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                rows={4}
                value={values.Task_description}
                onChange={(e) => change("Task_description", e.target.value)}
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Plan (optional)</div>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={values.Task_plan || ""}
                onChange={(e) => setValues(prev => ({ ...prev, Task_plan: e.target.value }))}
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
            </label>

          </div>

          {/* RIGHT: Notes list + Entry */}
          <div className="space-y-3">
            <div>
              <div className="text-sm mb-1">Notes</div>
              <div className="min-h-[120px] rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                {existingNotes.length === 0 ? (
                  <span className="italic text-gray-500">No entries.</span>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {existingNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <label className="block">
              <div className="text-sm mb-1">Entry</div>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                rows={4}
                placeholder="Insert Entry Here…"
                value={values.Task_notes || ""}
                onChange={(e) => change("Task_notes", e.target.value)}
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={onSubmit}
            disabled={disabled}
            className={`px-4 py-2 mt-2 rounded-lg text-white ${disabled ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
          >
            Create Task
          </button>

        </div>
      </div>
    </div>
  );
}
