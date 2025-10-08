import { useEffect, useState } from "react";

// ---- validators (same as your admin page) ----
const pwdValid = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 10 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9]/.test(s);

const re =
  /^(?!.*\.\.)[A-Za-z0-9_%+-](?:[A-Za-z0-9._%+-]*[A-Za-z0-9_%+-])?@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/i;
const emailValid = (s) => typeof s === "string" && re.test(s);

async function getMyProfile() {
  const res = await fetch("/api/users/current", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load profile");
  const data = await res.json();
  return {
    ...data,
    usergroup: Array.isArray(data.usergroup)
      ? data.usergroup
      : String(data.usergroup || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
  };
}

async function updateMyProfile(payload) {
  const res = await fetch("/api/users/current", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || "Update failed");
  }
  return res.json();
}


function GroupTag({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

export default function AdminUpdateProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ email: "", currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setMsg("");
      try {
        const me = await getMyProfile();
        setProfile(me);
        setDraft({ email: me.email || "", currentPassword: "", newPassword: "" });
      } catch (e) {
        setMsg(e.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startEdit = () => {
    if (!profile) return;
    setDraft({ email: profile.email || "", currentPassword: "", newPassword: "" });
    setEditing(true);
    setMsg("");
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft((d) => ({ ...d, currentPassword: "", newPassword: "" }));
    setMsg("");
  };

  const updateDraft = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const saveEdit = async () => {
    if (!profile) return;
    setMsg("");

    const payload = {};
    const emailChanged = draft.email.trim() !== (profile.email || "");
    const passwordChanging = (draft.newPassword || "").length > 0 || (draft.currentPassword || "").length > 0;

    // Validate email (only if changed)
    if (emailChanged) {
      if (!emailValid(draft.email.trim())) {
        setMsg("Email must be valid.");
        return;
      }
      payload.email = draft.email.trim();
    }

    // Validate password change
    if (passwordChanging) {
      if (!draft.currentPassword) {
        setMsg("Please enter your current password.");
        return;
      }
      if (!draft.newPassword) {
        setMsg("Please enter a new password.");
        return;
      }
      if (!pwdValid(draft.newPassword)) {
        setMsg("New password must be 8–10 chars and include letters, numbers, and a special character.");
        return;
      }
      payload.currentPassword = draft.currentPassword;
      payload.newPassword = draft.newPassword;
    }

    if (!emailChanged && !passwordChanging) {
      setMsg("No changes to save.");
      return;
    }

    try {
      setSaving(true);
      const updated = await updateMyProfile(payload);
      // normalise groups on the way back
      const normalised = {
        ...updated,
        usergroup: Array.isArray(updated.usergroup)
          ? updated.usergroup
          : String(updated.usergroup || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      };
      setProfile(normalised);
      setEditing(false);
      setDraft({ email: normalised.email || "", currentPassword: "", newPassword: "" });
      setMsg("Profile updated.");
    } catch (e) {
      setMsg(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      {msg && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          {msg}
        </div>
      )}

      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">User Group</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Current Password</th>
              <th className="px-6 py-3">New Password</th>
              <th className="px-6 py-3">Active</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-6 py-4" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : profile ? (
              <tr className="odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700 border-gray-200">
                {/* Username (read-only) */}
                <td className="px-6 py-4">{profile.username}</td>

                {/* Groups (read-only) */}
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(profile.usergroup || []).map((g) => (
                      <GroupTag key={g}>{g}</GroupTag>
                    ))}
                  </div>
                </td>

                {/* Email (editable) */}
                <td className="px-6 py-4">
                  {editing ? (
                    <input
                      className="w-full rounded-md border px-2 py-1 outline-none focus:ring focus:border-blue-500 bg-white dark:bg-gray-900"
                      value={draft.email}
                      onChange={(e) => updateDraft("email", e.target.value)}
                    />
                  ) : (
                    profile.email || ""
                  )}
                </td>

                {/* Current password (required only if changing password) */}
                <td className="px-6 py-4">
                  {editing ? (
                    <input
                      type="password"
                      className="w-full rounded-md border px-2 py-1 outline-none focus:ring focus:border-blue-500 bg-white dark:bg-gray-900"
                      value={draft.currentPassword}
                      onChange={(e) => updateDraft("currentPassword", e.target.value)}
                      placeholder="Enter current password"
                    />
                  ) : (
                    "•".repeat(8)
                  )}
                </td>

                {/* New password */}
                <td className="px-6 py-4">
                  {editing ? (
                    <input
                      type="password"
                      className="w-full rounded-md border px-2 py-1 outline-none focus:ring focus:border-blue-500 bg-white dark:bg-gray-900"
                      value={draft.newPassword}
                      onChange={(e) => updateDraft("newPassword", e.target.value)}
                      placeholder="Leave blank to keep current"
                    />
                  ) : (
                    "•".repeat(8)
                  )}
                </td>

                {/* Active (read-only) */}
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={!!profile.active}
                    readOnly
                    aria-readonly="true"
                  />
                </td>

                {/* Actions */}
                <td className="px-6 py-4">
                  {editing ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="rounded-md bg-gray-200 text-gray-800 px-3 py-1 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startEdit}
                      className="font-medium text-blue-600 hover:underline px-2 py-1 rounded"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              <tr>
                <td className="px-6 py-4" colSpan={7}>
                  No profile found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
