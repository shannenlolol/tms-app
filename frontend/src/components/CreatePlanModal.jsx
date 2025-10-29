// src/components/CreatePlanModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function CreatePlanModal({
  open,
  onClose,
  onSubmit,
  error,
  apps = [],
}) {
  // --- local form state ---
  const [name, setName] = useState("");
  const [appAcr, setAppAcr] = useState("");
  const [start, setStart] = useState(""); // yyyy-MM-dd
  const [end, setEnd] = useState("");     // yyyy-MM-dd

  // --- banner message (auto-dismiss in 5s) ---
  const [msg, setMsg] = useState(null);
  const timerRef = useRef(null);

  // Convert parent error to a string (if any) and pipe it via `msg`
  const errorText =
    typeof error === "string"
      ? error
      : (error && (error.message || error.error || String(error))) || "";

  useEffect(() => {
    if (!errorText) return;
    setMsg(errorText);
  }, [errorText]);

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
  }, [msg]);

  // reset fields when modal closes
  useEffect(() => {
    if (!open) {
      setName("");
      setAppAcr("");
      setStart("");
      setEnd("");
      setMsg(null);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmt = (d) => {
    if (!d) return "";
    const x = new Date(d);
    if (Number.isNaN(+x)) return String(d);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${x.getDate()} ${months[x.getMonth()]} ${x.getFullYear()}`;
  };

  const appLabel = (a) => {
    const s = fmt(a.App_startDate);
    const e = fmt(a.App_endDate);
    const range = (s || e) ? ` (${s || "?"} - ${e || "?"})` : "";
    return `${a.App_Acronym}${range}`;
  };

  // derived: valid date order
  const datesValid = useMemo(() => {
    if (!start || !end) return true; // allow open-ended
    return new Date(end) >= new Date(start);
  }, [start, end]);

  // derived: disable create
  const disabled = !name.trim() || !appAcr || !datesValid;

  const validateNow = () => {
    if (!name.trim()) return "Plan name is required.";
    if (!appAcr) return "Please select an application.";
    if (!datesValid) return "End Date cannot be earlier than Start Date.";
    return "";
  };

  const create = async () => {
    const v = validateNow();
    if (v) { setMsg(v); return; }
    // Let parent handle API errors; they’ll arrive via `error` -> `msg` and auto-dismiss.
    await onSubmit?.({
      Plan_MVP_name: name.trim(),
      Plan_startDate: start || null,
      Plan_endDate: end || null,
      Plan_app_Acronym: appAcr,
    });
  };

  // Clear banner as the user edits (nice UX; still auto-dismisses if left alone)
  const clearAnd = (fn) => (e) => {
    if (msg) setMsg(null);
    fn(e);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-10 w-[min(560px,95vw)] rounded-2xl bg-white shadow-2xl p-6"
        role="dialog" aria-modal="true" aria-labelledby="create-plan-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-plan-title" className="text-xl font-semibold">Create Plan</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-gray rounded-md bg-gray-200 px-3 py-1.5 text-gray-900 hover:bg-gray-300"
          >
            X
          </button>
        </div>



        <div className="space-y-3">
          <label className="block">
            <div className="mb-1 text-sm">Plan Name</div>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
              value={name}
              onChange={clearAnd((e) => setName(e.target.value))}
              autoComplete="off"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm">Application</div>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-indigo-400"
              value={appAcr}
              onChange={clearAnd((e) => setAppAcr(e.target.value))}
            >
              <option value="">Select an application…</option>
              {apps.map((a) => (
                <option key={a.App_Acronym} value={a.App_Acronym}>
                  {appLabel(a)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-sm">Start Date</div>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={start}
                onChange={clearAnd((e) => setStart(e.target.value))}
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm">End Date</div>
              <input
                type="date"
                className={`w-full rounded-md border px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 ${
                  (!datesValid && end) ? "border-rose-400" : "border-gray-300"
                }`}
                value={end}
                onChange={clearAnd((e) => setEnd(e.target.value))}
              />
            </label>
          </div>
        </div>
        {msg && (
          <div
            className="mt-4 mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert" aria-live="polite"
          >
            {msg}
          </div>
        )}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={create}
            disabled={disabled}
            className={`rounded-lg px-4 py-2 text-white ${
              disabled ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            Create Plan
          </button>
        </div>
      </div>
    </div>
  );
}
