import { useEffect, useMemo, useState } from "react";
import { getUsers, createUser, updateUser, toggleActive } from "../api/users";

/** JS "enum" + labels **/
const UserGroup = Object.freeze({
  PL: "PL",
  PM: "PM",
  DEV: "DEV",
  AD: "AD",
});

const USER_GROUP_LABELS = {
  [UserGroup.PL]: "Project Lead",
  [UserGroup.PM]: "Project Manager",
  [UserGroup.DEV]: "Dev Team",
  [UserGroup.AD]: "Admin",
};

// front-end password rule (same as backend)
const pwdOk = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

export default function AdminHome() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  // add state
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
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState(emptyNew);

  useEffect(() => {
    (async () => {
      try {
        const data = await getUsers();
        setRows(data);
      } catch (e) {
        setMsg(e.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      password: "", // blank; only update if provided
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const updateDraft = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const updateNew = (key, value) =>
    setNewUser((u) => ({ ...u, [key]: value }));

  const saveEdit = async () => {
    if (!draft) return;

    // Do not send empty password; backend respects that too
    const payload = {
      username: draft.username,
      email: draft.email,
      usergroup: draft.usergroup,
      active: !!draft.active,
    };
    if (draft.password && !pwdOk(draft.password)) {
      setMsg(
        "Password must be 8–10 chars, include letters, numbers, and a special character."
      );
      return;
    }
    if (draft.password) payload.password = draft.password;

    try {
      const updated = await updateUser(draft.id, payload);
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      cancelEdit();
    } catch (e) {
      setMsg(e.message || "Update failed");
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
    if (!newUser.username || !newUser.email) {
      setMsg("username and email are required.");
      return;
    }
    if (!pwdOk(newUser.password)) {
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
      setRows((rs) => [created, ...rs]);
      setAdding(false);
      setNewUser(emptyNew);
      setMsg("");
    } catch (e) {
      setMsg(e.message || "Create failed");
    }
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Admin – Users</h2>
        <button
          className="rounded-md bg-blue-600 text-white px-3 py-2 hover:bg-blue-700"
          onClick={() => {
            setAdding((v) => !v);
            setMsg("");
          }}
        >
          {adding ? "Close" : "Add User"}
        </button>
      </div>

      {msg && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          {msg}
        </div>
      )}

      {/* Create row */}
      {adding && (
        <div className="mb-4 rounded-lg border p-3">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              className="rounded-md border px-2 py-1"
              placeholder="username (display)"
              value={newUser.username}
              onChange={(e) => updateNew("username", e.target.value)}
            />
            <input
              className="rounded-md border px-2 py-1"
              placeholder="email"
              value={newUser.email}
              onChange={(e) => updateNew("email", e.target.value)}
            />
            <input
              type="password"
              className="rounded-md border px-2 py-1"
              placeholder="password"
              value={newUser.password}
              onChange={(e) => updateNew("password", e.target.value)}
            />
            <fieldset className="rounded-md border px-2 py-1">
              <legend className="text-xs text-gray-500 px-1">Groups</legend>
              <div className="grid gap-1">
                {Object.values(UserGroup).map((ug) => {
                  const checked = newUser.usergroup.includes(ug);
                  return (
                    <label key={ug} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? newUser.usergroup.filter((x) => x !== ug)
                            : [...newUser.usergroup, ug];
                          updateNew("usergroup", next);
                        }}
                      />
                      <span className="text-sm">
                        {USER_GROUP_LABELS[ug] ?? ug}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={!!newUser.active}
                onChange={(e) => updateNew("active", e.target.checked)}
              />
              <span className="text-sm">Active</span>
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              className="rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
              onClick={onCreate}
            >
              Create
            </button>
            <button
              className="rounded-md bg-gray-200 px-3 py-1 hover:bg-gray-300"
              onClick={() => {
                setAdding(false);
                setNewUser(emptyNew);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">Groups</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Password</th>
              <th className="px-6 py-3">Active</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-6 py-4" colSpan={8}>
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
                          onChange={(e) =>
                            updateDraft("username", e.target.value)
                          }
                        />
                      ) : (
                        row.username
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {isEditing ? (
                        <fieldset className="grid grid-cols-1 gap-2">
                          {Object.values(UserGroup).map((ug) => {
                            const checked = (z.usergroup || []).includes(ug);
                            return (
                              <label key={ug} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-blue-600"
                                  checked={checked}
                                  onChange={() => {
                                    const next = checked
                                      ? (z.usergroup || []).filter((x) => x !== ug)
                                      : [...(z.usergroup || []), ug];
                                    updateDraft("usergroup", next);
                                  }}
                                />
                                <span className="text-sm">
                                  {USER_GROUP_LABELS[ug]}
                                </span>
                              </label>
                            );
                          })}
                        </fieldset>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(row.usergroup || []).map((ug) => (
                            <span
                              key={ug}
                              className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs"
                            >
                              {USER_GROUP_LABELS[ug] ?? ug}
                            </span>
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
                          onChange={(e) =>
                            updateDraft("password", e.target.value)
                          }
                          placeholder="leave blank to keep"
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
                        <div className="flex gap-2">
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
