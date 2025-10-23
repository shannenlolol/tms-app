import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
// API for the `application` table – implement these in ../api/applications
import { getApplications, createApplication, updateApplication } from "../api/applications";

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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseLocalDate(s) {
  return s || ""; // keep as yyyy-mm-dd string in state/payload
}

// normalise shapes for “is dirty?”
const normAppShape = (a) => ({
  App_Acronym: asStr(a.App_Acronym).trim(),
  App_Description: asStr(a.App_Description),
  App_Rnumber: clampInt(a.App_Rnumber),
  App_startDate: asStr(a.App_startDate),
  App_endDate: asStr(a.App_endDate),
});
const isSameApp = (a, b) => {
  if (!a || !b) return false;
  const A = normAppShape(a), B = normAppShape(b);
  return JSON.stringify(A) === JSON.stringify(B);
};

export default function Home() {
  const { ready, isAuthenticated } = useAuth();

  const emptyNew = useMemo(
    () => ({
      App_Acronym: "",
      App_Description: "",
      App_Rnumber: 0,
      App_startDate: "",
      App_endDate: "",
    }),
    []
  );

  const [rows, setRows] = useState([]);
  const [origByKey, setOrigByKey] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // Inline row banners
  const [rowErrors, setRowErrors] = useState({}); // { [App_Acronym]: "message" }
  const [newError, setNewError] = useState("");

  const [newApp, setNewApp] = useState(emptyNew);

  function showRowError(acr, message) {
    setRowErrors((prev) => ({ ...prev, [acr]: message }));
    setTimeout(() => {
      setRowErrors((prev) => {
        if (prev[acr] !== message) return prev;
        const copy = { ...prev };
        delete copy[acr];
        return copy;
      });
    }, 5000);
  }
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
        const apps = await getApplications();
        const mapped = sortByAcronymAsc(apps).map((a) => ({
          ...a,
          App_Rnumber: clampInt(a.App_Rnumber),
          App_startDate: asStr(a.App_startDate),
          App_endDate: asStr(a.App_endDate),
        }));
        setRows(mapped);
        setOrigByKey(new Map(mapped.map((a) => [asStr(a.App_Acronym), normAppShape(a)])));
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  const isRowDirty = (row) => {
    const key = asStr(row.App_Acronym);
    const orig = origByKey.get(key);
    if (!orig) return false;
    return !isSameApp(row, orig);
  };

  const changeRow = (acr, key, value) =>
    setRows((rs) => rs.map((r) => (asStr(r.App_Acronym) === acr ? { ...r, [key]: value } : r)));

  const changeNew = (key, value) => setNewApp((prev) => ({ ...prev, [key]: value }));

  const reload = async () => {
    try {
      setLoading(true);
      const apps = await getApplications();
      const mapped = sortByAcronymAsc(apps).map((a) => ({
        ...a,
        App_Rnumber: clampInt(a.App_Rnumber),
        App_startDate: asStr(a.App_startDate),
        App_endDate: asStr(a.App_endDate),
      }));
      setRows(mapped);
      setOrigByKey(new Map(mapped.map((a) => [asStr(a.App_Acronym), normAppShape(a)])));
      setRowErrors({});
      setNewError("");
    } finally {
      setLoading(false);
    }
  };

  // validations
  function validateAppShape(a) {
    const acr = asStr(a.App_Acronym).trim();
    if (!acr) return "App Acronym is required.";
    const sd = asStr(a.App_startDate);
    const ed = asStr(a.App_endDate);
    if (sd && ed && new Date(ed) < new Date(sd)) return "End date cannot be before start date.";
    if (String(a.App_Rnumber) !== "" && !Number.isFinite(Number(a.App_Rnumber)))
      return "Rnumber must be a number.";
    return "";
  }

  const saveRow = async (row) => {
    const err = validateAppShape(row);
    if (err) return showRowError(asStr(row.App_Acronym), err);

    try {
      const payload = {
        ...row,
        App_Rnumber: clampInt(row.App_Rnumber),
      };
      const updated = await updateApplication(asStr(row.App_Acronym), payload);

      const safe = {
        ...row,
        ...updated,
        App_Rnumber: clampInt(updated?.App_Rnumber ?? row.App_Rnumber),
        App_startDate: asStr(updated?.App_startDate ?? row.App_startDate),
        App_endDate: asStr(updated?.App_endDate ?? row.App_endDate),
      };

      setRows((rs) =>
        rs.map((r) => (asStr(r.App_Acronym) === asStr(row.App_Acronym) ? safe : r))
      );
      setOrigByKey((m) => {
        const copy = new Map(m);
        copy.set(asStr(row.App_Acronym), normAppShape(safe));
        return copy;
      });

      // clear row error if any
      setRowErrors((prev) => {
        if (!prev[asStr(row.App_Acronym)]) return prev;
        const c = { ...prev };
        delete c[asStr(row.App_Acronym)];
        return c;
      });
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string"
          ? e.response.data
          : e?.response?.data?.message) ||
        e?.message ||
        "Update failed";
      showRowError(asStr(row.App_Acronym), m);
    }
  };

  const createNew = async () => {
    const err = validateAppShape(newApp);
    if (err) return showNewError(err);

    try {
      const created = await createApplication({
        ...newApp,
        App_Rnumber: clampInt(newApp.App_Rnumber),
      });

      const mapped = {
        ...created,
        App_Rnumber: clampInt(created.App_Rnumber),
        App_startDate: asStr(created.App_startDate),
        App_endDate: asStr(created.App_endDate),
      };
      setRows((rs) => sortByAcronymAsc([...rs, mapped]));
      setOrigByKey((m) => {
        const copy = new Map(m);
        copy.set(asStr(mapped.App_Acronym), normAppShape(mapped));
        return copy;
      });
      setNewApp(emptyNew);
      setNewError("");
    } catch (e) {
      const m =
        (typeof e?.response?.data === "string"
          ? e.response.data
          : e?.response?.data?.message) ||
        e?.message ||
        "Create failed";
      showNewError(m);
    }
  };

  return (
    <div className="p-4 pb-60">
      <p className="text-xl px-4 mb-6"><b>Applications</b></p>
    </div>
  );
}


