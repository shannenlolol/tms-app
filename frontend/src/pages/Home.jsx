// src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getApplications, createApplication } from "../api/applications";
import { getUserGroups } from "../api/groups";
import UserGroupPicker from "../components/UserGroupPicker";
// at the top
import TinyDatePicker from "../components/TinyDatePicker";

// ---- helpers ----
const asStr = (v) => (v == null ? "" : String(v));
const clampInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
const sortByAcronymAsc = (arr) =>
  [...arr].sort((a, b) =>
    asStr(a?.App_Acronym).localeCompare(asStr(b?.App_Acronym), undefined, { sensitivity: "base" })
  );

// date <-> input[type=date]
function fmtLocalDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function parseLocalDate(s) { return s || ""; }

// replace your date helpers
const pad2 = (n) => String(n).padStart(2, "0");

function fmtISODate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // yyyy-MM-dd
}

function fmtDisplayDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return "";
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; // dd-MM-yyyy
}

function GroupText({ value, className = "" }) {
  const groups = Array.isArray(value) ? value : csvToArr(value);
  if (!groups.length) return <span className="text-gray-400">—</span>;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {groups.map((g) => (
        <span
          key={g}
          className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs"
          title={g}
        >
          {g}
        </span>
      ))}
    </div>
  );
}

const csvToArr = (s) =>
  asStr(s)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/** Hide native dd/mm/yyyy ghost without CSS: becomes 'date' only when focused or has a value */
function DateInput({ value, onChange, className = "", ...props }) {
  const [focused, setFocused] = React.useState(false);
  const type = focused || value ? "date" : "text";
  const v = type === "date" ? fmtISODate(value) : fmtDisplayDate(value); // <= key line

  return (
    <input
      type={type}
      className={className}
      value={v}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)} // native date gives yyyy-MM-dd
      placeholder=""
      autoComplete="off"
      {...props}
    />
  );
}


