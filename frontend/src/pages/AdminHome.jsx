import { useEffect, useMemo, useState } from "react";
import { getUsers, createUser, updateUser } from "../api/users";
import { getUserGroups, createUserGroup } from "../api/groups";
import { useAuth } from "../hooks/useAuth";

// ---- helpers ----
const sortByUsernameAsc = (arr) =>
  [...arr].sort((a, b) =>
    String(a?.username ?? "").localeCompare(String(b?.username ?? ""), undefined, { sensitivity: "base" })
  );

// Normalise for comparison (trim/lower email, sort groups)
const normUserShape = (u) => ({
  username: (u.username ?? "").trim(),
  email: (u.email ?? "").trim().toLowerCase(),
  active: !!u.active,
  usergroup: asArray(u.usergroup).slice().sort(), // compare as sorted list
});

// shallow compare the normalised shapes
const isSameUser = (a, b) => {
  if (!a || !b) return false;
  return (
    a.username === b.username &&
    a.email === b.email &&
    a.active === b.active &&
    a.usergroup.length === b.usergroup.length &&
    a.usergroup.every((g, i) => g === b.usergroup[i])
  );
};

const pwdValid = (s) => {
  return (
    typeof s === "string" &&
    s.length >= 8 &&
    s.length <= 10 &&
    /[A-Za-z]/.test(s) &&
    /\d/.test(s) &&
    /[^A-Za-z0-9]/.test(s)
  );
};

const asArray = (v) => Array.isArray(v) ? v : (v ? [String(v)] : []);

const emailRe =
  /^(?!.*\.\.)[A-Za-z0-9_%+-](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])?@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/i;

const emailValid = (s) => typeof s === "string" && emailRe.test(s);


