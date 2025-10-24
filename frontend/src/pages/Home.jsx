import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getApplications, createApplication } from "../api/applications";

// ---- helpers ----
const asStr = (v) => (v == null ? "" : String(v));
const clampInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; // push non-numbers to the end
};
export const sortByRNumberAsc = (arr) =>
  [...arr].sort((a, b) => {
    const da = toNum(a?.App_Rnumber);
    const db = toNum(b?.App_Rnumber);
    if (da !== db) return da - db;
    return asStr(a?.App_Acronym).localeCompare(asStr(b?.App_Acronym), undefined, { sensitivity: "base" });
  });

// date <-> input[type=date]
function fmtLocalDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(+d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseLocalDate(s) {
  return s || "";
}

// normalise shapes for “is dirty?” (kept for add-new comparison and future use)
const normAppShape = (a) => ({
  App_Acronym: asStr(a.App_Acronym).trim(),
  App_Description: asStr(a.App_Description),
  App_Rnumber: clampInt(a.App_Rnumber),
  App_startDate: asStr(a.App_startDate),
  App_endDate: asStr(a.App_endDate),
});

export default function Home() {
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const emptyNew = useMemo(
    () => ({
      App_Acronym: "",
      App_Description: "",
      App_Rnumber: 0, // DB auto (id-like) — shown as "-"
      App_startDate: "",
      App_endDate: "",
    }),
    []
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inline banners for the "add new" row
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
        const apps = await getApplications();
        const mapped = sortByRNumberAsc(apps).map((a) => ({
          ...a,
          App_Rnumber: clampInt(a.App_Rnumber),
          App_startDate: asStr(a.App_startDate),
          App_endDate: asStr(a.App_endDate),
        }));
        setRows(mapped);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  const changeNew = (key, value) => setNewApp((prev) => ({ ...prev, [key]: value }));

  // validations (for add-new only)
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
      // Do NOT send App_Rnumber; backend/DB assigns it
      const created = await createApplication({
        App_Acronym: newApp.App_Acronym,
        App_Description: newApp.App_Description,
        App_startDate: newApp.App_startDate,
        App_endDate: newApp.App_endDate,
      });

      const mapped = {
        ...created,
        App_Rnumber: clampInt(created.App_Rnumber),
        App_startDate: asStr(created.App_startDate),
        App_endDate: asStr(created.App_endDate),
      };
      setRows((rs) => sortByRNumberAsc([...rs, mapped]));
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

  const openKanban = (acronym) => {
    navigate(`/applications/${encodeURIComponent(acronym)}/kanban`);
  };

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
//             {/* Add-new row (still allowed) */}
//             <tr className="bg-indigo-50 dark:bg-gray-900 border-b dark:border-gray-700 border-gray-200">
//               <td className="px-6 py-3">
//                 <div className="w-16 text-gray-500 italic select-none">-</div>
//               </td>
//               <td className="px-6 py-3">
//                 <input
//                   className="w-44 rounded-md border border-gray-300 px-3 py-2 outline-none bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
//                   value={newApp.App_Acronym}
//                   onChange={(e) => changeNew("App_Acronym", e.target.value)}
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

//             {/* Existing rows (READ-ONLY) */}
//             {loading ? (
//               <tr>
//                 <td className="px-6 py-4" colSpan={6}>Loading…</td>
//               </tr>
//             ) : (
//               rows.map((row) => (
//                 <tr key={asStr(row.App_Acronym)} className="bg-white border-b border-gray-200">
//                   <td className="px-6 py-3">
//                     <div className="w-16">{row.App_Rnumber ?? 0}</div>
//                   </td>
//                   <td className="px-6 py-3">
//                     <div className="px-2 py-1">{row.App_Acronym}</div>
//                   </td>
//                   <td className="px-6 py-3">
//                     <div className="max-w-prose">{row.App_Description || <span className="text-gray-400">—</span>}</div>
//                   </td>
//                   <td className="px-6 py-3">
//                     {fmtLocalDate(row.App_startDate) || <span className="text-gray-400">—</span>}
//                   </td>
//                   <td className="px-6 py-3">
//                     {fmtLocalDate(row.App_endDate) || <span className="text-gray-400">—</span>}
//                   </td>
//                   <td className="px-6 py-3">
//                     <button
//                       onClick={() => openKanban(row.App_Acronym)}
//                       className="w-24 h-10 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center justify-center"
//                     >
//                       Open
//                     </button>
//                   </td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }


  return (
    <div className="p-4 pb-60">
      <p className="text-xl px-4 mb-6"><b>Applications</b></p>
    </div>
  );
}