export default function Home() {
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const emptyNew = useMemo(
    () => ({
      App_Acronym: "",
      App_Description: "",
      App_startDate: "",
      App_endDate: "",
      Permit_Create: [],   // NEW
      Permit_Open: [],
      Permit_ToDo: [],
      Permit_Doing: [],
      Permit_Done: [],
    }),
    []
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupOptions, setGroupOptions] = useState([]);

  const [newError, setNewError] = useState("");
  const [newApp, setNewApp] = useState(emptyNew);

  function showNewError(message) {
    setNewError(message);
    setTimeout(() => setNewError(""), 5000);
  }

  // initial load
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    (async () => {
      try {
        setLoading(true);
        const [apps, groups] = await Promise.all([
          getApplications(),
          getUserGroups().catch(() => []),
        ]);
        setGroupOptions(groups || []);
        const mapped = sortByAcronymAsc(apps).map((a) => ({
          ...a,
          App_startDate: asStr(a.App_startDate),
          App_endDate: asStr(a.App_endDate),
          App_taskCount: clampInt(a.App_taskCount),
        }));
        setRows(mapped);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  const changeNew = (key, value) => setNewApp((prev) => ({ ...prev, [key]: value }));

  function validateAppShape(a) {
    const acr = asStr(a.App_Acronym).trim();
    if (!acr) return "App Acronym is required.";
    const sd = asStr(a.App_startDate);
    const ed = asStr(a.App_endDate);
    if (sd && ed && new Date(ed) < new Date(sd)) return "End date cannot be before start date.";
    return "";
  }

  const createNew = async () => {
    const err = validateAppShape(newApp);
    if (err) return showNewError(err);
    try {
      const created = await createApplication({
        App_Acronym: newApp.App_Acronym,
        App_Description: newApp.App_Description,
        App_startDate: newApp.App_startDate,
        App_endDate: newApp.App_endDate,
        Permit_Create: newApp.Permit_Create,   // NEW
        Permit_Open: newApp.Permit_Open,
        Permit_ToDo: newApp.Permit_ToDo,
        Permit_Doing: newApp.Permit_Doing,
        Permit_Done: newApp.Permit_Done,
      });
      const mapped = {
        ...created,
        App_startDate: asStr(created.App_startDate),
        App_endDate: asStr(created.App_endDate),
        App_taskCount: clampInt(created.App_taskCount),
      };
      setRows((rs) => sortByAcronymAsc([...rs, mapped]));
      setNewApp(emptyNew);
      setNewError("");
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.message) ||
        e?.message || "Create failed";
      showNewError(m);
    }
  };

  const openKanban = (acronym) => {
    navigate(`/applications/${encodeURIComponent(acronym)}/kanban`);
  };

  return (
    <div className="p-4">
      <p className="text-xl px-2 mb-6"><b>Applications</b></p>

      <div className="relative shadow-md sm:rounded-lg overflow-visible lg:overflow-visible">
        <table className="table-fixed w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <colgroup>
            <col className="w-16" />   {/* Acronym */}
            <col className="w-28" />   {/* Description */}
            <col className="w-22" />   {/* Start Date */}
            <col className="w-22" />   {/* End Date */}
            <col className="w-26" />   {/* Create */}
            <col className="w-26" />   {/* Open */}
            <col className="w-26" />   {/* To Do */}
            <col className="w-26" />   {/* Doing */}
            <col className="w-26" />   {/* Done */}
            <col className="w-12" />   {/* Tasks */}
            <col className="w-12" />   {/* Action btn */}
          </colgroup>
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-2 py-3">Acronym</th>
              <th className="px-2 py-3">Description</th>
              <th className="px-2 py-3">Start Date</th>
              <th className="px-2 py-3">End Date</th>
              <th className="px-2 py-3">Create</th> {/* NEW */}
              <th className="px-2 py-3">Open</th>
              <th className="px-2 py-3">To Do</th>
              <th className="px-2 py-3">Doing</th>
              <th className="px-2 py-3">Done</th>
              <th className="py-3">Tasks</th>
              <th className="py-3"></th>
            </tr>
          </thead>

          <tbody>
            {/* Add-new row */}
            <tr className="bg-indigo-50 dark:bg-gray-900 border-b dark:border-gray-700 border-gray-200">
              <td className="px-1 py-3">
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                  value={newApp.App_Acronym}
                  onChange={(e) => changeNew("App_Acronym", e.target.value)}
                  autoComplete="off"
                />
              </td>
              <td className="px-1 py-3">
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                  value={newApp.App_Description}
                  onChange={(e) => changeNew("App_Description", e.target.value)}
                  rows={1}
                />
              </td>
              <td className="px-1 py-3">
                <TinyDatePicker
                  value={newApp.App_startDate}
                  onChange={(iso) => changeNew("App_startDate", iso)}
                // placeholder="Start"
                />
              </td>
              <td className="px-1 py-3">
                <TinyDatePicker
                  value={newApp.App_endDate}
                  onChange={(iso) => changeNew("App_endDate", iso)}
                // placeholder="End"
                />
              </td>


              <td className="px-1 py-3">
                <UserGroupPicker
                  value={newApp.Permit_Create}
                  onChange={(vals) => changeNew("Permit_Create", vals)}
                  options={groupOptions}
                />
              </td>
              <td className="px-1 py-3">
                <UserGroupPicker
                  value={newApp.Permit_Open}
                  onChange={(vals) => changeNew("Permit_Open", vals)}
                  options={groupOptions}
                />
              </td>
              <td className="px-1 py-3">
                <UserGroupPicker
                  value={newApp.Permit_ToDo}
                  onChange={(vals) => changeNew("Permit_ToDo", vals)}
                  options={groupOptions}
                />
              </td>
              <td className="px-1 py-3">
                <UserGroupPicker
                  value={newApp.Permit_Doing}
                  onChange={(vals) => changeNew("Permit_Doing", vals)}
                  options={groupOptions}
                />
              </td>
              <td className="px-1 py-3">
                <UserGroupPicker
                  value={newApp.Permit_Done}
                  onChange={(vals) => changeNew("Permit_Done", vals)}
                  options={groupOptions}
                />
              </td>

              <td className="px-1 py-3">
                <div className="w-full text-gray-500 italic select-none">0</div>
              </td>

              <td className="px-1 py-3">
                <button
                  onClick={createNew}
                  className="w-8 h-8  !p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center"
                  aria-label="Add application"
                  title="Add"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6"             // 24px icon
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </td>


            </tr>

            {/* Add-new error banner */}
            {newError && (
              <tr>
                <td colSpan={11} className="px-6 pb-4">
                  <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 text-[15px]">
                    {newError}
                  </div>
                </td>
              </tr>
            )}

            {/* Existing rows (READ-ONLY) */}
            {loading ? (
              <tr>
                <td className="px-6 py-4" colSpan={11}>Loading…</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={asStr(row.App_Acronym)} className="bg-white border-b border-gray-200">
                  <td className="px-1 py-3">
                    <div className="px-2 py-1">{row.App_Acronym}</div>
                  </td>

                  {/* read-only, resizable textarea */}
                  <td className="px-1 py-3">
                    <textarea
                      readOnly
                      className="w-full max-w-full min-w-full resize rounded-md border border-gray-300 px-2 py-1 bg-white"
                      defaultValue={row.App_Description || ""}
                    />
                  </td>

                  <td className="px-4 py-3">
                    {fmtLocalDate(row.App_startDate) || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {fmtLocalDate(row.App_endDate) || <span className="text-gray-400">—</span>}
                  </td>

                  <td className="px-1 py-3">
                    <GroupText value={row.Permit_Create} />
                  </td>
                  <td className="px-1 py-3">
                    <GroupText value={row.Permit_Open} />
                  </td>
                  <td className="px-1 py-3">
                    <GroupText value={row.Permit_ToDo} />
                  </td>
                  <td className="px-1 py-3">
                    <GroupText value={row.Permit_Doing} />
                  </td>
                  <td className="px-1 py-3">
                    <GroupText value={row.Permit_Done} />
                  </td>



                  <td className="px-1 py-3">
                    <div className="w-full">{row.App_taskCount ?? 0}</div>
                  </td>

                  <td className="px-1 py-3">
                    <button
                      onClick={() => openKanban(row.App_Acronym)}
                      className="w-8 h-8  !p-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center justify-center"
                      aria-label="Open Kanban"
                      title="Open Kanban"
                    >
                      {/* arrow-square-out icon (inline SVG, no deps) */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 3h7v7"></path>
                        <path d="M10 14L21 3"></path>
                        <path d="M21 14v7h-7"></path>
                        <path d="M3 10v11h11"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
