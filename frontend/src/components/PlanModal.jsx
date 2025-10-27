// src/components/PlanModal.jsx
import React, { useState } from "react";

export default function PlanModal({ open, onClose, onSubmit, error }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const disabled = !name.trim();

  const create = async () => {
    if (disabled) return;
    await onSubmit({
      Plan_MVP_name: name.trim(),
      Plan_startDate: start || null,
      Plan_endDate: end || null,
    });
    setName(""); setStart(""); setEnd("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[min(560px,95vw)] rounded-2xl bg-white shadow-2xl p-6">
        <h2 className="text-xl font-semibold mb-4">Create Plan</h2>

        <div className="space-y-3">
          <label className="block">
            <div className="text-sm mb-1">Plan Name</div>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm mb-1">Start Date</div>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="block">
              <div className="text-sm mb-1">End Date</div>
              <input
                type="date"
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
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
            onClick={create}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-white ${disabled ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
          >
            Create Plan
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
