import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getCurrentUser, updateCurrentUser } from "../api/users";

function normaliseGroups(arrOrCsv) {
  return Array.isArray(arrOrCsv)
    ? arrOrCsv
    : String(arrOrCsv || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function UpdateProfile() {
  const { ready, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");

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
        setConfirmPassword("");
      } catch (e) {
        setMsg(e?.response?.data?.message || e.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, isAuthenticated]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!profile) return;

    setMsg("");
    setOk("");

    const payload = {};
    payload.email = email.trim();
    payload.currentPassword = currentPassword;
    payload.newPassword = newPassword;
    payload.confirmPassword = confirmPassword;

    try {
      setSaving(true);
      const updated = await updateCurrentUser(payload);
      setProfile({ ...updated, usergroup: normaliseGroups(updated.usergroup) });
      setOk("Profile updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[70vh] w-full flex items-start justify-center pt-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute left-30 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 hover:bg-gray-50"
      >
        <span className="text-lg">{'<'}</span>
      </button>

      <div className="w-full max-w-md">
        <h1 className="text-l font-semibold text-center mb-6">Update Profile</h1>

        {msg && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
            {msg}
          </div>
        )}
        {ok && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">
            {ok}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {loading || !profile ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Name (read-only) */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  disabled
                  value={profile.username}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* User Group (read-only) */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">User Group</label>
                <input
                  disabled
                  value={(profile.usergroup || []).join(", ")}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs text-gray-700 mb-1">Email</label>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Current Password */}
              <div>
                <label className="block text-xs text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 outline-none"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="off"
                  placeholder="********"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 outline-none"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="off"
                  placeholder="********"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-indigo-400 focus:ring focus:ring-indigo-200/50 outline-none"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="********"
                  autoComplete="off"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 rounded-md bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Submit"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
