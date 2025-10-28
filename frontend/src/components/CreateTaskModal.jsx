// src/components/CreateTaskModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function CreateTaskModal({ ...props }) {
  const {
    open,
    onClose,
    onSubmit,
    values,
    setValues,
    error,
    apps = [],
    plans = [],
    canCreate,
    existingNotes = [],
  } = props;

  if (!open) return null;

  const change = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  // -------------------- Error banner with timeout (robust) --------------------
  const [msg, setMsg] = useState(null); // { text: string, key: number } | null
  const timerRef = useRef(null);

  // Derive a stable string from `error`
  const errorText =
    typeof error === "string"
      ? error
      : (error && (error.message || error.error || String(error))) || "";

  // Whenever parent supplies a (truthy) error, set a NEW object with a unique key
  useEffect(() => {
    if (!errorText) return;
    setMsg({ text: errorText, key: Date.now() }); // new key every time, even if text is same
  }, [errorText]);

  // Start/refresh the 5s timer whenever the key changes
  useEffect(() => {
    if (!msg) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setMsg(null);
      timerRef.current = null;
    }, 5000);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [msg?.key]);

  // Clear message when modal closes
  useEffect(() => {
    if (!open && msg) setMsg(null);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, msg]);

  const changeAndClear = (k, v) => {
  if (msg) setMsg(null);
  setValues((prev) => ({ ...prev, [k]: v }));
};
  // ---------------------------------------------------------------------------

  // reset plan when app changes
  useEffect(() => {
    setValues((prev) => ({ ...prev, Task_plan: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.Task_app_Acronym]);

  const appOptions = apps.map((a) => a.App_Acronym);

  const planOptions = useMemo(
    () =>
      values.Task_app_Acronym
        ? (plans || []).filter((p) => p.Plan_app_Acronym === values.Task_app_Acronym)
        : [],
    [plans, values.Task_app_Acronym]
  );

  const fmt = (d) => {
    if (!d) return "—";
    const x = new Date(d);
    if (Number.isNaN(+x)) return String(d);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${x.getDate()} ${months[x.getMonth()]} ${x.getFullYear()}`;
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


        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm mb-1">Application</div>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={values.Task_app_Acronym}
                onChange={(e) => changeAndClear("Task_app_Acronym", e.target.value)}
              >
                <option value="">Select an application…</option>
                {appOptions.map((acr) => (
                  <option key={acr} value={acr}>{acr}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-sm mb-1">Task Name</div>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={values.Task_name}
                onChange={(e) => changeAndClear("Task_name", e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Task Description</div>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                rows={4}
                value={values.Task_description}
                onChange={(e) => changeAndClear("Task_description", e.target.value)}
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Plan (optional)</div>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={values.Task_plan || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, Task_plan: e.target.value }))}
              >
                <option value="">— No plan —</option>
                {planOptions.map((p) => {
                  const range =
                    p.Plan_startDate || p.Plan_endDate
                      ? ` (${fmt(p.Plan_startDate)} - ${fmt(p.Plan_endDate)})`
                      : "";
                  return (
                    <option key={p.Plan_MVP_name} value={p.Plan_MVP_name}>
                      {p.Plan_MVP_name}{range}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </div>
        {/* Error banner with timeout */}
        {msg?.text && (
          <div className="mt-4 mb-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
            {msg.text}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3">
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
