import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getCurrentUser, updateCurrentUser } from "../api/users";

/* validators (same as Admin) */
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

const BTN = "w-32 h-10 rounded-md bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center justify-center";
const INPUT =
  "w-full rounded-md border border-gray-300 px-3 py-2 outline-none bg-white " +
  "focus:border-indigo-400 focus:ring focus:ring-indigo-200/50";

function normaliseGroups(arrOrCsv) {
  return Array.isArray(arrOrCsv)
    ? arrOrCsv
    : String(arrOrCsv || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

function GroupTag({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

export default function UpdateProfile() {
  const { ready, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");

  // directly editable draft
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  /* auto-dismiss banners */
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

  /* load profile */
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const me = await getCurrentUser();
        const normalised = { ...me, usergroup: normaliseGroups(me.usergroup) };
        setProfile(normalised);
        setEmail(normalised.email || "");
        setCurrentPassword("");
        setNewPassword("");
      } catch (e) {
        setMsg(e?.response?.data?.message || e.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  async function onSave() {
    if (!profile) return;
    setMsg("");
    setOk("");

    const emailChanged = email.trim() !== (profile.email || "");
    const changingPassword = (currentPassword || "").length > 0 || (newPassword || "").length > 0;

    const payload = {};

    // Email change allowed alone
    if (emailChanged) {
      if (!emailValid(email.trim())) {
        setMsg("Email must be valid.");
        return;
      }
      payload.email = email.trim();
    }

    // Password change requires both fields and strong new password
    if (changingPassword) {
      if (!currentPassword) {
        setMsg("Please enter your current password.");
        return;
      }
      if (!newPassword) {
        setMsg("Please enter a new password.");
        return;
      }
      if (!pwdValid(newPassword)) {
        setMsg("New password must be 8–10 chars and include letters, numbers, and a special character.");
        return;
      }
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    if (!emailChanged && !changingPassword) {
      setMsg("No changes to save.");
      return;
    }

    try {
      setSaving(true);
      const updated = await updateCurrentUser(payload);
      setProfile({ ...updated, usergroup: normaliseGroups(updated.usergroup) });
      setOk("Profile updated.");
      // clear password fields after successful update
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      {msg && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
          {msg}
        </div>
      )}
      {ok && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">
          {ok}
        </div>
      )}

      {/* same wrapper rules as Admin: no inner scroll clipping */}
      <div className="relative shadow-md sm:rounded-lg overflow-visible">
        <table className="w-full text-sm text-left text-gray-700">
          <caption className="caption-top text-xl font-semibold text-indigo-600 mb-10">
    Update Profile
  </caption>
          <thead className="text-xs uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">Username</th>
              <th className="px-6 py-3">User Group</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Current Password</th>
              <th className="px-6 py-3">New Password</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>

          <tbody>
            {(!ready || loading) ? (
              <tr>
                <td className="px-6 py-4" colSpan={6}>Loading…</td>
              </tr>
            ) : profile ? (
              // match Admin row colours: solid white row
              <tr className="bg-white border-b border-gray-200">
                {/* Username (read only) */}
                <td className="px-6 py-4">{profile.username}</td>

                {/* User group (read only) */}
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(profile.usergroup || []).map((g) => (
                      <GroupTag key={g}>{g}</GroupTag>
                    ))}
                  </div>
                </td>

                {/* Email - directly editable */}
                <td className="px-6 py-4">
                  <input
                    className={INPUT}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </td>

                {/* Current password */}
                <td className="px-6 py-4">
                  <input
                    type="password"
                    className={INPUT}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="*********"
                  />
                </td>

                {/* New password */}
                <td className="px-6 py-4">
                  <input
                    type="password"
                    className={INPUT}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="*********"
                  />
                </td>

                {/* Save */}
                <td className="px-6 py-4">
                  <button onClick={onSave} disabled={saving} className={BTN}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </td>
              </tr>
            ) : (
              <tr>
                <td className="px-6 py-4" colSpan={6}>No profile found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