//   return (
//     <div className="p-4 pb-60">
//       <p className="text-xl px-4 mb-6"><b>Applications</b></p>

//       <div className="relative shadow-md sm:rounded-lg overflow-visible lg:overflow-visible">
//         <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
//           <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
//             <tr>
//               <th className="px-6 py-3">Rnumber</th>
//               <th className="px-6 py-3">Acronym</th>
//               <th className="px-6 py-3">Description</th>
//               <th className="px-6 py-3">Start Date</th>
//               <th className="px-6 py-3">End Date</th>
//               <th className="px-6 py-3"></th>
//             </tr>
//           </thead>

//           <tbody>
//             {/* Add-new row */}
//             <tr className="bg-indigo-50 dark:bg-gray-900 border-b dark:border-gray-700 border-gray-200">
//               <td className="px-6 py-3">
//                 <div className="w-16 text-gray-500 italic select-none">-</div>
//               </td>
//               <td className="px-6 py-3">
//                 <input
//                   className="w-44 rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
//                   value={newApp.App_Acronym}
//                   onChange={(e) => changeNew("App_Acronym", e.target.value)}
//                   placeholder="e.g. TMS"
//                   autoComplete="off"
//                 />
//               </td>

//               <td className="px-6 py-3">
//                 <textarea
//                   className="w-72 rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
//                   value={newApp.App_Description}
//                   onChange={(e) => changeNew("App_Description", e.target.value)}
//                   rows={2}
//                 />
//               </td>


//               <td className="px-6 py-3">
//                 <input
//                   type="date"
//                   className="w-40 rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
//                   value={fmtLocalDate(newApp.App_startDate)}
//                   onChange={(e) => changeNew("App_startDate", parseLocalDate(e.target.value))}
//                   autoComplete="off"
//                 />
//               </td>

//               <td className="px-6 py-3">
//                 <input
//                   type="date"
//                   className="w-40 rounded-md border border-gray-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
//                   value={fmtLocalDate(newApp.App_endDate)}
//                   onChange={(e) => changeNew("App_endDate", parseLocalDate(e.target.value))}
//                   autoComplete="off"
//                 />
//               </td>

//               <td className="px-6 py-3">
//                 <button
//                   onClick={createNew}
//                   className="w-24 h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center"
//                 >
//                   Add
//                 </button>
//               </td>
//             </tr>

//             {/* Add-new error banner */}
//             {newError && (
//               <tr>
//                 <td colSpan={6} className="px-6 pb-4">
//                   <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 text-[15px]">
//                     {newError}
//                   </div>
//                 </td>
//               </tr>
//             )}

//             {/* Existing rows */}
//             {loading ? (
//               <tr>
//                 <td className="px-6 py-4" colSpan={6}>Loading…</td>
//               </tr>
//             ) : (
//               rows.map((row) => (
//                 <React.Fragment key={asStr(row.App_Acronym)}>
//                   <tr className="bg-white border-b border-gray-200">
//                                   <td className="px-6 py-3">
//                 <div className="w-16 text-gray-500 italic select-none">{row.App_Rnumber}</div>
//               </td>
//                     <td className="px-6 py-3">
//                       <input
//                         className="w-44 rounded-md border border-gray-300 px-3 py-2 outline-none bg-white"
//                         value={row.App_Acronym}
//                         disabled
//                       />
//                     </td>

//                     <td className="px-6 py-3">
//                       <textarea
//                         className="w-72 rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
//                         value={row.App_Description}
//                         onChange={(e) =>
//                           changeRow(asStr(row.App_Acronym), "App_Description", e.target.value)
//                         }
//                         rows={2}
//                       />
//                     </td>

//                     <td className="px-6 py-3">
//                       <input
//                         type="date"
//                         className="w-40 rounded-md border border-gray-300 bg-white px-3 py-2 outline-none"
//                         value={fmtLocalDate(row.App_startDate)}
//                         onChange={(e) =>
//                           changeRow(asStr(row.App_Acronym), "App_startDate", parseLocalDate(e.target.value))
//                         }
//                       />
//                     </td>

//                     <td className="px-6 py-3">
//                       <input
//                         type="date"
//                         className="w-40 rounded-md border border-gray-300 bg-white px-3 py-2 outline-none"
//                         value={fmtLocalDate(row.App_endDate)}
//                         onChange={(e) =>
//                           changeRow(asStr(row.App_Acronym), "App_endDate", parseLocalDate(e.target.value))
//                         }
//                       />
//                     </td>

//                     <td className="px-6 py-3">
//                       <button
//                         onClick={() => saveRow(row)}
//                         disabled={!isRowDirty(row)}
//                         className="w-24 h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
//                       >
//                         Save
//                       </button>
//                     </td>
//                   </tr>

//                   {/* Row error */}
//                   {rowErrors[asStr(row.App_Acronym)] && (
//                     <tr>
//                       <td colSpan={6} className="px-6 pb-4">
//                         <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 text-[15px]">
//                           {rowErrors[asStr(row.App_Acronym)]}
//                         </div>
//                       </td>
//                     </tr>
//                   )}
//                 </React.Fragment>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }
