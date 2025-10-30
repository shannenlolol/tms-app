// src/pages/Applications.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getApplications, createApplication, updateApplication } from "../api/applications"; // <= added update
import { getUserGroups } from "../api/groups";
import UserGroupPicker from "../components/UserGroupPicker";
import TinyDatePicker from "../components/TinyDatePicker";
import { checkGroup } from "../api/users";

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

function useIsProjectLead(user) {
  const [state, setState] = useState({ loading: true, isProjectLead: false });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const username = String(user?.username || "").trim();
        if (!username) {
          if (!cancelled) setState({ loading: false, isProjectLead: false });
          return;
        }
        const isPL = await checkGroup(username, "project lead");
        if (!cancelled) setState({ loading: false, isProjectLead: !!isPL });
      } finally {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.username]);
  return state; // { loading, isProjectLead }
}

// date helpers (unchanged)
const pad2 = (n) => String(n).padStart(2, "0");
function fmtLocalDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function fmtISODate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDisplayDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return "";
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

const csvToArr = (s) =>
  asStr(s)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

function GroupText({ value, className = "" }) {
  const groups = Array.isArray(value) ? value : csvToArr(value);
  if (!groups.length) return <span className="text-gray-400">—</span>;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {groups.map((g) => (
        <span key={g} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs" title={g}>
          {g}
        </span>
      ))}
    </div>
  );
}

/** Hide native dd/mm/yyyy ghost without CSS */
function DateInput({ value, onChange, className = "", ...props }) {
  const [focused, setFocused] = React.useState(false);
  const type = focused || value ? "date" : "text";
  const v = type === "date" ? fmtISODate(value) : fmtDisplayDate(value);
  return (
    <input
      type={type}
      className={className}
      value={v}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
      placeholder=""
      autoComplete="off"
      {...props}
    />
  );
}
const toArr = (v) => (Array.isArray(v) ? v : csvToArr(v));
const normLowerSorted = (arr) =>
  toArr(arr).map((s) => String(s).trim().toLowerCase()).filter(Boolean).sort();

const sameArr = (a, b) => {
  const A = normLowerSorted(a);
  const B = normLowerSorted(b);
  return A.length === B.length && A.every((x, i) => x === B[i]);
};

const makeDraftFromRow = (row) => ({
  App_Description: row.App_Description || "",
  App_startDate: row.App_startDate || "",
  App_endDate: row.App_endDate || "",
  Permit_Create: toArr(row.Permit_Create),
  Permit_Open: toArr(row.Permit_Open),
  Permit_ToDo: toArr(row.Permit_ToDo),
  Permit_Doing: toArr(row.Permit_Doing),
  Permit_Done: toArr(row.Permit_Done),
});

