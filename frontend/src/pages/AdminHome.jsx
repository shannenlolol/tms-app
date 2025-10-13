import { useEffect, useMemo, useState } from "react";
import { getUsers, createUser, updateUser } from "../api/users";
import { getUserGroups, createUserGroup } from "../api/groups";
import { useAuth } from "../hooks/useAuth";

// ---- helpers ----
const sortByIdAsc = (arr) =>
  [...arr].sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));

const pwdValid = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

const emailRe =
  /^(?!.*\.\.)[A-Za-z0-9_%+-](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])?@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/i;
const emailValid = (s) => typeof s === "string" && emailRe.test(s);

// ---- Single-select, pills-style control (like the left UI) ----
function SingleGroupSelect({ value, onChange, options, placeholder = "Select" }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      {/* Control: white, fixed width */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn-alt w-56 inline-flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm leading-none shadow-sm focus:outline-none focus:ring`}
      >
        {value ? (
          <span className="inline-flex items-center rounded-fullpx-2 py-0.5 text-xs">
            {value}
          </span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <span className="ml-2 text-gray-500">▾</span>
      </button>

      {/* Menu: white, same width */}
      {open && (
        <div
          className="absolute z-20 mt-1 w-56 rounded-md border bg-white shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <ul className="max-h-60 overflow-auto py-1">
            {options.map((name) => (
              <li key={name}>
                <button
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  className={`btn-alt w-full text-left px-3 py-2 hover:bg-gray-50 ${value === name ? "font-medium" : ""
                    }`}
                >
                  {name}
                </button>

              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


export default function AdminHome() {
  const { ready, isAuthenticated } = useAuth();

  const emptyNew = useMemo(
    () => ({
      username: "",
      email: "",
      password: "",
      usergroupStr: "", // single value in UI; will send [value] to API
      active: true,
    }),
    []
  );

  const [rows, setRows] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [newUser, setNewUser] = useState(emptyNew);

  // transient banners
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 5000);
    return () => clearTimeout(t);
  }, [msg]);
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(""), 5000);
    return () => clearTimeout(t);
  }, [ok]);

  // initial load
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    (async () => {
      try {
        setLoading(true);
        const [users, groups] = await Promise.all([getUsers(), getUserGroups()]);
        // Map backend (array usergroup) -> UI fields; ensure password empty for inline editing
        const mapped = sortByIdAsc(users).map((u) => ({
          ...u,
          usergroupStr: Array.isArray(u.usergroup) ? (u.usergroup[0] || "") : String(u.usergroup || ""),
          password: "", // empty -> "(leave blank to keep)"
        }));
        setRows(mapped);
        setGroupOptions(groups);
      } catch (e) {
        setMsg(e?.response?.data?.message || e.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  // inline edits (always-on editing)
  const changeRow = (id, key, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const saveRow = async (row) => {
    // validate
    if (!row.username) return setMsg("Username is required.");
    if (row.email && !emailValid(row.email)) return setMsg("Email must be valid.");
    if (row.password && !pwdValid(row.password))
      return setMsg("Password must be 8–10 chars, include letters, numbers, and a special character.");

    const payload = {
      username: row.username,
      email: row.email?.trim().toLowerCase() || undefined,
      // send as single-item array to match your existing backend contract
      usergroup: row.usergroupStr ? [row.usergroupStr] : [],
      active: !!row.active,
    };
    if (row.password) payload.password = row.password;

    try {
      const updated = await updateUser(row.id, payload);
      // normalise back into our UI shape
      const safe = {
        ...row,
        ...updated,
        usergroupStr: Array.isArray(updated.usergroup)
          ? (updated.usergroup[0] || "")
          : (row.usergroupStr || ""),
        password: "", // clear after save
      };
      setRows((rs) => rs.map((r) => (r.id === row.id ? safe : r)));
      setOk("Update successful.");
    } catch (e) {
      console.error("Row update failed:", e?.response?.status, e?.response?.data);
      const m =
        (typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.message) ||
        e.message ||
        "Update failed";
      setMsg(m);
    }
  };

  // create (first row)
  const changeNew = (k, v) => setNewUser((u) => ({ ...u, [k]: v }));
  const createNew = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      return setMsg("Field(s) cannot be empty.");
    }
    if (!emailValid(newUser.email)) return setMsg("Email must be valid.");
    if (!pwdValid(newUser.password))
      return setMsg("Password must be 8–10 chars, include letters, numbers, and a special character.");

    try {
      const created = await createUser({
        username: newUser.username,
        email: newUser.email.trim().toLowerCase(),
        usergroup: newUser.usergroupStr ? [newUser.usergroupStr] : [],
        password: newUser.password,
        active: !!newUser.active,
      });
      const mapped = {
        ...created,
        usergroupStr: Array.isArray(created.usergroup) ? (created.usergroup[0] || "") : "",
        password: "",
      };
      setRows((rs) => sortByIdAsc([...rs, mapped]));
      setNewUser(emptyNew);
      setOk("User created.");
    } catch (e) {
      setMsg(e.message || "Create failed");
    }
  };

  // add user group (+ New)
  const onAddUserGroup = async () => {
    const name = (prompt("Enter new user group name:") || "").trim();
    if (!name) return;
    const exists = groupOptions.some((g) => g.toLowerCase() === name.toLowerCase());
    if (exists) return setMsg("That user group already exists.");

    try {
      const createdName = await createUserGroup(name);
      setGroupOptions((opts) => [...opts, createdName].sort((a, b) => a.localeCompare(b)));
      setOk(`“${createdName}” added.`);
    } catch (e) {
      setMsg(e.message || "Failed to add user group");
    }
  };

  return (
    <div className="p-4">
      {msg && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{msg}</div>}
      {ok && <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-700">{ok}</div>}

      <div className="relative shadow-md sm:rounded-lg overflow-visible lg:overflow-visible">
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
            {/* Inline "add new" row at the top */}
            <tr className="bg-indigo-50 dark:bg-gray-900 border-b dark:border-gray-700 border-gray-200">
              <td className="px-6 py-3 text-gray-400">—</td>
              <td className="px-6 py-3">
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                  value={newUser.username}
                  onChange={(e) => changeNew("username", e.target.value)}
                  autoComplete="off"
                />
              </td>
              <td className="px-6 py-3">
                <SingleGroupSelect
                  value={newUser.usergroupStr}
                  onChange={(v) => changeNew("usergroupStr", v)}
                  options={groupOptions}
                  placeholder="Select"
                />
              </td>
              <td className="px-6 py-3">
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                  value={newUser.email}
                  onChange={(e) => changeNew("email", e.target.value)}
                  autoComplete="off"
                />
              </td>
              <td className="px-6 py-3">
                <input
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                  value={newUser.password}
                  onChange={(e) => changeNew("password", e.target.value)}
                  autoComplete="off"
                />
              </td>
              <td className="px-6 py-3">

                <label class="inline-flex items-center cursor-pointer">
                  <input type="checkbox" value="" class="sr-only peer" checked={!!newUser.active}
                    onChange={(e) => changeNew("active", e.target.checked)} />
                  <div class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                </label>

              </td>
              <td className="px-6 py-3">
                <button
                  onClick={createNew}
                  className={`btn-dark w-32 h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center`}
                > 
                  Add User                </button>
              </td>
            </tr>

            {/* Existing users (always editable) */}
            {loading ? (
              <tr>
                <td className="px-6 py-4" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white border-b border-gray-200"
                >
                  <td className="px-6 py-4">{row.id}</td>

                  <td className="px-6 py-4">
                    <input
                      className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                      value={row.username ?? ""}
                      onChange={(e) => changeRow(row.id, "username", e.target.value)}
                      autoComplete="off"
                    />
                  </td>

                  <td className="px-6 py-4">
                    <SingleGroupSelect
                      value={row.usergroupStr || ""}
                      onChange={(v) => changeRow(row.id, "usergroupStr", v)}
                      options={groupOptions}
                    />
                  </td>

                  <td className="px-6 py-4">
                    <input
                      className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                      value={row.email ?? ""}
                      onChange={(e) => changeRow(row.id, "email", e.target.value)}
                      autoComplete="off"
                    />
                  </td>

                  <td className="px-6 py-4">
                    <input
                      type="password"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                      value={row.password || ""}
                      onChange={(e) => changeRow(row.id, "password", e.target.value)}
                      placeholder="*********"
                      autoComplete="off"
                    />
                  </td>

                  <td className="px-6 py-4">
                <label class="inline-flex items-center cursor-pointer">
                  <input type="checkbox" value="" class="sr-only peer" checked={!!row.active}
                    onChange={(e) => changeRow(row.id, "active", e.target.checked)} />
                  <div class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                </label>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={() => saveRow(row)}
                      className={`w-32 h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center`}
                    >
                      Save
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
