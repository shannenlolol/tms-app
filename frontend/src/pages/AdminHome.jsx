import { useEffect, useMemo, useState } from "react";
import { getUsers, createUser, updateUser, toggleActive } from "../api/users";
import { getUserGroups, createUserGroup } from "../api/groups";
import { useAuth } from "../hooks/useAuth";

// Helper to sort rows
const sortByIdAsc = (arr) =>
  [...arr].sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));

// same rule as backend
const pwdValid = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

// email regex check
const re =
  /^(?!.*\.\.)[A-Za-z0-9_%+-](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])?@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/i;

const emailValid = (s) => typeof s === "string" && re.test(s);



/** Small pill/tag component */
function GroupTag({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 rounded-full px-1 hover:bg-blue-200"
          aria-label="Remove group"
          title="Remove group"
        >
          ×
        </button>
      )}
    </span>
  );
}


/** Dropdown multi-select with checkbox list + removable tags in the control */
function UserGroupPicker({ value = [], onChange, options, placeholder = "Select" }) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  // Close when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!anchorEl) return;
      if (!anchorEl.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [anchorEl]);

  const toggle = (name) => {
    if (value.includes(name)) {
      onChange(value.filter((v) => v !== name));
    } else {
      onChange([...value, name]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className="relative" ref={setAnchorEl}>
      {/* Control */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[34px] rounded-md border bg-white dark:bg-gray-900 px-2 py-1 text-left focus:outline-none focus:ring flex items-center gap-2 flex-wrap"
      >
        {value.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          <>
            {value.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs"
              >
                {name}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter((v) => v !== name));
                  }}
                  className="cursor-pointer rounded-full px-1 hover:bg-blue-200"
                  aria-label={`Remove ${name}`}
                  title={`Remove ${name}`}
                >
                  ×
                </span>
              </span>
            ))}
          </>
        )}
        <span className="ml-auto text-gray-400">▾</span>
      </button>

      {/* Menu */}
      {open && (
        <div className="absolute z-20 mt-1 w-[18rem] max-w-[80vw] rounded-md border bg-white dark:bg-gray-900 shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {options.map((name) => {
              const checked = value.includes(name);
              return (
                <li key={name}>
                  <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={checked}
                      onChange={() => toggle(name)}
                    />
                    <span className="text-sm">{name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}


export default function AdminHome() {
  const { ready, isAuthenticated } = useAuth();
  const [rows, setRows] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]); // ["Admin","Dev Team",...]
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [successmsg, setSuccessMsg] = useState("");

  useEffect(() => {
  if (!msg) return;
  const t = setTimeout(() => setMsg(""), 5000);
  return () => clearTimeout(t); // cleanup if msg changes/unmounts
}, [msg]);

useEffect(() => {
  if (!successmsg) return;
  const t = setTimeout(() => setSuccessMsg(""), 5000);
  return () => clearTimeout(t);
}, [successmsg]);


  // edit state
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  // inline new row state (always rendered as first row)
  const emptyNew = useMemo(
    () => ({
      username: "",
      email: "",
      password: "",
      usergroup: [],
      active: true,
    }),
    []
  );
  const [newUser, setNewUser] = useState(emptyNew);

  useEffect(() => {
    if (!ready || !isAuthenticated) return; // wait for JWT
    (async () => {
      try {
        setLoading(true);
        const [users, groups] = await Promise.all([getUsers(), getUserGroups()]);
        setRows(sortByIdAsc(users));
        setGroupOptions(groups);
      } catch (e) {
        setMsg(e?.response?.data?.message || e.message || "Failed to load users");
     } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft({
      ...row,
      usergroup: Array.isArray(row.usergroup)
        ? row.usergroup
        : String(row.usergroup || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
      password: "", // optional; only send if provided
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateDraft = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const updateNew = (key, value) => setNewUser((u) => ({ ...u, [key]: value }));

const saveEdit = async () => {
  if (!draft) return;

  const payload = {
    username: draft.username,
    usergroup: draft.usergroup,
    active: !!draft.active,
  };

  if (draft.email) {
    const email = draft.email.trim().toLowerCase();
    if (!emailValid(email)) {
      setMsg("Email must be valid.");
      return;
    }
    payload.email = email;
  }
  if (draft.password) {
    if (!pwdValid(draft.password)) {
      setMsg("Password must be 8–10 chars, include letters, numbers, and a special character.");
      return;
    }
    payload.password = draft.password;
  }

  try {
    const apiRes = await updateUser(draft.id, payload);

    // Prefer object returned by API; else merge local payload into existing row
    setRows((rs) =>
      rs.map((r) =>
        r.id === draft.id
          ? (apiRes && apiRes.id ? apiRes : { ...r, ...payload, password: undefined })
          : r
      )
    );

    cancelEdit();
  } catch (e) {
  // SEE the exact backend reason in the console
  console.error(
    "Admin update failed:",
    e?.response?.status,
    e?.response?.data
  );

  // Show a friendly message in UI
  const msg =
    (typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.message) ||
    e.message ||
    "Update failed";
  setMsg(msg);
}
};


  const onToggleActive = async (row, next) => {
    try {
      const updated = await toggleActive(row.id, next);
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setMsg(e.message || "Failed to toggle active");
    }
  };

  const onCreate = async () => {
    setMsg("");
    if (!newUser.username || !newUser.email || !newUser.password) {
      setMsg("Field(s) cannot be empty.");
      return;
    }
    if (!emailValid(newUser.email)) {
      setMsg("Email must be valid.");
      return;
    }
    if (!pwdValid(newUser.password)) {
      setMsg(
        "Password must be 8–10 chars, include letters, numbers, and a special character."
      );
      return;
    }
    try {
      const created = await createUser({
        ...newUser,
        active: !!newUser.active,
      });
      // append the created row
      setRows((rs) => sortByIdAsc([...rs, created])); // keep ascending order

      // reset the inline new row
      setNewUser(emptyNew);
    } catch (e) {
      setMsg(e.message || "Create failed");
    }
  };

const onAddUserGroup = async () => {
  const name = (prompt("Enter new user group name:") || "").trim();
  if (!name) return;

  // Prevent dupes (case-insensitive)
  const exists = groupOptions.some((g) => g.toLowerCase() === name.toLowerCase());
  if (exists) {
    setMsg("That user group already exists.");
    return;
  }

  try {
    const createdName = await createUserGroup(name);
    setGroupOptions((opts) =>
      [...opts, createdName].sort((a, b) => a.localeCompare(b))
    );
    setSuccessMsg(`“${createdName}” added.`);
  } catch (e) {
    setMsg(e.message || "Failed to add user group");
  }
};

  return (
    <div className="p-4">
      {msg && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          {msg}
        </div>
      )}
      {successmsg && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-700">
          {successmsg}
        </div>
      )}

      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">Username</th>
                  <th className="px-6 py-3">
      <div className="flex items-center gap-2">
        <span>User Group</span>
        <button
          type="button"
          onClick={onAddUserGroup}
          className="rounded-md bg-blue-600 text-white px-2 py-1 text-[11px] hover:bg-blue-700"
          title="Create a new user group"
        >
          + New
        </button>
      </div>
    </th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Password</th>
              <th className="px-6 py-3">Active</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>

          <tbody>
            {/* Inline create row (always first) */}
            <tr className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 border-gray-200">
              <td className="px-6 py-3 text-gray-400">—</td>

              <td className="px-6 py-3">
                <input
                  className="w-full rounded-md border px-2 py-1 outline-none bg-white dark:bg-gray-900"
                  value={newUser.username}
                  onChange={(e) => updateNew("username", e.target.value)}
                />
              </td>

              <td className="px-6 py-3">
                <UserGroupPicker
                  value={newUser.usergroup}
                  onChange={(next) => updateNew("usergroup", next)}
                  options={groupOptions}
                />
              </td>

              <td className="px-6 py-3">
                <input
                  className="w-full rounded-md border px-2 py-1 outline-none bg-white dark:bg-gray-900"
                  value={newUser.email}
                  onChange={(e) => updateNew("email", e.target.value)}
                />
              </td>

              <td className="px-6 py-3">
                <input
                  type="password"
                  className="w-full rounded-md border px-2 py-1 outline-none bg-white dark:bg-gray-900"
                  value={newUser.password}
                  onChange={(e) => updateNew("password", e.target.value)}
                />
              </td>

              <td className="px-6 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={!!newUser.active}
                  onChange={(e) => updateNew("active", e.target.checked)}
                />
              </td>

              <td className="px-6 py-3">
                <button
                  onClick={onCreate}
                  className="rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
                >
                  Save
                </button>
              </td>
            </tr>

            {/* Data rows */}
            {loading ? (
              <tr>
                <td className="px-6 py-4" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isEditing = editingId === row.id;
                const z = isEditing && draft ? draft : row;

                return (
                  <tr
                    key={row.id}
                    className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700 border-gray-200"
                  >
                    <td className="px-6 py-4">{row.id}</td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          className="w-full rounded-md border px-2 py-1 outline-none bg-white dark:bg-gray-900"
                          value={z.username}
                          onChange={(e) => updateDraft("username", e.target.value)}
                        />
                      ) : (
                        row.username
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <UserGroupPicker
                          value={z.usergroup || []}
                          onChange={(next) => updateDraft("usergroup", next)}
                          options={groupOptions}
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(row.usergroup || []).map((name) => (
                            <GroupTag key={name}>{name}</GroupTag>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          className="w-full rounded-md border px-2 py-1 outline-none bg-white dark:bg-gray-900"
                          value={z.email}
                          onChange={(e) => updateDraft("email", e.target.value)}
                        />
                      ) : (
                        row.email
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="password"
                          className="w-full rounded-md border px-2 py-1 outline-none bg-white dark:bg-gray-900"
                          value={z.password || ""}
                          onChange={(e) => updateDraft("password", e.target.value)}
                        />
                      ) : (
                        "•".repeat(8)
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={!!z.active}
                          onChange={(e) => updateDraft("active", e.target.checked)}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={!!row.active}
                          onChange={(e) => onToggleActive(row, e.target.checked)}
                        />
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={saveEdit}
                            className="rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded-md bg-gray-200 text-gray-800 px-3 py-1 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          className="font-medium text-blue-600 hover:underline px-2 py-1 rounded"
                        >
                          Edit
                        </button>
                      )}
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