const isRowDirty = (row, draft) => {
  if (!draft) return false;
  return (
    asStr(row.App_Description) !== asStr(draft.App_Description) ||
    asStr(row.App_startDate || "") !== asStr(draft.App_startDate || "") ||
    asStr(row.App_endDate || "") !== asStr(draft.App_endDate || "") ||
    !sameArr(row.Permit_Create, draft.Permit_Create) ||
    !sameArr(row.Permit_Open, draft.Permit_Open) ||
    !sameArr(row.Permit_ToDo, draft.Permit_ToDo) ||
    !sameArr(row.Permit_Doing, draft.Permit_Doing) ||
    !sameArr(row.Permit_Done, draft.Permit_Done)
  );
};
export default function Applications() {
  const { ready, isAuthenticated, user } = useAuth();
  const { loading: roleLoading, isProjectLead } = useIsProjectLead(user);
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState({});        // { [acronym]: draft }
  const [saving, setSaving] = useState({});        // { [acronym]: boolean }
  const emptyNew = useMemo(
    () => ({
      App_Acronym: "",
      App_Description: "",
      App_startDate: "",
      App_endDate: "",
      Permit_Create: [],
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

  // NEW: editing state
  const [editKey, setEditKey] = useState("");           // App_Acronym being edited
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState(null);       // shape mirrors row but WITHOUT acronym/task count

  function showNewError(message) {
    setNewError(message);
    setTimeout(() => setNewError(""), 5000);
  }
  function showEditError(message) {
    setEditError(message);
    setTimeout(() => setEditError(""), 5000);
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
  useEffect(() => {
    if (!loading && rows.length) {
      setDrafts(Object.fromEntries(rows.map((r) => [r.App_Acronym, makeDraftFromRow(r)])));
    }
  }, [loading, rows]);

  function showEditError(message) {
    setEditError(message);
    setTimeout(() => setEditError(""), 5000);
  }

  function validateDraft(d) {
    const sd = asStr(d.App_startDate);
    const ed = asStr(d.App_endDate);
    if (sd && ed && new Date(ed) < new Date(sd)) return "End date cannot be before start date.";
    return "";
  }

  async function saveRow(acronym) {
    const draft = drafts[acronym];
    const err = validateDraft(draft);
    if (err) return showEditError(err);

    setSaving((s) => ({ ...s, [acronym]: true }));
    try {
      const payload = {
        App_Description: draft.App_Description,
        App_startDate: draft.App_startDate,
        App_endDate: draft.App_endDate,
        Permit_Create: draft.Permit_Create,
        Permit_Open: draft.Permit_Open,
        Permit_ToDo: draft.Permit_ToDo,
        Permit_Doing: draft.Permit_Doing,
        Permit_Done: draft.Permit_Done,
      };
      const updated = await updateApplication(acronym, payload);
      const mapped = {
        ...updated,
        App_startDate: asStr(updated.App_startDate),
        App_endDate: asStr(updated.App_endDate),
        App_taskCount: clampInt(updated.App_taskCount),
      };
      // update rows
      setRows((rs) => sortByAcronymAsc(rs.map((r) => (r.App_Acronym === acronym ? mapped : r))));
      // refresh draft from latest
      setDrafts((ds) => ({ ...ds, [acronym]: makeDraftFromRow(mapped) }));
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.message) ||
        e?.message || "Update failed";
      showEditError(m);
    } finally {
      setSaving((s) => ({ ...s, [acronym]: false }));
    }
  }
  const changeNew = (key, value) => setNewApp((prev) => ({ ...prev, [key]: value }));

  function validateAppShapeLikeCreate(a) {
    const sd = asStr(a.App_startDate);
    const ed = asStr(a.App_endDate);
    if (sd && ed && new Date(ed) < new Date(sd)) return "End date cannot be before start date.";
    return "";
  }

  const createNew = async () => {
    if (!isProjectLead) {
      return showNewError("Only Project Lead can create applications.");
    }
    const err = validateAppShapeLikeCreate(newApp);
    if (err) return showNewError(err);
    try {
      const created = await createApplication({
        App_Acronym: newApp.App_Acronym,
        App_Description: newApp.App_Description,
        App_startDate: newApp.App_startDate,
        App_endDate: newApp.App_endDate,
        Permit_Create: newApp.Permit_Create,
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
      setDrafts((ds) => ({ ...ds, [mapped.App_Acronym]: makeDraftFromRow(mapped) }));

      setNewApp(emptyNew);
      setNewError("");
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.message) ||
        e?.message || "Create failed";
      showNewError(m);
    }
  };

  // ----- EDITING -----
  function startEdit(row) {
    // only Project Lead can edit apps (mirror create restriction; tweak if different)
    if (!isProjectLead) return;
    setEditKey(row.App_Acronym);
    setEditForm({
      App_Description: row.App_Description || "",
      App_startDate: row.App_startDate || "",
      App_endDate: row.App_endDate || "",
      // allow updating permits too
      Permit_Create: Array.isArray(row.Permit_Create) ? row.Permit_Create : csvToArr(row.Permit_Create),
      Permit_Open: Array.isArray(row.Permit_Open) ? row.Permit_Open : csvToArr(row.Permit_Open),
      Permit_ToDo: Array.isArray(row.Permit_ToDo) ? row.Permit_ToDo : csvToArr(row.Permit_ToDo),
      Permit_Doing: Array.isArray(row.Permit_Doing) ? row.Permit_Doing : csvToArr(row.Permit_Doing),
      Permit_Done: Array.isArray(row.Permit_Done) ? row.Permit_Done : csvToArr(row.Permit_Done),
    });
  }
  function cancelEdit() {
    setEditKey("");
    setEditForm(null);
    setEditError("");
  }
  async function saveEdit(acronym) {
    const err = validateAppShapeLikeCreate(editForm || {});
    if (err) return showEditError(err);
    try {
      const payload = {
        App_Description: editForm.App_Description,
        App_startDate: editForm.App_startDate,
        App_endDate: editForm.App_endDate,
        // include permits so the server can update them
        Permit_Create: editForm.Permit_Create,
        Permit_Open: editForm.Permit_Open,
        Permit_ToDo: editForm.Permit_ToDo,
        Permit_Doing: editForm.Permit_Doing,
        Permit_Done: editForm.Permit_Done,
      };
      const updated = await updateApplication(acronym, payload);
      const mapped = {
        ...updated,
        App_startDate: asStr(updated.App_startDate),
        App_endDate: asStr(updated.App_endDate),
        App_taskCount: clampInt(updated.App_taskCount),
      };
      setRows((rs) => sortByAcronymAsc(rs.map((r) => (r.App_Acronym === acronym ? mapped : r))));
      cancelEdit();
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.message) ||
        e?.message || "Update failed";
      showEditError(m);
    }
  }

  return (
    <div className="p-4">
      <p className="text-xl px-2 mb-6"><b>Applications</b></p>

      <div className="relative shadow-md sm:rounded-lg overflow-visible lg:overflow-visible">
        <table className="table-fixed w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <colgroup>
            <col className="w-16" />
            <col className="w-28" />
            <col className="w-22" />
            <col className="w-22" />
            <col className="w-26" />
            <col className="w-26" />
            <col className="w-26" />
            <col className="w-26" />
            <col className="w-26" />
            <col className="w-12" />
            <col className="w-12" />
          </colgroup>
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-2 py-3">Acronym</th>
              <th className="px-2 py-3">Description</th>
              <th className="px-2 py-3">Start Date</th>
              <th className="px-2 py-3">End Date</th>
              <th className="px-2 py-3">Create</th>
              <th className="px-2 py-3">Open</th>
              <th className="px-2 py-3">To Do</th>
              <th className="px-2 py-3">Doing</th>
              <th className="px-2 py-3">Done</th>
              <th className="py-3">Tasks</th>
              <th className="py-3"></th>
            </tr>
          </thead>

          <tbody>
            {/* Add-new row: only for Project Lead */}
            {isProjectLead && (
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
                  />
                </td>
                <td className="px-1 py-3">
                  <TinyDatePicker
                    value={newApp.App_endDate}
                    onChange={(iso) => changeNew("App_endDate", iso)}
                  />
                </td>
                <td className="px-1 py-3">
                  <UserGroupPicker value={newApp.Permit_Create} onChange={(v) => changeNew("Permit_Create", v)} options={groupOptions} />
                </td>
                <td className="px-1 py-3">
                  <UserGroupPicker value={newApp.Permit_Open} onChange={(v) => changeNew("Permit_Open", v)} options={groupOptions} />
                </td>
                <td className="px-1 py-3">
                  <UserGroupPicker value={newApp.Permit_ToDo} onChange={(v) => changeNew("Permit_ToDo", v)} options={groupOptions} />
                </td>
                <td className="px-1 py-3">
                  <UserGroupPicker value={newApp.Permit_Doing} onChange={(v) => changeNew("Permit_Doing", v)} options={groupOptions} />
                </td>
                <td className="px-1 py-3">
                  <UserGroupPicker value={newApp.Permit_Done} onChange={(v) => changeNew("Permit_Done", v)} options={groupOptions} />
                </td>
                <td className="px-1 py-3">
                  <div className="w-full text-gray-500 italic select-none">0</div>
                </td>
                <td className="px-1 py-3">
                  <button
                    onClick={createNew}
                    className="w-8 h-8 !p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center"
                    aria-label="Add application"
                    title="Add"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14" /><path d="M5 12h14" />
                    </svg>
                  </button>
                </td>
              </tr>
            )}

            {newError && (
              <tr>
                <td colSpan={11} className="px-6 pb-4">
                  <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 text-[15px]">
                    {newError}
                  </div>
                </td>
              </tr>
            )}
            {editError && (
              <tr>
                <td colSpan={11} className="px-6 pb-4">
                  <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 text-[15px]">
                    {editError}
                  </div>
                </td>
              </tr>
            )}

            {/* Existing rows (always editable except Acronym & Tasks) */}
            {loading ? (
              <tr>
                <td className="px-6 py-4" colSpan={11}>Loading…</td>
              </tr>
            ) : (
              rows.map((row) => {
                const acr = row.App_Acronym;
                const d = drafts[acr] || makeDraftFromRow(row);
                const dirty = isRowDirty(row, d);
                const savingRow = !!saving[acr];

                return (
                  <tr key={asStr(acr)} className="bg-white border-b border-gray-200">
                    {/* Acronym: read-only */}
                    <td className="px-1 py-3">
                      <div className="px-2 py-1 font-medium">{acr}</div>
                    </td>

                    {/* Description: editable */}
                    <td className="px-1 py-3">
                      <textarea
                        className="w-full max-w-full min-w-full resize rounded-md border border-gray-300 px-2 py-1 bg-white"
                        rows={1}
                        value={d.App_Description}
                        onChange={(e) =>
                          setDrafts((ds) => ({ ...ds, [acr]: { ...d, App_Description: e.target.value } }))
                        }
                      />
                    </td>

                    {/* Dates: editable */}
                    <td className="px-4 py-3">
                      <TinyDatePicker
                        value={d.App_startDate}
                        onChange={(iso) => setDrafts((ds) => ({ ...ds, [acr]: { ...d, App_startDate: iso } }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <TinyDatePicker
                        value={d.App_endDate}
                        onChange={(iso) => setDrafts((ds) => ({ ...ds, [acr]: { ...d, App_endDate: iso } }))}
                      />
                    </td>

                    {/* Permits: editable */}
                    <td className="px-1 py-3">
                      <UserGroupPicker
                        value={d.Permit_Create}
                        onChange={(vals) => setDrafts((ds) => ({ ...ds, [acr]: { ...d, Permit_Create: vals } }))}
                        options={groupOptions}
                      />
                    </td>
                    <td className="px-1 py-3">
                      <UserGroupPicker
                        value={d.Permit_Open}
                        onChange={(vals) => setDrafts((ds) => ({ ...ds, [acr]: { ...d, Permit_Open: vals } }))}
                        options={groupOptions}
                      />
                    </td>
                    <td className="px-1 py-3">
                      <UserGroupPicker
                        value={d.Permit_ToDo}
                        onChange={(vals) => setDrafts((ds) => ({ ...ds, [acr]: { ...d, Permit_ToDo: vals } }))}
                        options={groupOptions}
                      />
                    </td>
                    <td className="px-1 py-3">
                      <UserGroupPicker
                        value={d.Permit_Doing}
                        onChange={(vals) => setDrafts((ds) => ({ ...ds, [acr]: { ...d, Permit_Doing: vals } }))}
                        options={groupOptions}
                      />
                    </td>
                    <td className="px-1 py-3">
                      <UserGroupPicker
                        value={d.Permit_Done}
                        onChange={(vals) => setDrafts((ds) => ({ ...ds, [acr]: { ...d, Permit_Done: vals } }))}
                        options={groupOptions}
                      />
                    </td>

                    {/* Tasks: read-only */}
                    <td className="px-1 py-3">
                      <div className="w-full">{row.App_taskCount ?? 0}</div>
                    </td>

                    {/* Single Save button (enabled only if dirty & PL) */}
                    <td className="px-1 py-3">
                      <button
                        onClick={() => saveRow(acr)}
                        disabled={!dirty || !isProjectLead || savingRow}
                        className={`w-8 h-8 !p-2 rounded-md inline-flex items-center justify-center ${dirty && isProjectLead && !savingRow
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                          }`}
                        aria-label="Save"
                        title={
                          !isProjectLead
                            ? "Only Project Lead can save"
                            : dirty
                              ? "Save"
                              : "No changes"
                        }
                      >
                        {/* check icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