const NAME_MAX = 50;
const NAME_RE = /^[A-Za-z0-9 !@#$%^&*()_\-+=\[\]{};:'",.<>/?\\|`~]+$/;
const nameValid = (s) => {
  return (
    typeof s === "string" &&
    s.length > 0 &&
    s.length <= NAME_MAX &&
    NAME_RE.test(s)
  );
};

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

  return (
    <div className="relative" ref={setAnchorEl}>
      {/* Control */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-alt w-full min-h-[34px] rounded-md border-gray-300 px-2 py-1 text-left focus:outline-none focus:ring flex items-center gap-2 flex-wrap"
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
  const [origById, setOrigById] = useState(new Map());
  const [rows, setRows] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [newUser, setNewUser] = useState(emptyNew);
  const [newGroupName, setNewGroupName] = useState("");

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
        const mapped = sortByUsernameAsc(users).map((u) => ({
          ...u,
          usergroup: asArray(u.usergroup),
          password: "", // empty -> "(leave blank to keep)"
        }));
        setRows(mapped);
        setGroupOptions(groups);
        const nextMap = new Map(mapped.map((u) => [u.username, normUserShape(u)]));
        setOrigById(nextMap);

      } catch (e) {
        setMsg(e?.response?.data?.message || e.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  const isRowDirty = (row) => {
    // Any non-empty password counts as a change
    if ((row.password ?? "").length > 0) return true;

    const orig = origById.get(row.username);
    // If don't have a snapshot yet (e.g., just created), treat as clean
    if (!orig) return false;

    return !isSameUser(normUserShape(row), orig);
  };
  // inline edits (always-on editing)
  const changeRow = (username, key, value) =>
    setRows((rs) => rs.map((r) => (r.username === username ? { ...r, [key]: value } : r)));

  const saveRow = async (row) => {
    // validate
    if (!row.username) return setMsg("Username is required.");
    if (!nameValid(row.username)) {
      return setMsg(`Username must be 1–${NAME_MAX} chars and contain only letters, numbers, or special characters.`);
    }
    if (row.email && !emailValid(row.email)) return setMsg("Email must be valid.");
    if (row.password && !pwdValid(row.password))
      return setMsg("Password must be 8–10 chars, include letters, numbers, and a special character.");
    for (const g of asArray(row.usergroup)) {
      if (!nameValid(g)) {
        return setMsg(`Group name “${g}” must be 1–${NAME_MAX} valid characters.`);
      }
    }
    const payload = {
      username: row.username,
      email: row.email?.trim().toLowerCase() || undefined,
      usergroup: asArray(row.usergroup),
      active: !!row.active,
    };
    if (row.password) payload.password = row.password;

    try {
      const updated = await updateUser(row.username, payload);
      // normalise back into our UI shape
      const safe = {
        ...row,
        ...updated,
        usergroup: asArray(updated.usergroup),
        password: "", // clear after save
      };
      setRows((rs) => rs.map((r) => (r.username === row.username ? safe : r)));
      setOrigById((m) => {
        const copy = new Map(m);
        copy.set(row.username, normUserShape(safe));
        return copy;
      });
      setOk("Update successful.");
    } catch (e) {
      console.log(e.message, e.response)
      const code = e?.response?.data?.code;
      const m =
        (typeof e?.response?.data === "string" ? e.response.data : e?.response?.data?.message) ||
        e.message || "Update failed";
      setMsg(m);
      if (POLICY_REFRESH_CODES.has(code)) {
        reloadUsers();
      }
    }
  };

  // create (first row)
  const changeNew = (k, v) => setNewUser((u) => ({ ...u, [k]: v }));
  const createNew = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      return setMsg("Field(s) cannot be empty.");
    }
    if (!nameValid(newUser.username)) {
      return setMsg(`Username must be 1–${NAME_MAX} chars and contain only letters, numbers, or special characters.`);
    }
    if (!emailValid(newUser.email)) return setMsg("Email must be valid.");
    if (!pwdValid(newUser.password))
      return setMsg("Password must be 8–10 chars, include letters, numbers, and a special character.");
    for (const g of asArray(newUser.usergroup)) {
      if (!nameValid(g)) {
        return setMsg(`Group name “${g}” must be 1–${NAME_MAX} valid characters.`);
      }
    }
    try {
      const created = await createUser({
        username: newUser.username,
        email: newUser.email.trim().toLowerCase(),
        usergroup: asArray(newUser.usergroup),
        password: newUser.password,
        active: !!newUser.active,
      });
      const mapped = {
        ...created,
        usergroup: asArray(created.usergroup),
        password: "",
      };
      setRows((rs) => sortByUsernameAsc([...rs, mapped]));
      setOrigById((m) => {
        const copy = new Map(m);
        // assumes `created` (and thus `mapped`) includes the DB username
        copy.set(mapped.username, normUserShape(mapped));
        return copy;
      });
      setNewUser(emptyNew);
      setOk("User created.");
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message || "Create failed");
    }
  };

  const reloadUsers = async () => {
    try {
      setLoading(true);
      const [users, groups] = await Promise.all([getUsers(), getUserGroups()]);
      const mapped = sortByUsernameAsc(users).map((u) => ({
        ...u,
        usergroup: asArray(u.usergroup),
        password: "",
      }));
      setRows(mapped);
      setGroupOptions(groups);
      const nextMap = new Map(mapped.map((u) => [u.username, normUserShape(u)]));
      setOrigById(nextMap);
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };
  const POLICY_REFRESH_CODES = new Set([
    "ADMIN_CANNOT_DISABLE",
    "ADMIN_MUST_KEEP_GROUP",
    "ADMIN_CANNOT_RENAME",
  ]);

  // call it in the initial effect
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    reloadUsers();
  }, [ready, isAuthenticated]);


  const addUserGroupFromInput = async () => {
    const name = (newGroupName || "").trim();
    if (!name) return; // no-op for empty

    if (!nameValid(name)) {
      setMsg(`Group name must be 1–${NAME_MAX} valid characters.`);
      return;
    }
    const exists = groupOptions.some((g) => g.toLowerCase() === name.toLowerCase());
    if (exists) {
      setMsg("That user group already exists.");
      return;
    }

    try {
      const createdName = await createUserGroup(name);
      setGroupOptions((opts) => [...opts, createdName].sort((a, b) => a.localeCompare(b)));
      setOk(`“${createdName}” added.`);
      setNewGroupName("");
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
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">USER GROUP</span>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addUserGroupFromInput();
                      }}
                      placeholder="+ New group"
                      className="h-8 w-40 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                    />
                    <button
                      type="button"
                      onClick={addUserGroupFromInput}
                      disabled={!newGroupName.trim()}
                      className="h-8 rounded-md bg-indigo-500 px-3 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Create a new user group"
                    >
                      Add
                    </button>
                  </div>
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
              {/* <td className="px-6 py-3 text-gray-400">—</td> */}
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
                <UserGroupPicker
                  value={asArray(newUser.usergroup)}
                  onChange={(arr) => changeNew("usergroup", arr)}
                  options={groupOptions}
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

                <label className="inline-flex items-center cursor-pointer">
                  <input type="checkbox" value="" className="sr-only peer" checked={!!newUser.active}
                    onChange={(e) => changeNew("active", e.target.checked)} />
                  <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
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
                  key={row.username}
                  className="bg-white border-b border-gray-200"
                >
                  {/* <td className="px-6 py-4">
                    <input
                      className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                      value={row.username ?? ""}
                      onChange={(e) => changeRow(row.username, "username", e.target.value)}
                      autoComplete="off"
                    />
                  </td> */}
                  <td className="px-6 py-4">
                    <span className="whitespace-nowrap">{row.username || "—"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <UserGroupPicker
                      value={asArray(row.usergroup)}
                      onChange={(arr) => changeRow(row.username, "usergroup", arr)}
                      options={groupOptions}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                      value={row.email ?? ""}
                      onChange={(e) => changeRow(row.username, "email", e.target.value)}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="password"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white
           focus:border-indigo-400 focus:ring focus:ring-indigo-200/50"
                      value={row.password || ""}
                      onChange={(e) => changeRow(row.username, "password", e.target.value)}
                      placeholder="*********"
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" value="" className="sr-only peer" checked={!!row.active}
                        onChange={(e) => changeRow(row.username, "active", e.target.checked)} />
                      <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                    </label>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={() => saveRow(row)}
                      disabled={!isRowDirty(row)}
                      className="w-32 h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
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
